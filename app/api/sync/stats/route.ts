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
 * - important_emails: Count of emails with category = 'important'
 * - missed_emails: Count of unread emails (is_read = false) in INBOX
 * - payments_bills: Count of emails with category = 'payment_bill'
 * - invoices: Count of emails with category = 'invoice'
 * - subscriptions: Count of emails with category = 'marketing' (subscriptions fall under marketing)
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
    // Note: category column may not exist if migration hasn't run
    const { data: emails, error: emailsError } = await supabase
      .from("email_queue")
      .select("category, is_read, queue_status, deleted_at")
      .eq("user_id", userId)
      .contains("gmail_labels", ["INBOX"])
      .is("deleted_at", null);

    if (emailsError) {
      // If error is about missing category column, try without it
      if (emailsError.code === "42703" && emailsError.message?.includes("category")) {
        console.warn("[Sync Stats] category column missing, fetching without category");
        const { data: fallbackEmails, error: fallbackError } = await supabase
          .from("email_queue")
          .select("is_read, queue_status, deleted_at")
          .eq("user_id", userId)
          .contains("gmail_labels", ["INBOX"])
          .is("deleted_at", null);
        
        if (fallbackError) {
          console.error("Error fetching email stats:", fallbackError);
          return NextResponse.json(
            { error: "Failed to fetch email stats" },
            { status: 500 }
          );
        }
        
        // Calculate metrics without category
        const important_emails = 0; // Can't determine without category
        const missed_emails = fallbackEmails?.filter(
          (e) => !e.is_read && e.queue_status !== "archived"
        ).length || 0;
        const payments_bills = 0;
        const invoices = 0;
        const subscriptions = 0;
        
        // Get workspace for calendar events
        const workspace = await getOrCreateWorkspace(userId);
        const now = new Date().toISOString();
        const { data: calendarEvents } = await supabase
          .from("sync_calendar_events")
          .select("id, start_at")
          .eq("workspace_id", workspace.id)
          .gte("start_at", now);
        
        return NextResponse.json({
          ok: true,
          data: {
            important_emails,
            missed_emails,
            payments_bills,
            invoices,
            subscriptions,
            upcoming_meetings: calendarEvents?.length || 0,
          },
          warning: "category column not found - run migrations to enable category-based stats"
        });
      }
      
      console.error("Error fetching email stats:", emailsError);
      return NextResponse.json(
        { error: "Failed to fetch email stats" },
        { status: 500 }
      );
    }

    // Calculate email metrics from real data
    const important_emails = emails?.filter(
      (e: any) => e.category === "important" && e.queue_status !== "archived"
    ).length || 0;

    const missed_emails = emails?.filter(
      (e: any) => !e.is_read && e.queue_status !== "archived"
    ).length || 0;

    const payments_bills = emails?.filter(
      (e: any) => e.category === "payment_bill" && e.queue_status !== "archived"
    ).length || 0;

    const invoices = emails?.filter(
      (e: any) => e.category === "invoice" && e.queue_status !== "archived"
    ).length || 0;

    const subscriptions = emails?.filter(
      (e: any) => e.category === "marketing" && e.queue_status !== "archived"
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
      // PGRST205 = table not found in schema cache (e.g. migration not applied yet)
      // Log other errors, but silently ignore this one so the endpoint still works.
      if (calendarError.code !== "PGRST205") {
        console.error("Error fetching calendar events:", calendarError);
      }
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

