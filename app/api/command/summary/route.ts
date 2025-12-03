/**
 * Daily Command Summary API
 * 
 * GET /api/command/summary
 * 
 * Returns a comprehensive daily brief for the dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIdFromAuth } from "@/lib/workspace-helpers";
import { getMemoryFacts, getImportantRelationships } from "@/lib/insight/memory";
import { openai } from "@/lib/openai";

export interface CommandSummary {
  brief?: {
    title: string;
    sections: { title: string; bulletPoints: string[] }[];
  };
  insightScore?: {
    value: number;
    trend?: "up" | "down" | "flat";
    delta?: number;
  };
  topInsights: {
    id: string;
    title: string;
    severity: string;
    personalized: boolean;
    createdAt: string;
  }[];
  recommendedActions: {
    id: string;
    label: string;
    description?: string;
    source: string;
  }[];
  criticalEmails: {
    id: string;
    subject: string;
    from: string;
    receivedAt: string;
    isImportant: boolean;
  }[];
  importantCalls: {
    id: string;
    contactIdentifier?: string;
    contactName?: string;
    missed: boolean;
    sentiment?: number;
    importanceScore?: number;
    time: string;
  }[];
  calendarToday: {
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const workspaceId = await getWorkspaceIdFromAuth();
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch today's insights
    const { data: insights } = await supabase
      .from("insights")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch today's stats
    const { data: todayStats } = await supabase
      .from("agent_stats_daily")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today.toISOString().split("T")[0])
      .single();

    // Fetch yesterday's stats for comparison
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const { data: yesterdayStats } = await supabase
      .from("agent_stats_daily")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", yesterday.toISOString().split("T")[0])
      .single();

    // Fetch important emails (from email_summaries or gmail_emails)
    const { data: emails } = await supabase
      .from("email_summaries")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_important", true)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch missed/important calls
    const { data: calls } = await supabase
      .from("calls")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString())
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch today's calendar events
    const { data: calendarEvents } = await supabase
      .from("sync_calendar_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("start_at", today.toISOString())
      .lt("start_at", tomorrow.toISOString())
      .order("start_at", { ascending: true });

    // Get memory facts and relationships for personalization
    const [memoryFacts, relationships] = await Promise.all([
      getMemoryFacts(workspaceId, 0.5),
      getImportantRelationships(workspaceId, 60),
    ]);

    // Calculate insight score
    const insightScore = todayStats?.beta_insights_count || 0;
    const prevInsightScore = yesterdayStats?.beta_insights_count || 0;
    const delta = insightScore - prevInsightScore;
    const trend: "up" | "down" | "flat" =
      delta > 0 ? "up" : delta < 0 ? "down" : "flat";

    // Build top insights
    const topInsights = (insights || []).slice(0, 5).map((insight) => ({
      id: insight.id,
      title: insight.title,
      severity: insight.severity,
      personalized: insight.metadata?.personalized || false,
      createdAt: insight.created_at,
    }));

    // Build critical emails
    const criticalEmails = (emails || []).slice(0, 5).map((email) => ({
      id: email.id,
      subject: email.subject || "No subject",
      from: email.sender || email.from_address || "Unknown",
      receivedAt: email.created_at,
      isImportant: email.is_important || false,
    }));

    // Build important calls (missed or from important contacts)
    const importantCalls = (calls || [])
      .filter((call) => {
        const isMissed = call.outcome === "missed";
        const contactId = call.caller_phone_number || call.caller_email;
        const relationship = relationships.find(
          (r) => r.entityIdentifier === contactId
        );
        return isMissed || (relationship && relationship.importanceScore >= 70);
      })
      .slice(0, 5)
      .map((call) => {
        const contactId = call.caller_phone_number || call.caller_email;
        const relationship = relationships.find(
          (r) => r.entityIdentifier === contactId
        );
        return {
          id: call.id,
          contactIdentifier: contactId,
          contactName: relationship?.displayName || call.caller_name,
          missed: call.outcome === "missed",
          sentiment: call.sentiment_score,
          importanceScore: relationship?.importanceScore,
          time: call.created_at,
        };
      });

    // Build calendar events
    const calendarToday = (calendarEvents || [])
      .filter((event) => event.start_at) // Only include events with a start time
      .map((event) => ({
        id: event.id,
        title: event.summary || "Untitled Event",
        start: event.start_at || new Date().toISOString(),
        end: event.end_at || event.start_at || new Date().toISOString(),
        location: event.location || undefined,
      }));

    // Generate recommended actions from insights, emails, and calls
    const recommendedActions: CommandSummary["recommendedActions"] = [];

    // Actions from insights
    insights?.forEach((insight) => {
      if (insight.actions && Array.isArray(insight.actions)) {
        insight.actions.forEach((action: any, idx: number) => {
          recommendedActions.push({
            id: `insight-${insight.id}-${idx}`,
            label: action.label || action.type || "Take action",
            description: action.description,
            source: "insight",
          });
        });
      }
    });

    // Actions from missed calls
    calls
      ?.filter((c) => c.outcome === "missed")
      .slice(0, 3)
      .forEach((call) => {
        recommendedActions.push({
          id: `call-${call.id}`,
          label: `Follow up with ${call.caller_name || "caller"}`,
          description: call.summary || "Missed call requires follow-up",
          source: "aloha",
        });
      });

    // Actions from important emails
    emails
      ?.filter((e) => !e.is_read)
      .slice(0, 3)
      .forEach((email) => {
        recommendedActions.push({
          id: `email-${email.id}`,
          label: `Reply to ${email.sender || email.from_address}`,
          description: email.subject || "Important email needs response",
          source: "sync",
        });
      });

    // Generate brief using LLM if we have data
    let brief: CommandSummary["brief"] | undefined;
    if (insights && insights.length > 0) {
      try {
        const context = {
          stats: todayStats,
          insights: topInsights,
          emails: criticalEmails.length,
          calls: importantCalls.length,
          calendar: calendarToday.length,
        };

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are a business intelligence assistant. Generate a concise daily brief with 2-3 sections, each with 2-4 bullet points. Return JSON with title and sections array.",
            },
            {
              role: "user",
              content: `Generate today's command brief based on: ${JSON.stringify(context)}. Focus on priorities and actionable insights.`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          brief = {
            title: parsed.title || "Today's Command Brief",
            sections: parsed.sections || [],
          };
        }
      } catch (llmError) {
        console.error("Error generating brief:", llmError);
        // Fallback brief
        brief = {
          title: "Today's Command Brief",
          sections: [
            {
              title: "Overview",
              bulletPoints: [
                `${insightScore} insights generated today`,
                `${criticalEmails.length} important emails`,
                `${importantCalls.length} important calls`,
              ],
            },
          ],
        };
      }
    }

    const summary: CommandSummary = {
      brief,
      insightScore: {
        value: insightScore,
        trend,
        delta: Math.abs(delta),
      },
      topInsights,
      recommendedActions: recommendedActions.slice(0, 10),
      criticalEmails,
      importantCalls,
      calendarToday,
    };

    return NextResponse.json({ ok: true, data: summary });
  } catch (error: any) {
    console.error("Error in command summary endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

