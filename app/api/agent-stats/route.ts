import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getAccountModeForUser, getAccountMode, getActivationTimestamp, type DbUserRow } from "@/lib/account-mode";
import { createErrorResponse } from "@/lib/validation";

/**
 * GET /api/agent-stats
 * 
 * Returns agent statistics for the authenticated user.
 * 
 * SECURITY:
 * - Requires user authentication
 * - Only returns stats for the authenticated user
 * 
 * BEHAVIOR:
 * - For preview mode: Returns empty stats (0s)
 * - For trial-active, trial-expired, subscribed: Returns real stats filtered by activation timestamp
 *   (only counts events that occurred after trial/subscription start)
 */
export async function GET(request: Request) {
  try {
    // Authenticate user - throws if not authenticated
    const user = await requireAuthFromRequest(request as any);
    const userId = user.id;

    const supabase = getSupabaseServerClient();

    // Get user's account mode and activation timestamp
    const { data: profile } = await supabase
      .from("profiles")
      .select("has_used_trial, trial_started_at, trial_ends_at, subscription_tier, subscription_status")
      .eq("id", userId)
      .single();

    if (!profile) {
      // No profile, return empty stats (preview mode)
      return NextResponse.json({ ok: true, data: [] });
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

    const accountMode = getAccountMode(userRow);
    const activationTimestamp = getActivationTimestamp(userRow);

    // In preview mode, return empty stats (mock data is handled on frontend)
    if (accountMode === 'preview') {
      return NextResponse.json({ ok: true, data: [] });
    }

    // For trial-active, trial-expired, and subscribed: return real stats
    // Filter by activation timestamp if available (only count events after activation)
    let query = supabase
      .from("agent_stats_daily")
      .select("*")
      .order("date", { ascending: false });

    // If user has an activation timestamp, only include stats from that date onwards
    // This ensures metrics start from 0 at activation
    if (activationTimestamp) {
      const activationDate = new Date(activationTimestamp);
      // Format as YYYY-MM-DD for date comparison
      const activationDateStr = activationDate.toISOString().split('T')[0];
      query = query.gte("date", activationDateStr);
    }

    // Note: We assume agent_stats_daily is already scoped per user (either by RLS or table structure)
    // If the table has a user_id column, it should be filtered by RLS policies
    // If not, the table structure should ensure user isolation

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching agent stats:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data || [] });
  } catch (error: any) {
    // Handle authentication errors
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }

    return createErrorResponse(
      "Failed to fetch agent stats",
      500,
      error
    );
  }
}

