import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { createErrorResponse } from "@/lib/validation";

/**
 * POST /api/admin/data-retention-cleanup
 * 
 * Scheduled cleanup job to delete interaction data for users past retention period.
 * 
 * SECURITY:
 * - Should be called by a scheduled job (Supabase Cron, Cloudflare Cron, etc.)
 * - Can optionally require an API key or service role authentication
 * - Uses service role client to bypass RLS for cleanup operations
 * 
 * This job:
 * 1. Finds all users where data_retention_expires_at < NOW()
 * 2. Deletes their interaction data (conversations, messages)
 * 3. Updates subscription to 'data_cleared' status
 * 4. Preserves: auth.users, profiles, subscriptions, agents, has_used_trial flags
 * 
 * Idempotent: Safe to run multiple times.
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication/authorization check here
    // For example, check for a secret header or API key
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.DATA_RETENTION_CLEANUP_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return createErrorResponse("Unauthorized", 401);
    }

    const supabase = getSupabaseServerClient();

    // Call the cleanup function
    const { data: clearedUsers, error } = await supabase.rpc(
      "run_data_retention_cleanup"
    );

    if (error) {
      console.error("Error running data retention cleanup:", error);
      return createErrorResponse(
        "Failed to run cleanup job",
        500,
        error
      );
    }

    const clearedCount = clearedUsers?.length || 0;

    return NextResponse.json({
      success: true,
      clearedCount,
      clearedUsers: clearedUsers || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Data retention cleanup error:", error);
    return createErrorResponse(
      "Internal server error during cleanup",
      500,
      error
    );
  }
}

/**
 * GET /api/admin/data-retention-cleanup
 * 
 * Check status of users in retention window (for monitoring/debugging)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Get users currently in retention window
    const { data: inRetention, error: retentionError } = await supabase
      .from("subscriptions")
      .select(
        "user_id, tier, status, data_retention_expires_at, data_retention_reason"
      )
      .not("data_retention_expires_at", "is", null)
      .gt("data_retention_expires_at", new Date().toISOString())
      .order("data_retention_expires_at", { ascending: true });

    // Get users past retention (should be cleared)
    const { data: pastRetention, error: pastError } = await supabase
      .from("subscriptions")
      .select(
        "user_id, tier, status, data_retention_expires_at, data_retention_reason"
      )
      .not("data_retention_expires_at", "is", null)
      .lt("data_retention_expires_at", new Date().toISOString())
      .not("tier", "eq", "data_cleared");

    if (retentionError || pastError) {
      return createErrorResponse(
        "Failed to fetch retention status",
        500,
        { retentionError, pastError }
      );
    }

    return NextResponse.json({
      inRetentionWindow: inRetention?.length || 0,
      pastRetentionWindow: pastRetention?.length || 0,
      inRetention: inRetention || [],
      pastRetention: pastRetention || [],
    });
  } catch (error: any) {
    console.error("Error fetching retention status:", error);
    return createErrorResponse(
      "Internal server error",
      500,
      error
    );
  }
}













