import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserFromRequest } from "@/lib/auth-helpers";
import { getAccountModeForUser, getAccountMode, getActivationTimestamp, type DbUserRow } from "@/lib/account-mode";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { createErrorResponse } from "@/lib/validation";

/**
 * GET /api/account-mode
 * 
 * Returns the account mode for the user (authenticated or unauthenticated).
 * 
 * SECURITY:
 * - Unauthenticated users receive 'preview' mode
 * - Authenticated users can only access their own account mode
 * 
 * Returns:
 * - mode: Account mode ('preview' | 'trial-active' | 'trial-expired' | 'subscribed')
 * - activationTimestamp: ISO timestamp when user first activated (trial or subscription start), or null
 */
export async function GET(request: NextRequest) {
  try {
    // Get user if authenticated, but don't require auth
    const user = await getAuthenticatedUserFromRequest(request);
    
    // If not authenticated, return preview mode
    if (!user) {
      return NextResponse.json({
        mode: 'preview' as const,
        activationTimestamp: null,
      });
    }
    
    const userId = user.id;

    const supabase = getSupabaseServerClient();

    // Fetch profile data
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("has_used_trial, trial_started_at, trial_ends_at, subscription_tier, subscription_status")
      .eq("id", userId)
      .single();

    if (profileError) {
      // Handle missing column error (42703 = undefined column)
      if (profileError.code === '42703' && profileError.message?.includes('has_used_trial')) {
        console.warn("has_used_trial column missing, defaulting to false. Please run migrations.");
        // Try again without has_used_trial
        const { data: fallbackProfile } = await supabase
          .from("profiles")
          .select("trial_started_at, trial_ends_at, subscription_tier, subscription_status")
          .eq("id", userId)
          .single();
        
        if (!fallbackProfile) {
          return NextResponse.json({
            mode: 'preview' as const,
            activationTimestamp: null,
          });
        }
        
        const userRow: DbUserRow = {
          has_used_trial: false, // Default to false if column doesn't exist
          trial_started_at: fallbackProfile.trial_started_at,
          trial_ends_at: fallbackProfile.trial_ends_at,
          subscription_tier: fallbackProfile.subscription_tier,
          subscription_status: fallbackProfile.subscription_status,
          subscription: null,
        };
        
        const mode = getAccountMode(userRow);
        const activationTimestamp = getActivationTimestamp(userRow);
        
        return NextResponse.json({
          mode,
          activationTimestamp,
        });
      }
      
      // If no profile, default to preview
      return NextResponse.json({
        mode: 'preview' as const,
        activationTimestamp: null,
      });
    }

    if (!profile) {
      // If no profile, default to preview
      return NextResponse.json({
        mode: 'preview' as const,
        activationTimestamp: null,
      });
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
      has_used_trial: profile.has_used_trial ?? false,
      trial_started_at: profile.trial_started_at,
      trial_ends_at: profile.trial_ends_at,
      subscription_tier: profile.subscription_tier,
      subscription_status: profile.subscription_status,
      subscription: subscription || null,
    };

    const mode = getAccountMode(userRow);
    const activationTimestamp = getActivationTimestamp(userRow);

    return NextResponse.json({
      mode,
      activationTimestamp,
    });
  } catch (error: any) {
    // If there's an error, default to preview mode for unauthenticated users
    // This ensures the dashboard still works even if there are issues
    return NextResponse.json({
      mode: 'preview' as const,
      activationTimestamp: null,
    });
  }
}


