/**
 * GET /api/sync/calendar/month
 * 
 * Returns calendar events for a specific month or week view
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
        { error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString(), 10);
    const month = parseInt(searchParams.get("month") || (new Date().getMonth() + 1).toString(), 10);
    const view = searchParams.get("view") || "month"; // month | week

    // Calculate date range based on view
    let from: Date;
    let to: Date;

    if (view === "week") {
      // For week view, use the first day of the month as the week start
      const firstDay = new Date(year, month - 1, 1);
      from = new Date(firstDay);
      to = new Date(firstDay);
      to.setDate(to.getDate() + 7);
    } else {
      // Month view: first day to last day of month
      from = new Date(year, month - 1, 1);
      to = new Date(year, month, 0, 23, 59, 59); // Last day of month
    }

    // Query events
    const { data: events, error: eventsError } = await supabaseClient
      .from("sync_calendar_events")
      .select("id, summary, start_at, end_at, calendar_id, status")
      .eq("workspace_id", workspaceId)
      .gte("start_at", from.toISOString())
      .lte("start_at", to.toISOString())
      .order("start_at", { ascending: true });

    if (eventsError) {
      console.error("[Sync Calendar Month] Error:", eventsError);
      return NextResponse.json(
        { error: "Failed to fetch calendar events" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Map to response format
    const transformedEvents = (events || []).map((event) => ({
      id: event.id,
      summary: event.summary,
      startAt: event.start_at,
      endAt: event.end_at,
      calendarId: event.calendar_id,
      status: event.status,
    }));

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      events: transformedEvents,
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Sync Calendar Month] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar month" },
      { status: 500 }
    );
  }
}
