/**
 * Feature gating helper functions
 * 
 * These functions check if a user has access to specific features based on their
 * subscription plan and add-ons. This is the TypeScript implementation that
 * calls the database functions defined in the migration.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { PlanCode, AddonCode } from "@/lib/pricingConfig";

// Feature codes matching the database enum
export type FeatureCode = 'sync' | 'aloha' | 'studio' | 'insight' | 'support_standard' | 'support_priority';

/**
 * Active subscription with plan and addons
 */
export interface ActiveSubscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  plan: PlanCode;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  addons: AddonCode[];
}

/**
 * Get active subscription for a user
 * Uses the database function for efficiency
 */
export async function getActiveSubscriptionForUser(userId: string): Promise<ActiveSubscription | null> {
  const supabase = getSupabaseServerClient();

  // Call the database function
  const { data, error } = await supabase
    .rpc('get_active_subscription_for_user', { p_user_id: userId })
    .maybeSingle();

  if (error) {
    console.error('Error getting active subscription:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Get addons for this subscription
  const { data: addonsData, error: addonsError } = await supabase
    .from('subscription_addons')
    .select('addon')
    .eq('subscription_id', data.id);

  const addons: AddonCode[] = addonsError || !addonsData
    ? []
    : addonsData.map((row: any) => row.addon as AddonCode);

  return {
    id: data.id,
    userId: data.user_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    plan: data.plan as PlanCode,
    status: data.status,
    currentPeriodStart: data.current_period_start,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    addons,
  };
}

/**
 * Check if user has access to a specific feature
 * Uses the database function for efficiency
 */
export async function userHasFeature(userId: string, feature: FeatureCode): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  // Call the database function
  const { data, error } = await supabase
    .rpc('user_has_feature', {
      p_user_id: userId,
      p_feature: feature,
    })
    .single();

  if (error) {
    console.error('Error checking user feature access:', error);
    return false;
  }

  return data === true;
}

/**
 * Check if user has access to multiple features
 * Returns an object mapping feature codes to boolean access
 */
export async function userHasFeatures(
  userId: string,
  features: FeatureCode[]
): Promise<Record<FeatureCode, boolean>> {
  const results: Record<FeatureCode, boolean> = {} as Record<FeatureCode, boolean>;

  // Check all features in parallel
  await Promise.all(
    features.map(async (feature) => {
      results[feature] = await userHasFeature(userId, feature);
    })
  );

  return results;
}

/**
 * Get all features available to a user
 * Returns an array of feature codes the user has access to
 */
export async function getUserFeatures(userId: string): Promise<FeatureCode[]> {
  const allFeatures: FeatureCode[] = ['sync', 'aloha', 'studio', 'insight', 'support_standard', 'support_priority'];
  
  const access = await userHasFeatures(userId, allFeatures);
  
  return allFeatures.filter((feature) => access[feature]);
}

/**
 * Check if user has agent access (convenience wrapper)
 * Maps agent keys to feature codes
 */
export async function userHasAgentAccess(
  userId: string,
  agent: 'sync' | 'aloha' | 'studio' | 'insight'
): Promise<boolean> {
  const featureMap: Record<string, FeatureCode> = {
    sync: 'sync',
    aloha: 'aloha',
    studio: 'studio',
    insight: 'insight',
  };

  const feature = featureMap[agent];
  if (!feature) {
    return false;
  }

  return userHasFeature(userId, feature);
}

/**
 * Check if user can use a specific addon with their current plan
 */
export function canUseAddon(plan: PlanCode, addon: AddonCode): boolean {
  // Addons are only available for Essentials plan
  if (plan !== 'essentials') {
    return false;
  }

  return addon === 'aloha_addon' || addon === 'studio_addon';
}

/**
 * Get support level for a user
 */
export async function getUserSupportLevel(userId: string): Promise<'support_standard' | 'support_priority' | null> {
  const hasPriority = await userHasFeature(userId, 'support_priority');
  if (hasPriority) {
    return 'support_priority';
  }

  const hasStandard = await userHasFeature(userId, 'support_standard');
  if (hasStandard) {
    return 'support_standard';
  }

  return null;
}




