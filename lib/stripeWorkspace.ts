/**
 * Stripe workspace subscription management
 * Handles syncing team seats to Stripe subscription items
 */

import Stripe from "stripe";
import { getStripe } from "./stripe";
import { getSupabaseServerClient } from "./supabaseServerClient";
import { TIERS, type TierId } from "./pricing";
import { getTeamDiscountPercent } from "./pricing";

const stripe = getStripe();

/**
 * Get or create Stripe customer for a workspace
 */
export async function getOrCreateWorkspaceCustomer(
  workspaceId: string,
  ownerEmail?: string
): Promise<string> {
  const supabase = getSupabaseServerClient();

  // Get workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("stripe_customer_id, owner_user_id")
    .eq("id", workspaceId)
    .single();

  if (workspaceError || !workspace) {
    throw new Error("Workspace not found");
  }

  // If customer already exists, return it
  if (workspace.stripe_customer_id) {
    return workspace.stripe_customer_id;
  }

  // Get owner user email if not provided
  // Note: We can't query auth.users directly, so we'll use the email from the profile
  // or pass it as a parameter. For now, we'll create customer without email if not provided.
  const email = ownerEmail;

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: {
      workspace_id: workspaceId,
      owner_user_id: workspace.owner_user_id,
    },
  });

  // Save customer ID to workspace
  await supabase
    .from("workspaces")
    .update({ stripe_customer_id: customer.id })
    .eq("id", workspaceId);

  return customer.id;
}

/**
 * Sync workspace subscription to match current seat configuration
 * 
 * This function:
 * 1. Loads all active + pending seats for the workspace
 * 2. Aggregates counts by tier
 * 3. Creates or updates Stripe subscription with matching items
 * 4. Applies team discounts via coupon if applicable
 *
 * TODO: Support yearly team billing by threading a BillingInterval parameter and
 * choosing the correct Stripe price IDs for { planCode, billingInterval }.
 */
