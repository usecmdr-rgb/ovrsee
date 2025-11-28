import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
        const tier = session.metadata?.tier as "basic" | "advanced" | "elite" | undefined;
        const userId = session.metadata?.userId;
        const isTrialConversion = session.metadata?.is_trial_conversion === "true";

        if (!userId || !subscriptionId) {
          console.error("Missing userId or subscriptionId in checkout.session.completed event");
          break;
        }

        // Fetch full subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

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
