/**
 * Trial management utilities
 * Handles 3-day free trial logic and expiration
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { Subscription, SubscriptionUpdate } from "@/types/database";

/**
 * Check if a trial has expired and update subscription accordingly
 * Returns true if trial was expired, false otherwise
 */
export async function checkAndExpireTrial(userId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  // Get current subscription
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!subscription) {
    return false;
  }

  // Check if trial has expired
  if (
    subscription.tier === "trial" &&
    subscription.status === "active" &&
    subscription.trial_ends_at
  ) {
    const trialEndDate = new Date(subscription.trial_ends_at);
    const now = new Date();

    // If trial has expired and no paid subscription exists
    if (now > trialEndDate && !subscription.stripe_subscription_id) {
      // Update to trial_expired
      const update: SubscriptionUpdate = {
        tier: "trial_expired",
        status: "expired",
      };

      await supabase
        .from("subscriptions")
        .update(update)
        .eq("user_id", userId);

      return true;
    }
  }

  return false;
}

/**
 * Get trial status information
 */
export async function getTrialStatus(userId: string): Promise<{
  isTrial: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  trialEndsAt: string | null;
}> {
  const supabase = getSupabaseServerClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("tier, status, trial_ends_at")
    .eq("user_id", userId)
    .single();

  if (!subscription) {
    return {
      isTrial: false,
      isExpired: false,
      daysRemaining: null,
      trialEndsAt: null,
    };
  }

  const isTrial = subscription.tier === "trial";
  const isExpired = subscription.tier === "trial_expired" || subscription.status === "expired";

  let daysRemaining: number | null = null;
  if (isTrial && subscription.trial_ends_at) {
    const trialEnd = new Date(subscription.trial_ends_at);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return {
    isTrial,
    isExpired,
    daysRemaining,
    trialEndsAt: subscription.trial_ends_at,
  };
}

/**
 * Check if user has active access (not expired trial)
 */
export async function hasActiveAccess(userId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("tier, status, trial_ends_at, stripe_subscription_id")
    .eq("user_id", userId)
    .single();

  if (!subscription) {
    return false;
  }

  // If trial_expired and no paid subscription, no access
  if (subscription.tier === "trial_expired" && !subscription.stripe_subscription_id) {
    return false;
  }

  // If trial but expired, no access
  if (subscription.tier === "trial" && subscription.trial_ends_at) {
    const trialEnd = new Date(subscription.trial_ends_at);
    const now = new Date();
    if (now > trialEnd && !subscription.stripe_subscription_id) {
      return false;
    }
  }

  // Active subscription (paid or active trial)
  return subscription.status === "active" || subscription.status === "trialing";
}

