/**
 * POST /api/insights/brief
 * 
 * Generates a daily command brief based on insights data
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { openai } from "@/lib/openai";
import { z } from "zod";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const requestSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

type RequestBody = z.infer<typeof requestSchema>;

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

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request" },
        { status: 400, headers: responseHeaders }
      );
    }

    const { from, to } = validation.data;

    // Resolve date range (default to last 7 days)
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    let fromDate: Date;
    let toDate: Date;

    if (from && to) {
      fromDate = new Date(from);
      toDate = new Date(to);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return NextResponse.json(
          { ok: false, error: "Invalid date format. Use YYYY-MM-DD" },
          { status: 400, headers: responseHeaders }
        );
      }

      if (fromDate > toDate) {
        return NextResponse.json(
          { ok: false, error: "From date must be before to date" },
          { status: 400, headers: responseHeaders }
        );
      }
    } else {
      fromDate = sevenDaysAgo;
      toDate = today;
    }

    const fromStr = fromDate.toISOString().split("T")[0];
    const toStr = toDate.toISOString().split("T")[0];

    // Fetch daily metrics
    const { data: dailyMetrics, error: metricsError } = await supabaseClient
      .from("insights_daily_metrics")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("date", fromStr)
      .lte("date", toStr)
      .order("date", { ascending: true });

    if (metricsError) {
      console.error("[Insights Brief] Error fetching daily metrics:", metricsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch metrics" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Fetch sample data from raw tables (limited to keep prompt size reasonable)
    const sampleLimit = 20;

    // Recent calls
    const { data: recentCalls } = await supabaseClient
      .from("call_logs")
      .select("id, started_at, status, duration_seconds")
      .eq("workspace_id", workspaceId)
      .gte("started_at", fromDate.toISOString())
      .lte("started_at", toDate.toISOString())
      .order("started_at", { ascending: false })
      .limit(sampleLimit);

    // Recent emails
    const { data: recentEmails } = await supabaseClient
      .from("sync_email_messages")
      .select("id, subject, from_address, internal_date, created_at")
      .eq("workspace_id", workspaceId)
      .or(`and(internal_date.gte.${fromDate.toISOString()},internal_date.lte.${toDate.toISOString()}),and(internal_date.is.null,created_at.gte.${fromDate.toISOString()},created_at.lte.${toDate.toISOString()})`)
      .order("internal_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(sampleLimit);

    // Recent calendar events
    const { data: recentEvents } = await supabaseClient
      .from("sync_calendar_events")
      .select("id, summary, start_at, end_at")
      .eq("workspace_id", workspaceId)
      .gte("start_at", fromDate.toISOString())
      .lte("start_at", toDate.toISOString())
      .order("start_at", { ascending: false })
      .limit(sampleLimit);

    // Recent Studio posts with metrics
    const { data: recentPosts } = await supabaseClient
      .from("studio_social_posts")
      .select("id, caption, posted_at")
      .eq("workspace_id", workspaceId)
      .gte("posted_at", fromDate.toISOString())
      .lte("posted_at", toDate.toISOString())
      .order("posted_at", { ascending: false })
      .limit(10);

    // Get metrics for posts
    let postMetrics: Record<string, { views: number; likes: number; comments: number }> = {};
    if (recentPosts && recentPosts.length > 0) {
      const postIds = recentPosts.map((p) => p.id);
      const { data: metrics } = await supabaseClient
        .from("studio_social_post_metrics")
        .select("social_post_id, views, likes, comments, captured_at")
        .in("social_post_id", postIds)
        .order("captured_at", { ascending: false });

      // Get latest metrics per post
      if (metrics) {
        const latestMetrics = new Map<string, typeof metrics[0]>();
        for (const metric of metrics) {
          if (!latestMetrics.has(metric.social_post_id)) {
            latestMetrics.set(metric.social_post_id, metric);
          }
        }
        for (const [postId, metric] of latestMetrics) {
          postMetrics[postId] = {
            views: metric.views || 0,
            likes: metric.likes || 0,
            comments: metric.comments || 0,
          };
        }
      }
    }

    // Build data snapshot
    const snapshot = {
      range: {
        from: fromStr,
        to: toStr,
      },
      dailyMetrics: (dailyMetrics || []).map((m) => ({
        date: m.date,
        calls_total: m.calls_total,
        calls_answered: m.calls_answered,
        calls_missed: m.calls_missed,
        calls_voicemail: m.calls_voicemail,
        voicemails_total: m.voicemails_total,
        emails_received_total: m.emails_received_total,
        emails_sent_total: m.emails_sent_total,
        emails_important_total: m.emails_important_total,
        meetings_total: m.meetings_total,
        meetings_duration_minutes: m.meetings_duration_minutes,
        studio_edits_total: m.studio_edits_total,
        studio_posts_total: m.studio_posts_total,
        studio_views_total: m.studio_views_total,
        studio_likes_total: m.studio_likes_total,
        studio_comments_total: m.studio_comments_total,
      })),
      sample: {
        calls: (recentCalls || []).map((c) => ({
          id: c.id,
          started_at: c.started_at,
          status: c.status,
          duration_seconds: c.duration_seconds,
        })),
        emails: (recentEmails || []).map((e) => ({
          id: e.id,
          subject: e.subject,
          from_address: e.from_address,
          internal_date: e.internal_date || e.created_at,
        })),
        events: (recentEvents || []).map((e) => ({
          id: e.id,
          summary: e.summary,
          start_at: e.start_at,
          end_at: e.end_at,
        })),
        studioPosts: (recentPosts || []).map((p) => ({
          id: p.id,
          caption: p.caption,
          posted_at: p.posted_at,
          metrics: postMetrics[p.id] || { views: 0, likes: 0, comments: 0 },
        })),
      },
    };

    // Build LLM prompt
    const systemMessage: ChatCompletionMessageParam = {
      role: "system",
      content: `You are a Daily Command Brief generator for OVRSEE, an AI-powered business intelligence assistant. Your role is to analyze business metrics and generate concise, actionable briefs.

CRITICAL RULES:
- You MUST ONLY use the provided data snapshot. Do not fabricate or guess metrics.
- Always reference the date range explicitly (e.g., "Between ${fromStr} and ${toStr}...").
- If there is no data in the snapshot, clearly state: "There is no activity in this period yet."
- Structure your brief with:
  1. A brief summary of the period
  2. Key changes and trends
  3. Priorities and risks
  4. 3-6 specific action items

Keep the tone professional, concise, and actionable. Use bullet points for action items.`,
    };

    const userMessage: ChatCompletionMessageParam = {
      role: "user",
      content: `Generate a daily command brief for this snapshot.

Data snapshot (date range: ${fromStr} to ${toStr}):
${JSON.stringify(snapshot, null, 2)}

${(dailyMetrics || []).length === 0 ? "IMPORTANT: The snapshot has no data. State clearly that there is no activity in this period yet." : "Please generate a comprehensive brief with summary, changes, priorities, risks, and action items."}`,
    };

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [systemMessage, userMessage],
      temperature: 0.3,
    });

    const brief = response.choices[0]?.message?.content || "I couldn't generate a brief. Please try again.";

    // Log insight event (ignore errors, don't break the response)
    try {
      await supabaseClient
        .from("insight_events")
        .insert({
          workspace_id: workspaceId,
          type: "daily_brief",
          source: "daily_brief",
        });
    } catch (eventError) {
      console.error("[Insights Brief] Error logging insight event:", eventError);
      // Continue without failing the request
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          brief,
          range: {
            from: fromStr,
            to: toStr,
          },
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Insights Brief] Error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to generate brief" },
      { status: 500 }
    );
  }
}




