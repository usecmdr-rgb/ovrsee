/**
 * Data Retention Management
 * 
 * Handles data retention windows for:
 * - Free trial users: 30 days after trial expiration
 * - Paid users who cancel: 60 days after cancellation
 * 
 * SECURITY:
 * - All retention logic is server-side only
 * - Never resets has_used_trial flags
 * - Never deletes auth.users or subscription records
 * - Only deletes interaction/memory data (conversations, messages)
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * Set 30-day retention window when trial expires
 * Called when a trial transitions to trial_expired state
 */
export async function setTrialExpirationRetention(userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.rpc("expire_trial_with_retention", {
    user_id_param: userId,
  });

  if (error) {
    console.error("Error setting trial expiration retention:", error);
    throw new Error("Failed to set trial expiration retention");
  }
}

/**
 * Set 60-day retention window when paid subscription is canceled/paused
 * Called when a paid user cancels or pauses their subscription
 */
export async function setPaidCancellationRetention(userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.rpc("set_paid_cancellation_retention", {
    user_id_param: userId,
  });

  if (error) {
    console.error("Error setting paid cancellation retention:", error);
    throw new Error("Failed to set paid cancellation retention");
  }
}

/**
 * Clear retention window when user reactivates/upgrades
 * This preserves all data since user is reactivating within retention period
 */
export async function clearRetentionOnReactivation(userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.rpc("clear_retention_on_reactivation", {
    user_id_param: userId,
  });

  if (error) {
    console.error("Error clearing retention on reactivation:", error);
    // Don't throw - this is not critical if it fails
    console.warn("Retention window not cleared, but user data is preserved");
  }
}

/**
 * Get data retention status for a user
 */
export async function getDataRetentionStatus(userId: string): Promise<{
  hasRetentionWindow: boolean;
  expiresAt: string | null;
  daysRemaining: number | null;
  reason: "trial_expired" | "paid_canceled" | "paid_paused" | null;
  isExpired: boolean;
  isDataCleared: boolean;
}> {
  const supabase = getSupabaseServerClient();

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("data_retention_expires_at, data_retention_reason, tier, status")
    .eq("user_id", userId)
    .single();

  if (error || !subscription) {
    return {
      hasRetentionWindow: false,
      expiresAt: null,
      daysRemaining: null,
      reason: null,
      isExpired: false,
      isDataCleared: false,
    };
  }

  const hasRetentionWindow = subscription.data_retention_expires_at !== null;
  const expiresAt = subscription.data_retention_expires_at;
  const isDataCleared = subscription.tier === "data_cleared";

  let daysRemaining: number | null = null;
  let isExpired = false;

  if (expiresAt) {
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    const diff = expirationDate.getTime() - now.getTime();
    daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    isExpired = daysRemaining <= 0;
  }

  return {
    hasRetentionWindow,
    expiresAt,
    daysRemaining: daysRemaining !== null ? Math.max(0, daysRemaining) : null,
    reason: subscription.data_retention_reason as
      | "trial_expired"
      | "paid_canceled"
      | "paid_paused"
      | null,
    isExpired,
    isDataCleared,
  };
}

/**
 * Check if user is in retention window (data not yet cleared)
 */
export async function isInRetentionWindow(userId: string): Promise<boolean> {
  const status = await getDataRetentionStatus(userId);
  return status.hasRetentionWindow && !status.isExpired && !status.isDataCleared;
}

/**
 * Check if user's data has been cleared
 */
export async function isDataCleared(userId: string): Promise<boolean> {
  const status = await getDataRetentionStatus(userId);
  return status.isDataCleared;
}

/**
 * Manually trigger cleanup for a specific user (admin/testing only)
 * WARNING: This permanently deletes interaction data
 */
export async function clearUserInteractionData(userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase.rpc("clear_user_interaction_data", {
    user_id_param: userId,
  });

  if (error) {
    console.error("Error clearing user interaction data:", error);
    throw new Error("Failed to clear user interaction data");
  }
}

