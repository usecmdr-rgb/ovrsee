/**
 * Studio Reports API
 * 
 * GET /api/studio/reports
 * List reports for the workspace
 * 
 * POST /api/studio/reports
 * Generate a new report (manual trigger)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getWorkspaceReports, generateWeeklyReport } from "@/lib/studio/report-service";
import { startOfWeek, endOfWeek, subWeeks } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const reports = await getWorkspaceReports(workspaceId, limit, supabaseClient);

    return NextResponse.json(
      {
        ok: true,
        data: { reports },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio reports GET endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const body = await request.json();
    const { period_start, period_end, campaign_id } = body;

    let periodStart: Date | undefined;
    let periodEnd: Date | undefined;

    if (period_start && period_end) {
      periodStart = new Date(period_start);
      periodEnd = new Date(period_end);
    } else {
      // Default to last week
      const lastWeek = subWeeks(new Date(), 1);
      periodStart = startOfWeek(lastWeek, { weekStartsOn: 1 });
      periodEnd = endOfWeek(lastWeek, { weekStartsOn: 1 });
    }

    const report = await generateWeeklyReport(
      workspaceId,
      periodStart,
      periodEnd,
      user.id,
      {
        campaign_id: campaign_id || undefined,
        supabaseClient,
      }
    );

    return NextResponse.json(
      {
        ok: true,
        data: { report },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio reports POST endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