export async function syncWorkspaceSubscriptionFromSeats(
  workspaceId: string,
  billingInterval: 'monthly' | 'yearly' = 'monthly'
): Promise<Stripe.Subscription> {
  const supabase = getSupabaseServerClient();

  // Get workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("stripe_customer_id, stripe_subscription_id, owner_user_id")
    .eq("id", workspaceId)
    .single();

  if (workspaceError || !workspace) {
    throw new Error("Workspace not found");
  }

  // Get all active + pending seats (excluding removed)
  const { data: seats, error: seatsError } = await supabase
    .from("workspace_seats")
    .select("tier, status")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "pending"]);

  if (seatsError) {
    throw new Error(`Failed to fetch seats: ${seatsError.message}`);
  }

  // Aggregate seat counts by tier
  const seatCounts: Record<TierId, number> = {
    basic: 0,
    advanced: 0,
    elite: 0,
  };

  (seats || []).forEach((seat) => {
    if (seat.tier in seatCounts) {
      seatCounts[seat.tier as TierId]++;
    }
  });

  const totalSeats = seatCounts.basic + seatCounts.advanced + seatCounts.elite;

  // Get or create Stripe customer
  const customerId = await getOrCreateWorkspaceCustomer(workspaceId);

  // Get tier price IDs from environment
  const tierPriceIds: Record<TierId, string> = {
    basic: process.env.STRIPE_PRICE_ID_BASIC || "",
    advanced: process.env.STRIPE_PRICE_ID_ADVANCED || "",
    elite: process.env.STRIPE_PRICE_ID_ELITE || "",
  };

  // Validate price IDs
  for (const [tier, priceId] of Object.entries(tierPriceIds)) {
    if (!priceId) {
      console.warn(`Stripe price ID not configured for tier: ${tier}`);
      // TODO: when adding yearly team billing, also validate yearly seat price IDs
      // for the given billingInterval and log if they are missing.
    }
  }

    // If no seats, cancel subscription if it exists
    if (totalSeats === 0) {
      if (workspace.stripe_subscription_id) {
        await stripe.subscriptions.cancel(workspace.stripe_subscription_id);
        await supabase
          .from("workspaces")
          .update({ stripe_subscription_id: null })
          .eq("id", workspaceId);
      }
      throw new Error("Cannot sync subscription with 0 seats");
    }

    // Get or create subscription
    let subscription: Stripe.Subscription;

    if (workspace.stripe_subscription_id) {
      // Update existing subscription
      subscription = await stripe.subscriptions.retrieve(workspace.stripe_subscription_id);

      // Build line items: one per tier with quantity
      const lineItems: Array<Stripe.SubscriptionUpdateParams.Item> = [];

      // Track which price IDs we've handled
      const handledPriceIds = new Set<string>();

      // Add/update items for tiers with seats
      for (const [tier, count] of Object.entries(seatCounts)) {
        const priceId = tierPriceIds[tier as TierId];
        if (count > 0 && priceId) {
          // Find existing item for this tier
          const existingItem = subscription.items.data.find(
            (item) => item.price.id === priceId
          );

          if (existingItem) {
            // Only update if quantity changed
            if (existingItem.quantity !== count) {
              lineItems.push({
                id: existingItem.id,
                price: priceId,
                quantity: count,
              });
            }
            handledPriceIds.add(priceId);
          } else {
            // Add new item
            lineItems.push({
              price: priceId,
              quantity: count,
            });
            handledPriceIds.add(priceId);
          }
        }
      }

      // Remove items for tiers with 0 seats
      subscription.items.data.forEach((item) => {
        if (!handledPriceIds.has(item.price.id)) {
          lineItems.push({
            id: item.id,
            deleted: true,
          });
        }
      });

      // Only update if there are changes
      if (lineItems.length > 0) {
        subscription = await stripe.subscriptions.update(workspace.stripe_subscription_id, {
          items: lineItems,
          proration_behavior: "create_prorations", // Default proration
          metadata: {
            workspace_id: workspaceId,
            total_seats: totalSeats.toString(),
            basic_seats: seatCounts.basic.toString(),
            advanced_seats: seatCounts.advanced.toString(),
            elite_seats: seatCounts.elite.toString(),
          },
        });
      }
    } else {
    // Create new subscription
    if (totalSeats === 0) {
      throw new Error("Cannot create subscription with 0 seats");
    }

    // Build line items
    const lineItems: Stripe.SubscriptionCreateParams.Item[] = [];
    for (const [tier, count] of Object.entries(seatCounts)) {
      if (count > 0 && tierPriceIds[tier as TierId]) {
        lineItems.push({
          price: tierPriceIds[tier as TierId],
          quantity: count,
        });
      }
    }

    subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: lineItems,
      metadata: {
        workspace_id: workspaceId,
        total_seats: totalSeats.toString(),
        basic_seats: seatCounts.basic.toString(),
        advanced_seats: seatCounts.advanced.toString(),
        elite_seats: seatCounts.elite.toString(),
      },
    });

    // Save subscription ID to workspace
    await supabase
      .from("workspaces")
      .update({ stripe_subscription_id: subscription.id })
      .eq("id", workspaceId);
  }

  // Apply team discount coupon if applicable
  const discountPercent = getTeamDiscountPercent(totalSeats);
  if (discountPercent > 0) {
    // Check if discount coupon already applied
    const hasDiscount = subscription.discount?.coupon?.id?.startsWith("team_discount_");

    if (!hasDiscount) {
      // Create or get team discount coupon
      // Note: In production, you'd create these coupons in Stripe dashboard
      // For now, we'll use a coupon code pattern: team_discount_10, team_discount_20, team_discount_25
      const couponId = `team_discount_${Math.round(discountPercent * 100)}`;
      
      try {
        // Try to apply coupon (coupons should be pre-created in Stripe)
        await stripe.subscriptions.update(subscription.id, {
          coupon: couponId,
        });
      } catch (error: any) {
        // If coupon doesn't exist, log warning but continue
        // In production, create these coupons in Stripe dashboard:
        // - team_discount_10 (10% off)
        // - team_discount_20 (20% off)
        // - team_discount_25 (25% off)
        console.warn(`Team discount coupon ${couponId} not found in Stripe. Please create it in Stripe dashboard.`);
      }
    }
  } else {
    // Remove discount if seats dropped below threshold
    if (subscription.discount) {
      await stripe.subscriptions.deleteDiscount(subscription.id);
    }
  }

  return subscription;
}

