import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import Stripe from "stripe";
import {
  PRICE_ID_TO_PLAN_AND_INTERVAL,
  mapPlanCodeToTier,
  type CorePlanCode,
  type BillingInterval,
} from "@/lib/pricingConfig";
import {
  sendSubscriptionCreatedEmail,
  sendSubscriptionUpdatedEmail,
  sendInvoiceUpcomingEmail,
  sendInvoicePaidEmail,
  sendInvoiceFailedEmail,
} from "@/lib/emails/billing";
import { calculateTeamPricing } from "@/lib/pricing";
import type { SeatSelection } from "@/lib/pricing";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Find workspace ID from Stripe customer or subscription metadata
 */
async function findWorkspaceIdFromStripe(
  customerId: string,
  subscription?: Stripe.Subscription
): Promise<string | null> {
  const supabase = getSupabaseServerClient();

  // Check subscription metadata first (workspace subscriptions have workspace_id in metadata)
  if (subscription?.metadata?.workspace_id) {
    return subscription.metadata.workspace_id as string;
  }

  // Find workspace by stripe_customer_id
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  return workspace?.id || null;
}

/**
 * Get seat configuration from workspace for email
 */
async function getWorkspaceSeatConfiguration(workspaceId: string): Promise<{
  seatCount: number;
  tiers: { tier: string; count: number }[];
  monthlyTotal: number;
}> {
  const supabase = getSupabaseServerClient();

  const { data: seats } = await supabase
    .from("workspace_seats")
    .select("tier")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "pending"]);

  const seatCount = seats?.length || 0;
  const tiers: Record<string, number> = {};

  (seats || []).forEach((seat: any) => {
    tiers[seat.tier] = (tiers[seat.tier] || 0) + 1;
  });

  const seatSelections: SeatSelection[] = Object.entries(tiers)
    .filter(([_, count]) => count > 0)
    .map(([tier, count]) => ({
      tier: tier as "basic" | "advanced" | "elite",
      count: count as number,
    }));

  const pricing = calculateTeamPricing(seatSelections);

  return {
    seatCount,
    tiers: Object.entries(tiers).map(([tier, count]) => ({
      tier,
      count: count as number,
    })),
    monthlyTotal: pricing.finalTotal,
  };
}

/**
 * Generate diff summary for subscription updates
 */
function generateSubscriptionDiffSummary(
  oldSeats: { tier: string; count: number }[],
  newSeats: { tier: string; count: number }[]
): string {
  const oldMap = new Map(oldSeats.map((s) => [`${s.tier}`, s.count]));
  const newMap = new Map(newSeats.map((s) => [`${s.tier}`, s.count]));

  const changes: string[] = [];

  // Check all tiers
  const allTiers = new Set([...oldMap.keys(), ...newMap.keys()]);
  
  for (const tier of allTiers) {
    const oldCount = oldMap.get(tier) || 0;
    const newCount = newMap.get(tier) || 0;
    const diff = newCount - oldCount;

    if (diff > 0) {
      changes.push(`Added ${diff} ${tier} seat${diff > 1 ? "s" : ""}`);
    } else if (diff < 0) {
      changes.push(`Removed ${Math.abs(diff)} ${tier} seat${Math.abs(diff) > 1 ? "s" : ""}`);
    }
  }

  return changes.length > 0 ? changes.join(". ") + "." : "No seat changes.";
}

