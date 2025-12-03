import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { createErrorResponse, validateQueryParams } from "@/lib/validation";
import { z } from "zod";

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  calendarId: z.string().optional(),
});

/**
 * GET /api/sync/calendar/events
 * 
 * List synced calendar events for the current workspace
 * 
 * Query params:
 * - from?: ISO date string (default: now)
 * - to?: ISO date string (default: now + 7 days)
 * - calendarId?: string (optional filter)
 * 
 * Returns:
 * - events: array of event objects
 */
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

    // Validate query params
    const validation = validateQueryParams(request.nextUrl, querySchema);
    if (!validation.success) {
      return validation.error;
    }

    // Default time range: now to 7 days from now
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const from = validation.data.from
      ? new Date(validation.data.from)
      : now;
    const to = validation.data.to
      ? new Date(validation.data.to)
      : sevenDaysFromNow;
    const calendarId = validation.data.calendarId;

    // Build query
    let eventsQuery = supabaseClient
      .from("sync_calendar_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("start_at", from.toISOString())
      .lte("start_at", to.toISOString())
      .order("start_at", { ascending: true });

    // Filter by calendar ID if provided
    if (calendarId) {
      eventsQuery = eventsQuery.eq("calendar_id", calendarId);
    }

    const { data: events, error: eventsError } = await eventsQuery;

    if (eventsError) {
      return createErrorResponse(
        `Failed to fetch events: ${eventsError.message}`,
        500
      );
    }

    // Transform events
    const transformedEvents = (events || []).map((event) => ({
      id: event.id,
      externalId: event.external_id,
      calendarId: event.calendar_id,
      summary: event.summary,
      description: event.description,
      location: event.location,
      startAt: event.start_at,
      endAt: event.end_at,
      status: event.status,
      attendees: event.attendees,
      hangoutLink: event.hangout_link,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    }));

    return NextResponse.json({
      events: transformedEvents,
      count: transformedEvents.length,
      from: from.toISOString(),
      to: to.toISOString(),
    }, { headers: responseHeaders });
  } catch (error: any) {
    console.error("Error fetching calendar events:", error);
    return createErrorResponse(
      error.message || "Failed to fetch events",
      500
    );
  }
}
