/**
 * Studio Competitor Detail API
 * 
 * GET /api/studio/competitors/[id]
 * Get competitor details with metrics time-series
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import {
  getLatestCompetitorMetrics,
  getCompetitorMetricsTimeSeries,
} from "@/lib/studio/competitor-service";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const competitorId = params.id;

    // Get competitor
    const { data: competitor, error: compError } = await supabaseClient
      .from("studio_competitors")
      .select("*")
      .eq("id", competitorId)
      .eq("workspace_id", workspaceId)
      .single();

    if (compError || !competitor) {
      return NextResponse.json(
        { ok: false, error: "Competitor not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Get latest metrics
    const latestMetrics = await getLatestCompetitorMetrics(competitorId, supabaseClient);

    // Get metrics time-series (last 60 days)
    const metricsTimeSeries = await getCompetitorMetricsTimeSeries(
      competitorId,
      60,
      supabaseClient
    );

    return NextResponse.json(
      {
        ok: true,
        data: {
          competitor,
          latest_metrics: latestMetrics,
          metrics_time_series: metricsTimeSeries,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio competitor detail endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

