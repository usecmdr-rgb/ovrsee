/**
 * User signup utilities
 * Handles creating user, profile, and default subscription in Supabase
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { ProfileInsert } from "@/types/database";

export interface SignupData {
  email: string;
  password: string;
  fullName?: string;
  companyName?: string;
}

/**
 * Create a new user account in Supabase Auth
 * The database trigger will automatically create profile and subscription
 * But we can also ensure it happens here for safety
 */
export async function createUserAccount(data: SignupData) {
  const supabase = getSupabaseServerClient();

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true, // Auto-confirm for now (can be changed to require email verification)
    user_metadata: {
      full_name: data.fullName || "",
      company_name: data.companyName || "",
    },
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Failed to create user account");
  }

  const userId = authData.user.id;

  // Ensure profile exists (trigger should create it, but ensure for safety)
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!existingProfile) {
    const profileData: ProfileInsert = {
      id: userId,
      email: data.email,
      full_name: data.fullName || null,
      company_name: data.companyName || null,
      subscription_tier: "free",
      subscription_status: "active",
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .insert(profileData);

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Don't throw - trigger might have created it
    }
  }

  // Ensure subscription exists (trigger should create it, but ensure for safety)
  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!existingSubscription) {
    // Create 3-day free trial subscription
    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + 3);

    const { error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        tier: "trial",
        status: "active",
        trial_started_at: trialStart.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
      });

    if (subError) {
      console.error("Error creating subscription:", subError);
      // Don't throw - trigger might have created it
    }
  }

  return {
    user: authData.user,
    profile: existingProfile || null,
  };
}

/**
 * Ensure user has profile and subscription (idempotent)
 * Useful for migrating existing users or fixing data inconsistencies
 */
export async function ensureUserProfileAndSubscription(userId: string, email: string) {
  const supabase = getSupabaseServerClient();

  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!existingProfile) {
    const profileData: ProfileInsert = {
      id: userId,
      email,
      subscription_tier: "trial",
      subscription_status: "active",
    };

    await supabase.from("profiles").insert(profileData);
  }

  // Check if subscription exists
  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!existingSubscription) {
    // Create 3-day free trial
    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + 3);

    await supabase.from("subscriptions").insert({
      user_id: userId,
      tier: "trial",
      status: "active",
      trial_started_at: trialStart.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
    });
  }
}

