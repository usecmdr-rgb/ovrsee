/**
 * Studio Metrics Refresh Cron Job
 * 
 * GET /api/cron/studio/metrics-refresh
 * 
 * This endpoint runs periodically to refresh metrics for recent posts.
 * Should be triggered by:
 * - Vercel Cron (configured in vercel.json)
 * - Supabase cron
 * - External scheduler
 * 
 * Query params:
 * - secret: Secret key to prevent unauthorized access
 * - workspace_id: Optional workspace ID to refresh only that workspace (for testing)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { refreshWorkspaceMetrics, refreshAllWorkspacesMetrics } from "@/lib/studio/metrics-refresh-service";
import { logInfo, logError, logWarn } from "@/lib/studio/logging";

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    await logInfo("cron_metrics_refresh_start", {});

    // Verify cron secret (if configured)
    const searchParams = request.nextUrl.searchParams;
    const providedSecret = searchParams.get("secret");
    const workspaceId = searchParams.get("workspace_id");

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      await logWarn("cron_metrics_refresh_unauthorized", {});
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();

    let results;

    if (workspaceId) {
      // Refresh metrics for specific workspace (useful for testing)
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("id", workspaceId)
        .single();

      if (!workspace) {
        return NextResponse.json(
          { error: "Workspace not found" },
          { status: 404 }
        );
      }

      results = await refreshWorkspaceMetrics(workspaceId);
    } else {
      // Refresh metrics for all workspaces
      results = await refreshAllWorkspacesMetrics();
    }

    // Aggregate results
    const totalPostsProcessed = results.reduce((sum, r) => sum + r.postsProcessed, 0);
    const totalMetricsUpdated = results.reduce((sum, r) => sum + r.metricsUpdated, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    // Group by platform
    const byPlatform: Record<string, { processed: number; updated: number; errors: number }> = {};
    results.forEach((r) => {
      if (!byPlatform[r.platform]) {
        byPlatform[r.platform] = { processed: 0, updated: 0, errors: 0 };
      }
      byPlatform[r.platform].processed += r.postsProcessed;
      byPlatform[r.platform].updated += r.metricsUpdated;
      byPlatform[r.platform].errors += r.errors.length;
    });

    // Log errors
    results.forEach((result) => {
      if (result.errors.length > 0) {
        logWarn("cron_metrics_refresh_errors", {
          workspace_id: result.workspaceId,
          platform: result.platform,
          error_count: result.errors.length,
          errors: result.errors.slice(0, 5), // Log first 5 errors
        });
      }
    });

    const durationMs = Date.now() - startTime;
    await logInfo("cron_metrics_refresh_complete", {
      total_posts_processed: totalPostsProcessed,
      total_metrics_updated: totalMetricsUpdated,
      total_errors: totalErrors,
      platform_count: results.length,
      duration_ms: durationMs,
    });

    return NextResponse.json({
      ok: true,
      message: `Refreshed metrics for ${totalMetricsUpdated} posts across ${results.length} platform connections`,
      summary: {
        totalPostsProcessed,
        totalMetricsUpdated,
        totalErrors,
        byPlatform,
      },
      details: results,
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    await logError("cron_metrics_refresh_exception", {
      error: error.message,
      stack: error.stack,
      duration_ms: durationMs,
    });
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Also support POST for webhook-style triggers
export async function POST(request: NextRequest) {
  return GET(request);
}

