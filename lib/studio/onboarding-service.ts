/**
 * Studio Onboarding Service
 * 
 * Manages onboarding state and progress tracking for Studio.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingStep = "connect_accounts" | "brand_profile" | "first_plan" | "review";

// Required steps - user must complete these to use Studio
export const REQUIRED_STEPS: OnboardingStep[] = ["connect_accounts"];

// Optional steps - user can skip these
export const OPTIONAL_STEPS: OnboardingStep[] = ["brand_profile", "first_plan", "review"];

export interface OnboardingState {
  workspace_id: string;
  completed_steps: OnboardingStep[];
  created_at: string;
  updated_at: string;
}

/**
 * Get onboarding state for a workspace
 */
export async function getOnboardingState(
  workspaceId: string,
  supabaseClient?: SupabaseClient
): Promise<OnboardingState | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data, error } = await supabase
    .from("studio_onboarding_state")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    workspace_id: data.workspace_id,
    completed_steps: (data.completed_steps || []) as OnboardingStep[],
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Mark a step as completed (or skipped)
 */
export async function completeOnboardingStep(
  workspaceId: string,
  step: OnboardingStep,
  options?: { skipped?: boolean },
  supabaseClient?: SupabaseClient
): Promise<void> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Get current state
  const currentState = await getOnboardingState(workspaceId, supabase);

  const completedSteps = currentState?.completed_steps || [];
  
  // Don't add if already completed
  if (completedSteps.includes(step)) {
    return;
  }

  const newCompletedSteps = [...completedSteps, step];

  // Upsert onboarding state
  const { error } = await supabase
    .from("studio_onboarding_state")
    .upsert(
      {
        workspace_id: workspaceId,
        completed_steps: newCompletedSteps,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "workspace_id",
      }
    );

  if (error) {
    throw new Error(`Failed to update onboarding state: ${error.message}`);
  }
}

/**
 * Check if onboarding is required (i.e., user hasn't connected any accounts)
 * Returns true if user needs to complete onboarding (connect at least one account)
 */
export async function isOnboardingRequired(
  workspaceId: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const supabase = supabaseClient || getSupabaseServerClient();
  
  // Check if workspace has at least one connected social account
  const { data: accounts, error } = await supabase
    .from("studio_social_accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);

  if (error) {
    console.error("Error checking social accounts:", error);
    // If we can't check, assume onboarding is required to be safe
    return true;
  }

  // If no accounts found, onboarding is required
  return !accounts || accounts.length === 0;
}

/**
 * Check if onboarding is complete (all steps done)
 * Note: This is different from isOnboardingRequired - this checks if ALL steps are done
 */
export async function isOnboardingComplete(
  workspaceId: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const state = await getOnboardingState(workspaceId, supabaseClient);
  
  if (!state) {
    return false;
  }

  const allSteps: OnboardingStep[] = ["connect_accounts", "brand_profile", "first_plan", "review"];
  return allSteps.every((step) => state.completed_steps.includes(step));
}

/**
 * Check if a specific step is completed
 */
export async function isStepCompleted(
  workspaceId: string,
  step: OnboardingStep,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const state = await getOnboardingState(workspaceId, supabaseClient);
  
  if (!state) {
    return false;
  }

  return state.completed_steps.includes(step);
}

