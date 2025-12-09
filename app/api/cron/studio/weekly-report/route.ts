/**
 * Studio Weekly Report Cron Job
 * 
 * GET /api/cron/studio/weekly-report
 * 
 * This endpoint runs weekly to generate reports for all workspaces.
 * Should be triggered by:
 * - Vercel Cron (configured in vercel.json)
 * - Supabase cron
 * - External scheduler
 * 
 * Query params:
 * - secret: Secret key to prevent unauthorized access
 * - workspace_id: Optional workspace ID to generate report for single workspace (for testing/manual trigger)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { generateWeeklyReport } from "@/lib/studio/report-service";
import { logInfo, logError, logWarn } from "@/lib/studio/logging";

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    await logInfo("cron_weekly_report_start", {});

    // Verify cron secret (if configured)
    const searchParams = request.nextUrl.searchParams;
    const providedSecret = searchParams.get("secret");
    const workspaceId = searchParams.get("workspace_id");

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      await logWarn("cron_weekly_report_unauthorized", {});
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();

    if (workspaceId) {
      // Generate report for specific workspace (useful for testing/manual trigger)
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

      try {
        const report = await generateWeeklyReport(workspaceId, undefined, undefined, undefined, { supabaseClient: supabase });
        await logInfo("cron_weekly_report_success", {
          workspace_id: workspaceId,
          report_id: report.id,
        });
        return NextResponse.json({
          ok: true,
          message: `Generated report for workspace ${workspaceId}`,
          report: {
            id: report.id,
            period_start: report.period_start,
            period_end: report.period_end,
          },
        });
      } catch (error: any) {
        await logError("cron_weekly_report_error", {
          workspace_id: workspaceId,
          error: error.message,
        });
        return NextResponse.json(
          {
            ok: false,
            error: `Failed to generate report: ${error.message}`,
          },
          { status: 500 }
        );
      }
    } else {
      // Generate reports for all workspaces
      const { data: workspaces, error: workspacesError } = await supabase
        .from("workspaces")
        .select("id");

      if (workspacesError || !workspaces) {
        console.error("Error fetching workspaces:", workspacesError);
        return NextResponse.json(
          { error: "Failed to fetch workspaces" },
          { status: 500 }
        );
      }

      const results: Array<{
        workspace_id: string;
        success: boolean;
        report_id?: string;
        error?: string;
      }> = [];

      // Generate reports for each workspace (with error handling per workspace)
      for (const workspace of workspaces) {
        try {
          const report = await generateWeeklyReport(
            workspace.id,
            undefined,
            undefined,
            undefined,
            { supabaseClient: supabase }
          );
          results.push({
            workspace_id: workspace.id,
            success: true,
            report_id: report.id,
          });
        } catch (error: any) {
          await logError("cron_weekly_report_workspace_error", {
            workspace_id: workspace.id,
            error: error.message,
          });
          results.push({
            workspace_id: workspace.id,
            success: false,
            error: error.message || "Unknown error",
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      const durationMs = Date.now() - startTime;
      await logInfo("cron_weekly_report_complete", {
        total: workspaces.length,
        success: successCount,
        failed: failureCount,
        duration_ms: durationMs,
      });

      return NextResponse.json({
        ok: true,
        message: `Generated reports for ${successCount} workspaces (${failureCount} failed)`,
        summary: {
          total: workspaces.length,
          success: successCount,
          failed: failureCount,
        },
        details: results,
      });
    }
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    await logError("cron_weekly_report_exception", {
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

