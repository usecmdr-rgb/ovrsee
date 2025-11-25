/**
 * Trial Eligibility System
 * 
 * This module enforces the "one trial per email" rule to prevent abuse.
 * 
 * SECURITY NOTES:
 * - All checks are server-side only (never trust client)
 * - Email normalization prevents case/whitespace variations
 * - Soft deletion preserves trial history even if account is "deleted"
 * - This system cannot prevent users from using completely different emails,
 *   but it robustly prevents reusing the same email for multiple trials
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * Normalize an email address for consistent comparison
 * - Converts to lowercase
 * - Trims whitespace
 * 
 * This ensures "User@Example.com" and "user@example.com" are treated as the same
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check if an email has already used a free trial
 * 
 * This checks:
 * 1. Current profiles table (including soft-deleted accounts)
 * 2. Based on normalized email to catch case variations
 * 
 * @param email - User's email address
 * @returns true if email has used a trial, false otherwise
 */
export async function hasEmailUsedTrial(email: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const normalizedEmail = normalizeEmail(email);

  // Check if any profile (including soft-deleted) has used a trial with this email
  // We check deleted_at IS NULL OR deleted_at IS NOT NULL to include soft-deleted accounts
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("has_used_trial, email_normalized")
    .or(`email_normalized.eq.${normalizedEmail},email_normalized.is.null`)
    .limit(10); // Get multiple in case of duplicates

  if (error) {
    console.error("Error checking trial eligibility:", error);
    // Fail closed: if we can't verify, don't allow trial
    return true;
  }

  // Check if any profile with this normalized email has used a trial
  // Also check profiles where email_normalized might not be set yet
  for (const profile of profiles || []) {
    // If email_normalized matches OR if it's null (legacy data), check has_used_trial
    if (
      profile.email_normalized === normalizedEmail ||
      profile.email_normalized === null
    ) {
      if (profile.has_used_trial === true) {
        return true;
      }
    }
  }

  // Also check by getting user from auth and matching by user ID
  // This handles cases where email_normalized might not be set
  try {
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const matchingUser = authUsers.users.find(
      (u) => normalizeEmail(u.email || "") === normalizedEmail
    );

    if (matchingUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("has_used_trial")
        .eq("id", matchingUser.id)
        .single();

      if (profile?.has_used_trial === true) {
        return true;
      }
    }
  } catch (err) {
    // If we can't check auth users, continue with profile check result
    console.warn("Could not check auth users for trial eligibility:", err);
  }

  return false;
}

/**
 * Mark an email as having used a trial
 * 
 * This should be called when a trial starts, and the flag is NEVER reset.
 * 
 * @param userId - User's ID
 * @param email - User's email address
 */
export async function markTrialAsUsed(
  userId: string,
  email: string
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const normalizedEmail = normalizeEmail(email);

  // Update profile with trial usage info
  const { error } = await supabase
    .from("profiles")
    .update({
      has_used_trial: true,
      trial_used_at: new Date().toISOString(),
      email_normalized: normalizedEmail,
    })
    .eq("id", userId);

  if (error) {
    console.error("Error marking trial as used:", error);
    throw new Error("Failed to record trial usage");
  }
}

/**
 * Check if a user is currently on an active trial
 * 
 * @param userId - User's ID
 * @returns true if user is on active trial, false otherwise
 */
export async function isUserOnActiveTrial(userId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, subscription_status, trial_ends_at")
    .eq("id", userId)
    .single();

  if (!profile) {
    return false;
  }

  // Check if status is "trialing" or tier is "trial"
  const isTrialing =
    profile.subscription_status === "trialing" ||
    profile.subscription_tier === "trial";

  if (!isTrialing) {
    return false;
  }

  // If trial_ends_at is set, check if it's still valid
  if (profile.trial_ends_at) {
    const trialEnd = new Date(profile.trial_ends_at);
    const now = new Date();
    return now < trialEnd;
  }

  return isTrialing;
}

/**
 * Check if a user's trial has expired
 * 
 * @param userId - User's ID
 * @returns true if trial has expired, false otherwise
 */
export async function isTrialExpired(userId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier, subscription_status, trial_ends_at")
    .eq("id", userId)
    .single();

  if (!profile) {
    return false;
  }

  // If tier is explicitly "trial_expired", it's expired
  if (profile.subscription_tier === "trial_expired") {
    return true;
  }

  // If status was "trialing" but trial_ends_at has passed, it's expired
  if (
    (profile.subscription_status === "trialing" ||
      profile.subscription_tier === "trial") &&
    profile.trial_ends_at
  ) {
    const trialEnd = new Date(profile.trial_ends_at);
    const now = new Date();
    if (now >= trialEnd) {
      return true;
    }
  }

  return false;
}

/**
 * Transition a user from trial to trial_expired
 * 
 * This should be called when:
 * - Trial period ends
 * - User tries to access features after trial expiration
 * 
 * @param userId - User's ID
 */
export async function expireTrial(userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_tier: "trial_expired",
      subscription_status: "expired",
    })
    .eq("id", userId);

  if (error) {
    console.error("Error expiring trial:", error);
    throw new Error("Failed to expire trial");
  }
}

