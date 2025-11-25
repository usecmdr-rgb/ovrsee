/**
 * Session management utilities
 * Handles user session data including subscription info
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getUserSubscription, syncSubscriptionFromStripe } from "@/lib/subscription/sync";
import { checkAndExpireTrial } from "@/lib/subscription/trial";
import { getUserAccessibleAgents } from "@/lib/auth";
import type { UserSession, SubscriptionTier, SubscriptionStatus } from "@/types/database";
import type { AgentId } from "@/lib/config/agents";

/**
 * Get complete user session data (user + profile + subscription)
 * Syncs subscription with Stripe if needed
 */
export async function getUserSession(userId: string, userEmail?: string | null): Promise<UserSession | null> {
  const supabase = getSupabaseServerClient();

  // Get auth user
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);

  if (userError || !user) {
    console.error("Error fetching user:", userError);
    return null;
  }

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    console.error("Error fetching profile:", profileError);
  }

  // Get subscription
  let subscription = await getUserSubscription(userId);

  // Check and expire trial if needed (before syncing with Stripe)
  await checkAndExpireTrial(userId);
  
  // Re-fetch subscription after expiration check
  subscription = await getUserSubscription(userId);

  // If user has Stripe customer ID, sync with Stripe
  if (profile?.stripe_customer_id) {
    subscription = await syncSubscriptionFromStripe(userId, profile.stripe_customer_id);
  }

  // If no subscription, create default trial one
  if (!subscription) {
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

    subscription = newSub || null;
  }

  // Determine tier and status
  const tier: SubscriptionTier = subscription?.tier || profile?.subscription_tier || "trial";
  const status: SubscriptionStatus = subscription?.status || profile?.subscription_status || "active";

  // Check if trial is expired
  const isTrialExpired = tier === "trial_expired" || status === "expired";

  // Get accessible agents (trial_expired users have no access)
  let accessibleAgents: AgentId[] = [];
  if (!isTrialExpired) {
    accessibleAgents = await getUserAccessibleAgents(userId, userEmail || user.email);
  }

  return {
    user: {
      id: user.id,
      email: user.email || null,
      email_verified: user.email_confirmed_at !== null,
    },
    profile: profile || null,
    subscription: subscription || null,
    tier,
    status,
    isPaid: tier !== "free" && tier !== "trial" && tier !== "trial_expired",
    isTrialing: tier === "trial" || status === "trialing",
    isTrialExpired,
    accessibleAgents: accessibleAgents as AgentId[],
  };
}

/**
 * Get user session from access token (for API routes)
 */
export async function getUserSessionFromToken(accessToken: string): Promise<UserSession | null> {
  const supabase = getSupabaseServerClient();

  // Verify token and get user
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return getUserSession(user.id, user.email);
}

