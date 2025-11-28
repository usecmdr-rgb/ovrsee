import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getAccountModeForUser, getAccountMode, getActivationTimestamp, type DbUserRow } from "@/lib/account-mode";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { createErrorResponse } from "@/lib/validation";

/**
 * GET /api/account-mode
 * 
 * Returns the account mode for the authenticated user.
 * 
 * SECURITY:
 * - Requires user authentication
 * - User can only access their own account mode
 * 
 * Returns:
 * - mode: Account mode ('preview' | 'trial-active' | 'trial-expired' | 'subscribed')
 * - activationTimestamp: ISO timestamp when user first activated (trial or subscription start), or null
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user - throws if not authenticated
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const supabase = getSupabaseServerClient();

    // Fetch profile data
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("has_used_trial, trial_started_at, trial_ends_at, subscription_tier, subscription_status")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
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
      has_used_trial: profile.has_used_trial,
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
    // Handle authentication errors
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }

    return createErrorResponse(
      "Failed to fetch account mode",
      500,
      error
    );
  }
}