/**
 * POST /api/stripe/webhook
 * 
 * Handles Stripe webhook events for subscription lifecycle management.
 * 
 * SECURITY:
 * - Verifies webhook signature using Stripe's signing secret
 * - Never processes unverified events
 * - Updates both subscriptions table (source of truth) and profiles table (backward compatibility)
 * 
 * Handled events:
 * - checkout.session.completed: New subscription created
 * - customer.subscription.updated: Subscription modified (tier change, renewal, etc.)
 * - customer.subscription.deleted: Subscription canceled
 * - invoice.payment_succeeded: Payment successful, subscription active
 * - invoice.payment_failed: Payment failed, subscription past_due
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("Missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  // Verify webhook signature - CRITICAL for security
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  try {
    // Idempotency: ensure each Stripe event is processed at most once
    // We insert the event ID into a dedicated table with a UNIQUE constraint.
    // If the insert fails with a unique violation, we know we've already processed it.
    const { error: insertError } = await supabase
      .from("stripe_webhook_events")
      .insert({ id: event.id });

    if (insertError) {
      // 23505 = unique_violation in Postgres
      if ((insertError as any).code === "23505") {
        console.warn("Duplicate Stripe webhook event, skipping:", event.id);
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.error("Error recording webhook event:", insertError);
      return NextResponse.json(
        { error: "Failed to record webhook event" },
        { status: 500 }
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const metadataTier = session.metadata?.tier as "basic" | "advanced" | "elite" | undefined;
        const userId = session.metadata?.userId;
        const isTrialConversion = session.metadata?.is_trial_conversion === "true";

        if (!userId || !subscriptionId) {
          console.error("Missing userId or subscriptionId in checkout.session.completed event");
          break;
        }

        // Fetch full subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Derive planCode + interval from subscription items (preferred), fall back to metadata
        const firstItem = subscription.items.data[0];
        const priceId = firstItem?.price?.id as string | undefined;
        let planCode: CorePlanCode | undefined;
        let billingInterval: BillingInterval | undefined;

        if (priceId && PRICE_ID_TO_PLAN_AND_INTERVAL[priceId]) {
          planCode = PRICE_ID_TO_PLAN_AND_INTERVAL[priceId].planCode;
          billingInterval = PRICE_ID_TO_PLAN_AND_INTERVAL[priceId].billingInterval;
        } else {
          const metaPlanCode = session.metadata?.planCode as CorePlanCode | undefined;
          const metaInterval = (session.metadata?.billingInterval ||
            session.metadata?.billingCycle) as BillingInterval | undefined;
          planCode = metaPlanCode;
          billingInterval = metaInterval;
        }

        // Fallback plan/tier to Essentials/basic if still undefined
        const resolvedPlanCode: CorePlanCode = planCode || "essentials";
        const resolvedTier =
          metadataTier ||
          mapPlanCodeToTier(resolvedPlanCode) ||
          "basic";

        // Check if this is an Essentials trial
        const isEssentialsTrial = session.metadata?.is_essentials_trial === "true" || 
                                   (resolvedPlanCode === "essentials" && subscription.status === "trialing");

        // Update or create subscription record (subscriptions table is source of truth)
        const subscriptionData: any = {
          user_id: userId,
          // New plan-based schema (feature gating)
          plan: resolvedPlanCode,
          // Legacy tier-based schema (backwards compatibility)
          tier: resolvedTier,
          status: subscription.status as "active" | "trialing" | "canceled" | "past_due" | "incomplete" | "incomplete_expired" | "unpaid",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          current_period_start: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end || false,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
          trial_started_at: subscription.trial_start
            ? new Date(subscription.trial_start * 1000).toISOString()
            : null,
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        };

        // If this is a trial conversion, clear trial dates (converted to paid)
        if (isTrialConversion) {
          subscriptionData.trial_started_at = null;
          subscriptionData.trial_ends_at = null;
        }

        // Upsert subscription (subscriptions table has UNIQUE constraint on user_id)
        const { error: subError } = await supabase
          .from("subscriptions")
          .upsert(subscriptionData, {
            onConflict: "user_id",
          });

        if (subError) {
          console.error("Error upserting subscription:", subError);
        }

        // Clear retention window since user is upgrading/reactivating
        const { error: clearError } = await supabase.rpc("clear_retention_on_reactivation", {
          user_id_param: userId,
        });
        if (clearError) {
          console.error("Error clearing retention on upgrade:", clearError);
        }

        // Also update profiles table for backward compatibility
        // The trigger should handle this, but we do it explicitly for safety
        // IMPORTANT: Set trial_started_at when subscription starts (for metrics filtering)
        // IMPORTANT: Set has_used_trial = true to ensure user never goes back to preview mode
        const profileUpdate: any = {
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          subscription_tier: subscriptionData.tier,
          subscription_status: subscriptionData.status,
          has_used_trial: true, // Once they subscribe, they've "used" a trial (prevents preview mode)
        };
        
        // Mark Essentials trial as used (Essentials is the only plan with a free trial)
        // This flag is NEVER reset and prevents the user from getting another Essentials trial
        if (isEssentialsTrial) {
          profileUpdate.has_used_essentials_trial = true;
        }
        
        // Set trial_started_at if this is a new activation (trial or subscription start)
        // This is critical for metrics filtering - only count events after activation
        if (subscriptionData.trial_started_at) {
          profileUpdate.trial_started_at = subscriptionData.trial_started_at;
        } else if (subscription.current_period_start) {
          // If this is a direct subscription (no trial), use current_period_start as activation
          profileUpdate.trial_started_at = new Date(subscription.current_period_start * 1000).toISOString();
        } else {
          // Fallback: use current timestamp as activation point
          profileUpdate.trial_started_at = new Date().toISOString();
        }
        
        if (subscriptionData.trial_ends_at) {
          profileUpdate.trial_ends_at = subscriptionData.trial_ends_at;
        }
        
        const { error: profileError } = await supabase
          .from("profiles")
          .update(profileUpdate)
          .eq("id", userId);

        if (profileError) {
          // Handle missing column errors (42703 = undefined column)
          const hasMissingColumns = profileError.code === '42703';
          const missingColumn = hasMissingColumns && (
            profileError.message?.includes('has_used_trial') ||
            profileError.message?.includes('has_used_essentials_trial')
          );
          
          if (missingColumn) {
            console.warn("Missing column in profiles table, updating without it. Please run migrations:", profileError.message);
            // Remove potentially missing columns from update and try again
            const { has_used_trial, has_used_essentials_trial, ...fallbackUpdate } = profileUpdate;
            const { error: fallbackError } = await supabase
              .from("profiles")
              .update(fallbackUpdate)
              .eq("id", userId);
            
            if (fallbackError) {
              console.error("Error updating profile (fallback):", fallbackError);
            }
          } else {
            console.error("Error updating profile:", profileError);
          }
        }

        // Send subscription created email (workspace-based)
        try {
          const workspaceId = await findWorkspaceIdFromStripe(customerId, subscription);
          if (workspaceId) {
            const seatConfig = await getWorkspaceSeatConfiguration(workspaceId);
            await sendSubscriptionCreatedEmail({
              workspaceId,
              seatCount: seatConfig.seatCount,
              tiers: seatConfig.tiers,
              nextBillingDate: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : new Date().toISOString(),
              monthlyTotal: seatConfig.monthlyTotal,
            }).catch((error) => {
              console.error("Failed to send subscription created email:", error);
            });
          }
        } catch (error) {
          console.error("Error sending subscription created email:", error);
          // Don't fail webhook if email fails
        }

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by customer ID
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profileError || !profile) {
          console.error("Profile not found for customer:", customerId, profileError);
          break;
        }

        // Derive planCode + interval from subscription items (preferred), fall back to metadata
        const firstItem = subscription.items.data[0];
        const priceId = firstItem?.price?.id as string | undefined;
        let planCode: CorePlanCode | undefined;

        if (priceId && PRICE_ID_TO_PLAN_AND_INTERVAL[priceId]) {
          planCode = PRICE_ID_TO_PLAN_AND_INTERVAL[priceId].planCode;
        } else {
          const metaPlanCode = subscription.metadata?.planCode as CorePlanCode | undefined;
          planCode = metaPlanCode;
        }

        const resolvedPlanCode: CorePlanCode = planCode || "essentials";
        const resolvedTier =
          (subscription.metadata?.tier as "basic" | "advanced" | "elite" | undefined) ||
          mapPlanCodeToTier(resolvedPlanCode) ||
          "free";

        const tier = resolvedTier;
        const status = subscription.status as "active" | "trialing" | "canceled" | "paused" | "past_due" | "incomplete" | "incomplete_expired" | "unpaid";

        // Get current subscription to check if this is a cancellation/reactivation
        const { data: currentSub } = await supabase
          .from("subscriptions")
          .select("tier, status, stripe_subscription_id")
          .eq("user_id", profile.id)
          .single();

        const wasPaid = currentSub?.tier && ["basic", "advanced", "elite"].includes(currentSub.tier);
        const isNowCanceled = status === "canceled" || status === "paused";
        const isNowActive = status === "active" || status === "trialing";

        // Update subscriptions table (source of truth)
        const subscriptionData: any = {
          // New plan-based schema
          plan: resolvedPlanCode,
          // Legacy tier-based schema
          tier,
          status,
          stripe_subscription_id: subscription.id,
          current_period_start: subscription.current_period_start
            ? new Date(subscription.current_period_start * 1000).toISOString()
            : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end || false,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
          trial_started_at: subscription.trial_start
            ? new Date(subscription.trial_start * 1000).toISOString()
            : null,
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        };

        const { error: subError } = await supabase
          .from("subscriptions")
          .update(subscriptionData)
          .eq("user_id", profile.id);

        if (subError) {
          console.error("Error updating subscription:", subError);
        }

        // Set 60-day retention window if paid user canceled/paused
        if (wasPaid && isNowCanceled) {
          const { error: retentionError } = await supabase.rpc("set_paid_cancellation_retention", {
            user_id_param: profile.id,
          });
          if (retentionError) {
            console.error("Error setting paid cancellation retention:", retentionError);
          }
        }

        // Clear retention window if user reactivated
        if (wasPaid && isNowActive && currentSub?.tier && ["basic", "advanced", "elite"].includes(currentSub.tier)) {
          const { error: clearError } = await supabase.rpc("clear_retention_on_reactivation", {
            user_id_param: profile.id,
          });
          if (clearError) {
            console.error("Error clearing retention on reactivation:", clearError);
          }
        }

        // Update profiles table for backward compatibility
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            subscription_status: status,
            subscription_tier: tier,
          })
          .eq("id", profile.id);

        if (updateError) {
          console.error("Error updating profile:", updateError);
        }

        // Send subscription updated email (workspace-based) - only for updates, not deletes
        if (event.type === "customer.subscription.updated") {
          try {
            const workspaceId = await findWorkspaceIdFromStripe(customerId, subscription);
            if (workspaceId) {
              // Get old seat config from currentSub if available
              const oldSeatConfig = currentSub
                ? await getWorkspaceSeatConfiguration(workspaceId).catch(() => null)
                : null;
              const newSeatConfig = await getWorkspaceSeatConfiguration(workspaceId);
              
              // Generate diff summary
              const diffSummary = oldSeatConfig
                ? generateSubscriptionDiffSummary(oldSeatConfig.tiers, newSeatConfig.tiers)
                : "Subscription configuration updated.";

              await sendSubscriptionUpdatedEmail({
                workspaceId,
                diffSummary,
                newMonthlyTotal: newSeatConfig.monthlyTotal,
                nextBillingDate: subscription.current_period_end
                  ? new Date(subscription.current_period_end * 1000).toISOString()
                  : new Date().toISOString(),
              }).catch((error) => {
                console.error("Failed to send subscription updated email:", error);
              });
            }
          } catch (error) {
            console.error("Error sending subscription updated email:", error);
            // Don't fail webhook if email fails
          }
        }

        break;
      }

      case "invoice.upcoming": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId || typeof subscriptionId !== "string") {
          break;
        }

        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const workspaceId = await findWorkspaceIdFromStripe(customerId, subscription);
          if (workspaceId) {
            await sendInvoiceUpcomingEmail({
              workspaceId,
              amountDue: invoice.amount_due,
              date: invoice.next_payment_attempt
                ? new Date(invoice.next_payment_attempt * 1000).toISOString()
                : invoice.due_date
                ? new Date(invoice.due_date * 1000).toISOString()
                : new Date().toISOString(),
            }).catch((error) => {
              console.error("Failed to send invoice upcoming email:", error);
            });
          }
        } catch (error) {
          console.error("Error sending invoice upcoming email:", error);
          // Don't fail webhook if email fails
        }

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId || typeof subscriptionId !== "string") {
          break;
        }

        // Find user by customer ID
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profileError || !profile) {
          console.error("Profile not found for customer:", customerId);
          break;
        }

        // Get current subscription to check if this is a reactivation
        const { data: currentSub } = await supabase
          .from("subscriptions")
          .select("tier, status")
          .eq("user_id", profile.id)
          .single();

        const isReactivation = currentSub?.status && ["canceled", "paused", "past_due"].includes(currentSub.status);

        // Update subscriptions table
        const { error: subError } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
          })
          .eq("user_id", profile.id)
          .eq("stripe_subscription_id", subscriptionId);

        if (subError) {
          console.error("Error updating subscription status:", subError);
        }

        // Clear retention window if user reactivated
        if (isReactivation) {
          const { error: clearError } = await supabase.rpc("clear_retention_on_reactivation", {
            user_id_param: profile.id,
          });
          if (clearError) {
            console.error("Error clearing retention on reactivation:", clearError);
          }
        }

        // Update profiles table for backward compatibility
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            subscription_status: "active",
          })
          .eq("id", profile.id);

        if (updateError) {
          console.error("Error updating profile status:", updateError);
        }

        // Send invoice paid email (workspace-based)
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const workspaceId = await findWorkspaceIdFromStripe(customerId, subscription);
          if (workspaceId) {
            await sendInvoicePaidEmail({
              workspaceId,
              amountPaid: invoice.amount_paid,
              date: new Date().toISOString(),
              invoiceUrl: invoice.hosted_invoice_url || undefined,
            }).catch((error) => {
              console.error("Failed to send invoice paid email:", error);
            });
          }
        } catch (error) {
          console.error("Error sending invoice paid email:", error);
          // Don't fail webhook if email fails
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (!subscriptionId || typeof subscriptionId !== "string") {
          break;
        }

        // Find user by customer ID
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profileError || !profile) {
          console.error("Profile not found for customer:", customerId);
          break;
        }

        // Update subscriptions table
        const { error: subError } = await supabase
          .from("subscriptions")
          .update({
            status: "past_due",
          })
          .eq("user_id", profile.id)
          .eq("stripe_subscription_id", subscriptionId);

        if (subError) {
          console.error("Error updating subscription status:", subError);
        }

        // Update profiles table for backward compatibility
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            subscription_status: "past_due",
          })
          .eq("id", profile.id);

        if (updateError) {
          console.error("Error updating profile status:", updateError);
        }

        // Send invoice failed email (workspace-based)
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const workspaceId = await findWorkspaceIdFromStripe(customerId, subscription);
          if (workspaceId) {
            await sendInvoiceFailedEmail({
              workspaceId,
              amountDue: invoice.amount_due,
              retryDate: invoice.next_payment_attempt
                ? new Date(invoice.next_payment_attempt * 1000).toISOString()
                : undefined,
            }).catch((error) => {
              console.error("Failed to send invoice failed email:", error);
            });
          }
        } catch (error) {
          console.error("Error sending invoice failed email:", error);
          // Don't fail webhook if email fails
        }

        break;
      }

      default:
        // Log unhandled event types for monitoring
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    // Return 500 so Stripe will retry
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
