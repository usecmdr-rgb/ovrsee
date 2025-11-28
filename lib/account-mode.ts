/**
 * Account Mode System
 * 
 * This module provides a single source of truth for determining a user's account mode
 * based on their Supabase data (trial status, subscription status, etc.).
 * 
 * Account Modes:
 * - "preview": User has never started a trial and has no active subscription
 * - "trial-active": User is currently in a free trial window (trial not expired)
 * - "trial-expired": User had a trial, it ended, and they do not have an active subscription
 * - "subscribed": User has an active paid subscription
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { Profile, Subscription } from "@/types/database";

export type AccountMode = 'preview' | 'trial-active' | 'trial-expired' | 'subscribed';

/**
 * Database row type for user data needed to determine account mode
 */
export interface DbUserRow {
  // From profiles table
  has_used_trial: boolean | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  
  // From subscriptions table (if available)
  subscription?: {
    status: string | null;
    trial_started_at: string | null;
    trial_ends_at: string | null;
  } | null;
}

/**
 * Determines the account mode for a user based on their database row data.
 * 
 * Logic:
 * 1. Paid subscription wins (status = 'active')
 * 2. Trial currently running (trial_ends_at is in the future)
 * 3. Trial was activated before but is no longer active (has_used_trial = true and trial expired)
 * 4. Never started a trial, no subscription (preview mode)
 * 
 * @param userRow - User data from profiles and subscriptions tables
 * @param options - Optional configuration including `now` for testing
 * @returns The account mode for this user
 */
export function getAccountMode(
  userRow: DbUserRow,
  options?: { now?: Date }
): AccountMode {
  const now = options?.now ?? new Date();
  
  // Get subscription status (check subscriptions table first, then profiles table)
  const subscriptionStatus = userRow.subscription?.status || userRow.subscription_status;
  
  // Get trial dates (check subscriptions table first, then profiles table)
  const trialEndsAt = userRow.subscription?.trial_ends_at || userRow.trial_ends_at;
  const trialEnds = trialEndsAt ? new Date(trialEndsAt) : null;
  const trialActive = trialEnds !== null && now < trialEnds;
  
  // Map has_used_trial to has_activated_trial concept (true if they've used a trial)
  const hasActivatedTrial = userRow.has_used_trial === true;

  // 1. Paid subscription wins
  if (subscriptionStatus === 'active') {
    return 'subscribed';
  }

  // 2. Trial currently running
  if (trialActive) {
    return 'trial-active';
  }

  // 3. Trial was activated before but is no longer active
  if (hasActivatedTrial && !trialActive) {
    return 'trial-expired';
  }

  // 4. Never started a trial, no subscription
  return 'preview';
}

/**
 * Fetches user data from Supabase and returns their account mode.
 * 
 * @param userId - User ID to check
 * @returns The account mode for this user
 */
export async function getAccountModeForUser(userId: string): Promise<AccountMode> {
  const supabase = getSupabaseServerClient();
  
  // Fetch profile data
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("has_used_trial, trial_started_at, trial_ends_at, subscription_tier, subscription_status")
    .eq("id", userId)
    .single();
  
  if (profileError || !profile) {
    // If no profile, default to preview
    return 'preview';
  }
  
  // Fetch subscription data (if available)
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, trial_started_at, trial_ends_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  
  const userRow: DbUserRow = {
    has_used_trial: profile.has_used_trial,
    trial_started_at: profile.trial_started_at,
    trial_ends_at: profile.trial_ends_at,
    subscription_tier: profile.subscription_tier,
    subscription_status: profile.subscription_status,
    subscription: subscription || null,
  };
  
  return getAccountMode(userRow);
}

/**
 * Gets the activation timestamp for a user (when they first started trial or subscription).
 * This is used to filter metrics to only count events after activation.
 * 
 * Logic:
 * 1. If user has trial_started_at, use that (trial or subscription that started with trial)
 * 2. If user has active subscription but no trial_started_at, use subscription's current_period_start
 * 3. Otherwise, no activation yet (preview mode)
 * 
 * @param userRow - User data from profiles and subscriptions tables
 * @returns ISO timestamp string of when user activated, or null if never activated
 */
export function getActivationTimestamp(userRow: DbUserRow): string | null {
  // Check trial start first (takes precedence - if they had a trial, that's the activation point)
  const trialStartedAt = userRow.subscription?.trial_started_at || userRow.trial_started_at;
  if (trialStartedAt) {
    return trialStartedAt;
  }
  
  // If no trial but they have an active subscription, check subscription start
  // For direct subscriptions (no trial), trial_started_at should be set to current_period_start
  // by the webhook, but if it's not, we can't determine activation from this data structure
  // In practice, the webhook should always set trial_started_at for direct subscriptions
  const subscriptionStatus = userRow.subscription?.status || userRow.subscription_status;
  if (subscriptionStatus === 'active' && userRow.trial_started_at) {
    // If they have an active subscription and trial_started_at is set, use it
    // (This handles direct subscriptions where trial_started_at was set to subscription start)
    return userRow.trial_started_at;
  }
  
  // No activation yet (preview mode)
  return null;
}

