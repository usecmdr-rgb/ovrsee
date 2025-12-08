/**
 * Studio Competitors Refresh Cron
 * 
 * GET /api/cron/studio/competitors-refresh
 * 
 * Refreshes metrics for all competitors across all workspaces
 */

import { NextRequest, NextResponse } from "next/server";
import { refreshAllCompetitorsMetrics } from "@/lib/studio/competitor-service";
import { logInfo, logError, logWarn } from "@/lib/studio/logging";

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    await logInfo("cron_competitors_refresh_start", {});

    const searchParams = request.nextUrl.searchParams;
    const providedSecret = searchParams.get("secret");

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      await logWarn("cron_competitors_refresh_unauthorized", {});
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await refreshAllCompetitorsMetrics();

    const durationMs = Date.now() - startTime;
    await logInfo("cron_competitors_refresh_complete", {
      refreshed: result.refreshed,
      failed: result.failed,
      duration_ms: durationMs,
    });

    return NextResponse.json({
      ok: true,
      message: `Competitor metrics refresh completed. Refreshed: ${result.refreshed}, Failed: ${result.failed}`,
      data: result,
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    await logError("cron_competitors_refresh_exception", {
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

export async function POST(request: NextRequest) {
  return GET(request);
}

