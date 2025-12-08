/**
 * Studio Hashtag Insights API
 * 
 * GET /api/studio/hashtags/insights
 * 
 * Returns hashtag performance analytics for the workspace
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { computeHashtagInsights } from "@/lib/studio/hashtag-analytics-service";

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
    const periodDays = parseInt(searchParams.get("period_days") || "30", 10);

    // Validate period
    if (periodDays < 1 || periodDays > 365) {
      return NextResponse.json(
        { ok: false, error: "period_days must be between 1 and 365" },
        { status: 400, headers: responseHeaders }
      );
    }

    const insights = await computeHashtagInsights(workspaceId, periodDays, supabaseClient);

    return NextResponse.json(
      {
        ok: true,
        data: insights,
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in hashtag insights endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

