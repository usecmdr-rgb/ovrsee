import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getOrCreateWorkspace } from "@/lib/sync/integrations";

/**
 * GET /api/sync/stats
 * 
 * Returns real sync statistics for the authenticated user based on email_queue and sync_calendar_events data.
 * 
 * SECURITY:
 * - Requires user authentication
 * - Only returns stats for the authenticated user
 * 
 * Returns:
 * - important_emails: Count of emails with category_id = 'important'
 * - missed_emails: Count of unread emails (is_read = false) in INBOX
 * - payments_bills: Count of emails with category_id = 'payments'
 * - invoices: Count of emails with category_id = 'invoices'
 * - subscriptions: Count of emails with category_id = 'subscriptions'
 * - upcoming_meetings: Count of upcoming calendar events (start time >= now)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user - throws if not authenticated
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const supabase = getSupabaseServerClient();

    // Get all emails for this user from email_queue
    // Filter by INBOX label and not deleted
    const { data: emails, error: emailsError } = await supabase
      .from("email_queue")
      .select("category_id, is_read, queue_status, deleted_at")
      .eq("user_id", userId)
      .contains("gmail_labels", ["INBOX"])
      .is("deleted_at", null);

    if (emailsError) {
      console.error("Error fetching email stats:", emailsError);
      return NextResponse.json(
        { error: "Failed to fetch email stats" },
        { status: 500 }
      );
    }

    // Calculate email metrics from real data
    const important_emails = emails?.filter(
      (e) => e.category_id === "important" && e.queue_status !== "archived"
    ).length || 0;

    const missed_emails = emails?.filter(
      (e) => !e.is_read && e.queue_status !== "archived"
    ).length || 0;

    const payments_bills = emails?.filter(
      (e) => e.category_id === "payments" && e.queue_status !== "archived"
    ).length || 0;

    const invoices = emails?.filter(
      (e) => e.category_id === "invoices" && e.queue_status !== "archived"
    ).length || 0;

    const subscriptions = emails?.filter(
      (e) => e.category_id === "subscriptions" && e.queue_status !== "archived"
    ).length || 0;

    // Get workspace for calendar events query
    const workspace = await getOrCreateWorkspace(userId);

    // Get upcoming calendar events (start_at >= now)
    const now = new Date().toISOString();
    const { data: calendarEvents, error: calendarError } = await supabase
      .from("sync_calendar_events")
      .select("id, start_at")
      .eq("workspace_id", workspace.id)
      .gte("start_at", now);

    if (calendarError) {
      console.error("Error fetching calendar events:", calendarError);
      // Don't fail the whole request if calendar query fails, just return 0
    }

    const upcoming_meetings = calendarEvents?.length || 0;

    return NextResponse.json({
      ok: true,
      data: {
        important_emails,
        missed_emails,
        payments_bills,
        invoices,
        subscriptions,
        upcoming_meetings,
      },
    });
  } catch (error: any) {
    // Handle authentication errors
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("Error in sync stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync stats" },
      { status: 500 }
    );
  }
}

