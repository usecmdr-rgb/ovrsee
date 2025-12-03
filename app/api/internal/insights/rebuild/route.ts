/**
 * POST /api/internal/insights/rebuild
 * 
 * Internal endpoint to rebuild Insights daily metrics by aggregating from existing tables
 * 
 * SECURITY: Optionally guard with internal secret or admin role
 * For now, uses service role client (internal task)
 * 
 * Input JSON (optional):
 * {
 *   "from": "2025-11-01",  // date (inclusive)
 *   "to": "2025-12-01"     // date (inclusive)
 * }
 * 
 * If not provided, defaults to last 30 days from today.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

export async function POST(request: NextRequest) {
  try {
    // Optional: Add internal secret check
    const internalSecret = request.headers.get("x-internal-secret");
    const expectedSecret = process.env.INTERNAL_INSIGHTS_SECRET;

    if (expectedSecret && internalSecret !== expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Invalid internal secret" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();
    const body = await request.json().catch(() => ({}));

    // Parse date range (default to last 30 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const fromDate = body.from ? new Date(body.from) : thirtyDaysAgo;
    const toDate = body.to ? new Date(body.to) : today;

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    // Get all workspaces
    const { data: workspaces, error: workspacesError } = await supabase
      .from("workspaces")
      .select("id");

    if (workspacesError) {
      console.error("[Insights Rebuild] Error fetching workspaces:", workspacesError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch workspaces" },
        { status: 500 }
      );
    }

    let workspacesProcessed = 0;
    let daysProcessed = 0;

    // Process each workspace
    for (const workspace of workspaces || []) {
      const workspaceId = workspace.id;

      // Generate all dates in range
      const dates: Date[] = [];
      const currentDate = new Date(fromDate);
      while (currentDate <= toDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Process each date
      for (const date of dates) {
        const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);

        // 1) Aggregate call metrics from call_logs
        const { data: calls, error: callsError } = await supabase
          .from("call_logs")
          .select("id, status, duration_seconds, has_voicemail")
          .eq("workspace_id", workspaceId)
          .gte("started_at", dateStart.toISOString())
          .lte("started_at", dateEnd.toISOString());

        if (callsError) {
          console.error(`[Insights Rebuild] Error fetching calls for ${workspaceId} on ${dateStr}:`, callsError);
          continue;
        }

        const callsTotal = calls?.length || 0;
        const callsAnswered = calls?.filter(c => c.status === "completed" || c.status === "in-progress").length || 0;
        const callsMissed = calls?.filter(c => c.status === "no-answer" || c.status === "missed" || c.status === "busy").length || 0;
        const callsVoicemail = calls?.filter(c => c.has_voicemail).length || 0;
        
        const durationSeconds = calls?.map(c => c.duration_seconds || 0).reduce((a, b) => a + b, 0) || 0;
        const callsDurationSecondsTotal = durationSeconds;
        const callsDurationSecondsAvg = callsTotal > 0 ? durationSeconds / callsTotal : 0;

        // 2) Voicemails
        const { data: voicemails, error: voicemailsError } = await supabase
          .from("voicemail_messages")
          .select("id")
          .eq("workspace_id", workspaceId)
          .gte("created_at", dateStart.toISOString())
          .lte("created_at", dateEnd.toISOString());

        if (voicemailsError) {
          console.error(`[Insights Rebuild] Error fetching voicemails for ${workspaceId} on ${dateStr}:`, voicemailsError);
        }

        const voicemailsTotal = voicemails?.length || 0;

        // 3) Emails from sync_email_messages
        // Query emails where internal_date or created_at falls within the date range
        // Fetch emails that might match (using created_at as fallback) and filter in memory
        const { data: emails, error: emailsError } = await supabase
          .from("sync_email_messages")
          .select("id, from_address, labels, is_important, internal_date, created_at")
          .eq("workspace_id", workspaceId)
          .gte("created_at", dateStart.toISOString())
          .lte("created_at", dateEnd.toISOString());

        if (emailsError) {
          console.error(`[Insights Rebuild] Error fetching emails for ${workspaceId} on ${dateStr}:`, emailsError);
        }

        // Filter emails by date (use internal_date if available, otherwise created_at)
        // This ensures we match emails by their actual date, not just when they were synced
        const emailsForDate = (emails || []).filter(email => {
          const emailDate = email.internal_date ? new Date(email.internal_date) : new Date(email.created_at);
          const emailDateOnly = new Date(emailDate);
          emailDateOnly.setHours(0, 0, 0, 0);
          const targetDateOnly = new Date(date);
          targetDateOnly.setHours(0, 0, 0, 0);
          return emailDateOnly.getTime() === targetDateOnly.getTime();
        });

        // Heuristics for received vs sent
        // For now, treat all as received (we don't have workspace domain info easily accessible)
        const emailsReceivedTotal = emailsForDate.length;
        const emailsSentTotal = 0; // TODO: Implement when we have workspace domain info

        // Important emails: check labels or is_important flag
        const emailsImportantTotal = emailsForDate.filter(email => {
          if (email.is_important) return true;
          if (email.labels && Array.isArray(email.labels)) {
            return email.labels.some((label: string) => 
              label.toLowerCase().includes("important")
            );
          }
          return false;
        }).length;

        // 4) Calendar / meetings from sync_calendar_events
        const { data: events, error: eventsError } = await supabase
          .from("sync_calendar_events")
          .select("id, start_at, end_at")
          .eq("workspace_id", workspaceId)
          .gte("start_at", dateStart.toISOString())
          .lte("start_at", dateEnd.toISOString());

        if (eventsError) {
          console.error(`[Insights Rebuild] Error fetching calendar events for ${workspaceId} on ${dateStr}:`, eventsError);
        }

        const meetingsTotal = events?.length || 0;
        
        // Calculate total duration in minutes
        let meetingsDurationMinutes = 0;
        (events || []).forEach(event => {
          if (event.start_at) {
            const start = new Date(event.start_at);
            const end = event.end_at ? new Date(event.end_at) : start;
            const durationMs = end.getTime() - start.getTime();
            const durationMinutes = durationMs / (1000 * 60);
            meetingsDurationMinutes += durationMinutes;
          }
        });

        // 5) Studio metrics
        // Studio edits
        const { data: editEvents, error: editEventsError } = await supabase
          .from("studio_edit_events")
          .select("id")
          .eq("workspace_id", workspaceId)
          .gte("created_at", dateStart.toISOString())
          .lte("created_at", dateEnd.toISOString());

        if (editEventsError) {
          console.error(`[Insights Rebuild] Error fetching studio edit events for ${workspaceId} on ${dateStr}:`, editEventsError);
        }

        const studioEditsTotal = editEvents?.length || 0;

        // Studio posts
        const { data: posts, error: postsError } = await supabase
          .from("studio_social_posts")
          .select("id")
          .eq("workspace_id", workspaceId)
          .gte("posted_at", dateStart.toISOString())
          .lte("posted_at", dateEnd.toISOString());

        if (postsError) {
          console.error(`[Insights Rebuild] Error fetching studio posts for ${workspaceId} on ${dateStr}:`, postsError);
        }

        const studioPostsTotal = posts?.length || 0;

        // Studio metrics (views, likes, comments)
        const postIds = posts?.map(p => p.id) || [];
        let studioViewsTotal = 0;
        let studioLikesTotal = 0;
        let studioCommentsTotal = 0;

        if (postIds.length > 0) {
          const { data: metrics, error: metricsError } = await supabase
            .from("studio_social_post_metrics")
            .select("views, likes, comments")
            .in("social_post_id", postIds)
            .lte("captured_at", dateEnd.toISOString());

          if (!metricsError && metrics) {
            // Get latest metrics per post (simplified: sum all metrics captured on or before this date)
            // In a real implementation, we'd want the latest metric per post
            metrics.forEach(metric => {
              studioViewsTotal += metric.views || 0;
              studioLikesTotal += metric.likes || 0;
              studioCommentsTotal += metric.comments || 0;
            });
          }
        }

        // Upsert metrics
        const { error: upsertError } = await supabase
          .from("insights_daily_metrics")
          .upsert({
            workspace_id: workspaceId,
            date: dateStr,
            calls_total: callsTotal,
            calls_answered: callsAnswered,
            calls_missed: callsMissed,
            calls_voicemail: callsVoicemail,
            calls_duration_seconds_total: callsDurationSecondsTotal,
            calls_duration_seconds_avg: Math.round(callsDurationSecondsAvg * 100) / 100,
            voicemails_total: voicemailsTotal,
            emails_received_total: emailsReceivedTotal,
            emails_sent_total: emailsSentTotal,
            emails_important_total: emailsImportantTotal,
            meetings_total: meetingsTotal,
            meetings_duration_minutes: Math.round(meetingsDurationMinutes * 100) / 100,
            studio_edits_total: studioEditsTotal,
            studio_posts_total: studioPostsTotal,
            studio_views_total: studioViewsTotal,
            studio_likes_total: studioLikesTotal,
            studio_comments_total: studioCommentsTotal,
          }, {
            onConflict: "workspace_id,date"
          });

        if (upsertError) {
          console.error(`[Insights Rebuild] Error upserting metrics for ${workspaceId} on ${dateStr}:`, upsertError);
        } else {
          daysProcessed++;
        }
      }

      workspacesProcessed++;
    }

    return NextResponse.json({
      ok: true,
      data: {
        from: fromDate.toISOString().split("T")[0],
        to: toDate.toISOString().split("T")[0],
        workspacesProcessed,
        daysProcessed,
      },
    });
  } catch (error: any) {
    console.error("[Insights Rebuild] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to rebuild insights" },
      { status: 500 }
    );
  }
}

