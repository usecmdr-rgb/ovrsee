/**
 * GET /api/insights/email
 * 
 * Returns per-day email metrics for Insights
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";

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
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Default to last 30 days
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const from = fromParam ? new Date(fromParam) : thirtyDaysAgo;
    const to = toParam ? new Date(toParam) : today;

    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    // Query insights_daily_metrics
    const { data: metrics, error: metricsError } = await supabaseClient
      .from("insights_daily_metrics")
      .select("date, emails_received_total, emails_sent_total, emails_important_total")
      .eq("workspace_id", workspaceId)
      .gte("date", from.toISOString().split("T")[0])
      .lte("date", to.toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (metricsError) {
      console.error("[Insights Email] Error:", metricsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch email insights" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Map to response format
    const days = (metrics || []).map(metric => ({
      date: metric.date,
      emailsReceivedTotal: metric.emails_received_total || 0,
      emailsSentTotal: metric.emails_sent_total || 0,
      emailsImportantTotal: metric.emails_important_total || 0,
    }));

    return NextResponse.json({
      ok: true,
      data: {
        range: {
          from: from.toISOString().split("T")[0],
          to: to.toISOString().split("T")[0],
        },
        days,
      },
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Insights Email] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch email insights" },
      { status: 500 }
    );
  }
}




