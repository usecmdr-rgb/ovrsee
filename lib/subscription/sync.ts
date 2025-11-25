/**
 * Subscription synchronization utilities
 * Syncs Supabase subscription data with Stripe
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { stripe } from "@/lib/stripe";
import type { Subscription, SubscriptionUpdate, SubscriptionTier, SubscriptionStatus } from "@/types/database";
import Stripe from "stripe";

/**
 * Sync user's subscription from Stripe to Supabase
 * This should be called on login and periodically to ensure data consistency
 */
export async function syncSubscriptionFromStripe(
  userId: string,
  stripeCustomerId: string | null
): Promise<Subscription | null> {
  const supabase = getSupabaseServerClient();

  // If no Stripe customer ID, check if user has trial or trial_expired
  if (!stripeCustomerId) {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!existing) {
      // Create trial subscription
      const trialStart = new Date();
      const trialEnd = new Date(trialStart);
      trialEnd.setDate(trialEnd.getDate() + 3);

      const { data: newSub } = await supabase
        .from("subscriptions")
        .insert({
          user_id: userId,
          tier: "trial",
          status: "active",
          trial_started_at: trialStart.toISOString(),
          trial_ends_at: trialEnd.toISOString(),
        })
        .select()
        .single();

      return newSub;
    }

    // Don't change trial or trial_expired status if no Stripe customer
    // Only update if it's a paid tier that lost Stripe connection
    if (existing.tier !== "trial" && existing.tier !== "trial_expired" && existing.tier !== "free") {
      // This shouldn't happen, but handle it
      return existing;
    }

    return existing;
  }

  try {
    // Fetch customer from Stripe
    const customer = await stripe.customers.retrieve(stripeCustomerId);

    if (customer.deleted) {
      // Customer deleted in Stripe, set to free
      return await updateSubscriptionInSupabase(userId, {
        tier: "free",
        status: "active",
        stripe_customer_id: null,
        stripe_subscription_id: null,
      });
    }

    // Get active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 1,
    });

    const activeSubscription = subscriptions.data.find(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );

    if (!activeSubscription) {
      // No active subscription, check if there's a canceled one
      const canceledSubscription = subscriptions.data[0];
      
      if (canceledSubscription) {
        // Has a canceled subscription
        return await updateSubscriptionInSupabase(userId, {
          tier: (canceledSubscription.metadata?.tier as SubscriptionTier) || "free",
          status: canceledSubscription.status as SubscriptionStatus,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: canceledSubscription.id,
          current_period_start: canceledSubscription.current_period_start
            ? new Date(canceledSubscription.current_period_start * 1000).toISOString()
            : null,
          current_period_end: canceledSubscription.current_period_end
            ? new Date(canceledSubscription.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: canceledSubscription.cancel_at_period_end || false,
          canceled_at: canceledSubscription.canceled_at
            ? new Date(canceledSubscription.canceled_at * 1000).toISOString()
            : null,
          trial_start: canceledSubscription.trial_start
            ? new Date(canceledSubscription.trial_start * 1000).toISOString()
            : null,
          trial_end: canceledSubscription.trial_end
            ? new Date(canceledSubscription.trial_end * 1000).toISOString()
            : null,
        });
      }

      // No subscription at all, check if user had a trial
      const { data: existingTrial } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (existingTrial && (existingTrial.tier === "trial" || existingTrial.tier === "trial_expired")) {
        // Keep trial status but update Stripe customer ID
        return await updateSubscriptionInSupabase(userId, {
          stripe_customer_id: stripeCustomerId,
        });
      }

      // No trial, set to free
      return await updateSubscriptionInSupabase(userId, {
        tier: "free",
        status: "active",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: null,
      });
    }

    // Update with active subscription data
    const tier = (activeSubscription.metadata?.tier as SubscriptionTier) || "basic";
    const status = activeSubscription.status as SubscriptionStatus;

    return await updateSubscriptionInSupabase(userId, {
      tier,
      status,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: activeSubscription.id,
      current_period_start: activeSubscription.current_period_start
        ? new Date(activeSubscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: activeSubscription.current_period_end
        ? new Date(activeSubscription.current_period_end * 1000).toISOString()
        : null,
      cancel_at_period_end: activeSubscription.cancel_at_period_end || false,
      canceled_at: activeSubscription.canceled_at
        ? new Date(activeSubscription.canceled_at * 1000).toISOString()
        : null,
      trial_start: activeSubscription.trial_start
        ? new Date(activeSubscription.trial_start * 1000).toISOString()
        : null,
      trial_end: activeSubscription.trial_end
        ? new Date(activeSubscription.trial_end * 1000).toISOString()
        : null,
    });
  } catch (error: any) {
    console.error("Error syncing subscription from Stripe:", error);
    // Return existing subscription or null on error
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    return data || null;
  }
}

/**
 * Update subscription in Supabase (upsert)
 */
async function updateSubscriptionInSupabase(
  userId: string,
  update: SubscriptionUpdate
): Promise<Subscription | null> {
  const supabase = getSupabaseServerClient();

  // Check if subscription exists
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from("subscriptions")
      .update(update)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating subscription:", error);
      return null;
    }

    return data;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        tier: update.tier || "free",
        status: update.status || "active",
        ...update,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating subscription:", error);
      return null;
    }

    return data;
  }
}

/**
 * Get user's subscription from Supabase
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No subscription found, return null
      return null;
    }
    console.error("Error fetching subscription:", error);
    return null;
  }

  return data;
}

/**
 * Update subscription tier (for upgrades/downgrades)
 * This preserves all user data - only changes the tier
 */
export async function updateSubscriptionTier(
  userId: string,
  newTier: SubscriptionTier,
  stripeSubscriptionId: string | null
): Promise<Subscription | null> {
  const supabase = getSupabaseServerClient();

  const update: SubscriptionUpdate = {
    tier: newTier,
    stripe_subscription_id: stripeSubscriptionId,
  };

  // If upgrading to paid tier, ensure status is active
  if (newTier !== "free") {
    update.status = "active";
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(update)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating subscription tier:", error);
    return null;
  }

  return data;
}

/**
 * Cancel subscription (marks for cancellation at period end)
 * Preserves all user data
 */
export async function cancelSubscription(
  userId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Subscription | null> {
  const supabase = getSupabaseServerClient();

  const update: SubscriptionUpdate = {
    cancel_at_period_end: cancelAtPeriodEnd,
    canceled_at: cancelAtPeriodEnd ? new Date().toISOString() : null,
  };

  // If canceling immediately, set status to canceled
  if (!cancelAtPeriodEnd) {
    update.status = "canceled";
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(update)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error canceling subscription:", error);
    return null;
  }

  return data;
}

