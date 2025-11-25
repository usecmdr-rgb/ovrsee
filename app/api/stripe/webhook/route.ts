import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET environment variable is required");
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const tier = session.metadata?.tier as "basic" | "advanced" | "elite" | undefined;
        const userId = session.metadata?.userId;
        const isTrialConversion = session.metadata?.is_trial_conversion === "true";

        if (!userId || !subscriptionId) {
          console.error("Missing userId or subscriptionId in checkout.session.completed event");
          break;
        }

        // Fetch full subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Check if this is a trial conversion
        const isTrialConversion = session.metadata?.is_trial_conversion === "true";

        // Update or create subscription record (subscriptions table is source of truth)
        const subscriptionData: any = {
          user_id: userId,
          tier: tier || "basic",
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

        // Also update profiles table for backward compatibility
        // The trigger should handle this, but we do it explicitly for safety
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            subscription_tier: subscriptionData.tier,
            subscription_status: subscriptionData.status,
          })
          .eq("id", userId);

        if (profileError) {
          console.error("Error updating profile:", profileError);
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

        const tier = (subscription.metadata?.tier as "basic" | "advanced" | "elite" | undefined) || "free";
        const status = subscription.status as "active" | "trialing" | "canceled" | "past_due" | "incomplete" | "incomplete_expired" | "unpaid";

        // Update subscriptions table (source of truth)
        const subscriptionData = {
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
