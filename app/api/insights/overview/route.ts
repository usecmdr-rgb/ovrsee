/**
 * GET /api/insights/overview
 * 
 * Returns aggregated overview metrics for Insights dashboard
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

    // Default to last 7 days
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const from = fromParam ? new Date(fromParam) : sevenDaysAgo;
    const to = toParam ? new Date(toParam) : today;

    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    // Query insights_daily_metrics
    const { data: metrics, error: metricsError } = await supabaseClient
      .from("insights_daily_metrics")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("date", from.toISOString().split("T")[0])
      .lte("date", to.toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (metricsError) {
      console.error("[Insights Overview] Error:", metricsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch insights" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Aggregate totals
    const totals = {
      callsTotal: 0,
      callsAnswered: 0,
      callsMissed: 0,
      voicemailsTotal: 0,
      emailsReceivedTotal: 0,
      emailsSentTotal: 0,
      emailsImportantTotal: 0,
      meetingsTotal: 0,
      studioEditsTotal: 0,
      studioPostsTotal: 0,
    };

    // Build time series
    const dates: string[] = [];
    const callsTotalSeries: number[] = [];
    const emailsReceivedTotalSeries: number[] = [];
    const meetingsTotalSeries: number[] = [];
    const studioPostsTotalSeries: number[] = [];

    (metrics || []).forEach(metric => {
      // Totals
      totals.callsTotal += metric.calls_total || 0;
      totals.callsAnswered += metric.calls_answered || 0;
      totals.callsMissed += metric.calls_missed || 0;
      totals.voicemailsTotal += metric.voicemails_total || 0;
      totals.emailsReceivedTotal += metric.emails_received_total || 0;
      totals.emailsSentTotal += metric.emails_sent_total || 0;
      totals.emailsImportantTotal += metric.emails_important_total || 0;
      totals.meetingsTotal += metric.meetings_total || 0;
      totals.studioEditsTotal += metric.studio_edits_total || 0;
      totals.studioPostsTotal += metric.studio_posts_total || 0;

      // Time series
      dates.push(metric.date);
      callsTotalSeries.push(metric.calls_total || 0);
      emailsReceivedTotalSeries.push(metric.emails_received_total || 0);
      meetingsTotalSeries.push(metric.meetings_total || 0);
      studioPostsTotalSeries.push(metric.studio_posts_total || 0);
    });

    // Calculate time saved hours
    // 5 minutes per call, 2 minutes per email
    const timeSavedMinutes = totals.callsTotal * 5 + totals.emailsReceivedTotal * 2;
    const timeSavedHours = timeSavedMinutes / 60.0;

    // Query insight_events to count generated insights
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];
    
    const { data: insightEvents, error: eventsError } = await supabaseClient
      .from("insight_events")
      .select("id")
      .eq("workspace_id", workspaceId)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());

    if (eventsError) {
      console.error("[Insights Overview] Error fetching insight events:", eventsError);
      // Continue with 0 if query fails
    }

    const insightsGeneratedTotal = insightEvents?.length || 0;

    return NextResponse.json({
      ok: true,
      data: {
        range: {
          from: fromStr,
          to: toStr,
        },
        totals: {
          ...totals,
          timeSavedHours: Math.round(timeSavedHours * 10) / 10, // Round to 1 decimal
          insightsGeneratedTotal,
        },
        timeseries: {
          dates,
          callsTotal: callsTotalSeries,
          emailsReceivedTotal: emailsReceivedTotalSeries,
          meetingsTotal: meetingsTotalSeries,
          studioPostsTotal: studioPostsTotalSeries,
        },
      },
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Insights Overview] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch insights overview" },
      { status: 500 }
    );
  }
}

