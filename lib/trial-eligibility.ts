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

  // First, try to find profiles by normalized email
  // We include soft-deleted accounts to prevent trial reuse
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("has_used_trial, email_normalized, id")
    .eq("email_normalized", normalizedEmail)
    .limit(10); // Get multiple in case of duplicates

  if (error) {
    // Handle missing column error (42703 = undefined column)
    if (error.code === '42703' && error.message?.includes('has_used_trial')) {
      console.warn("has_used_trial column missing, defaulting to false. Please run migrations.");
      // If column doesn't exist, assume no trial has been used
      return false;
    }
    console.error("Error checking trial eligibility:", error);
    // Fail closed: if we can't verify, don't allow trial
    return true;
  }

  // Check if any profile with this normalized email has used a trial
  for (const profile of profiles || []) {
    if (profile.has_used_trial === true) {
      return true;
    }
  }

  // Also check by getting user from auth and matching by user ID
  // This handles cases where email_normalized might not be set yet (legacy data)
  try {
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const matchingUser = authUsers.users.find(
      (u) => normalizeEmail(u.email || "") === normalizedEmail
    );

    if (matchingUser) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("has_used_trial")
        .eq("id", matchingUser.id)
        .single();

      if (profileError) {
        // Handle missing column error (42703 = undefined column)
        if (profileError.code === '42703' && profileError.message?.includes('has_used_trial')) {
          console.warn("has_used_trial column missing, defaulting to false. Please run migrations.");
          return false;
        }
        // For other errors, fail closed
        return true;
      }

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
  const updateData: any = {
    email_normalized: normalizedEmail,
  };
  
  // Only include has_used_trial and trial_used_at if column exists
  // We'll try to update, and if it fails due to missing column, we'll log a warning
  try {
    updateData.has_used_trial = true;
    updateData.trial_used_at = new Date().toISOString();
  } catch (e) {
    // Ignore - will be caught by the update error
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", userId);

  if (error) {
    // Handle missing column error (42703 = undefined column)
    if (error.code === '42703' && error.message?.includes('has_used_trial')) {
      console.warn("has_used_trial column missing, updating only email_normalized. Please run migrations.");
      // Try again without has_used_trial
      const { error: fallbackError } = await supabase
        .from("profiles")
        .update({ email_normalized: normalizedEmail })
        .eq("id", userId);
      
      if (fallbackError) {
        console.error("Error marking trial as used (fallback):", fallbackError);
        throw new Error("Failed to record trial usage");
      }
      return;
    }
    
    console.error("Error marking trial as used:", error);
    throw new Error("Failed to record trial usage");
  }
}

/**
 * Check if a user has used their Essentials trial
 * 
 * Essentials is the only plan with a 3-day free trial.
 * This function checks if the user has already used that trial.
 * 
 * @param userId - User's ID
 * @returns true if user has used Essentials trial, false otherwise
 */
export async function hasUserUsedEssentialsTrial(userId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("has_used_essentials_trial")
    .eq("id", userId)
    .single();

  if (error) {
    // Handle missing column error (42703 = undefined column)
    if (error.code === '42703' && error.message?.includes('has_used_essentials_trial')) {
      console.warn("has_used_essentials_trial column missing, defaulting to false. Please run migrations.");
      return false;
    }
    console.error("Error checking Essentials trial eligibility:", error);
    // Fail closed: if we can't verify, assume trial has been used
    return true;
  }

  return profile?.has_used_essentials_trial === true;
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
 * Sets 30-day data retention window automatically.
 * 
 * @param userId - User's ID
 */
export async function expireTrial(userId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  // Use the RPC function that sets retention window
  const { error: rpcError } = await supabase.rpc("expire_trial_with_retention", {
    user_id_param: userId,
  });

  if (rpcError) {
    // Fallback to direct update if RPC fails
    console.warn("RPC expire_trial_with_retention failed, using direct update:", rpcError);
    
    const { error } = await supabase
      .from("subscriptions")
      .update({
        tier: "trial_expired",
        status: "expired",
        trial_ended_at: new Date().toISOString(),
        data_retention_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        data_retention_reason: "trial_expired",
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Error expiring trial:", error);
      throw new Error("Failed to expire trial");
    }
  }
}

