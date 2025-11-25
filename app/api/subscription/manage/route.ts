import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getUserSessionFromToken } from "@/lib/auth/session";
import { updateSubscriptionTier, cancelSubscription } from "@/lib/subscription/sync";
import { stripe } from "@/lib/stripe";
import type { TierId } from "@/lib/stripe";

/**
 * POST /api/subscription/manage
 * Upgrade, downgrade, or cancel subscription
 * Preserves all user data - only changes subscription tier
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const session = await getUserSessionFromToken(accessToken);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, tier } = body;

    if (!action || !["upgrade", "downgrade", "cancel"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'upgrade', 'downgrade', or 'cancel'" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const userId = session.user.id;

    if (action === "cancel") {
      // Cancel subscription (preserves data, marks for cancellation)
      const canceled = await cancelSubscription(userId, true);

      // Also cancel in Stripe if subscription exists
      if (session.subscription?.stripe_subscription_id) {
        try {
          await stripe.subscriptions.update(session.subscription.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
        } catch (error: any) {
          console.error("Error canceling Stripe subscription:", error);
          // Continue - Supabase is updated
        }
      }

      return NextResponse.json({
        success: true,
        message: "Subscription will be canceled at the end of the billing period",
        subscription: canceled,
      });
    }

    // Upgrade or downgrade
    if (!tier || !["basic", "advanced", "elite"].includes(tier)) {
      return NextResponse.json(
        { error: "Valid tier required for upgrade/downgrade" },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId = session.profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          supabase_user_id: userId,
        },
        email: session.user.email || undefined,
      });

      customerId = customer.id;

      // Save customer ID
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    // Update subscription in Stripe
    let stripeSubscriptionId = session.subscription?.stripe_subscription_id;

    if (stripeSubscriptionId) {
      // Update existing subscription
      const { tierConfig } = await import("@/lib/stripe");
      const priceId = tierConfig[tier as TierId]?.priceId;

      if (priceId) {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        await stripe.subscriptions.update(stripeSubscriptionId, {
          items: [{
            id: subscription.items.data[0].id,
            price: priceId,
          }],
          metadata: {
            tier,
            userId,
          },
        });
      }
    } else {
      // Create new subscription
      const { tierConfig } = await import("@/lib/stripe");
      const priceId = tierConfig[tier as TierId]?.priceId;

      if (priceId) {
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId }],
          metadata: {
            tier,
            userId,
          },
        });

        stripeSubscriptionId = subscription.id;
      }
    }

    // Update in Supabase (preserves all user data)
    const updated = await updateSubscriptionTier(userId, tier, stripeSubscriptionId);

    return NextResponse.json({
      success: true,
      message: `Subscription ${action}d successfully`,
      subscription: updated,
    });
  } catch (error: any) {
    console.error("Subscription management error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to manage subscription" },
      { status: 500 }
    );
  }
}

