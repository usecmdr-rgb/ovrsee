import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { InsightRequest, InsightResponse } from "@/types";
import { mockCalls, mockEmails, mockMediaItems } from "@/lib/data";

// Helper to query Aloha for insights
async function queryAloha(question: string, timeframe: string) {
  const supabase = getSupabaseServerClient();
  const { data: stats } = await supabase
    .from("agent_stats_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const latestStats = stats || {
    alpha_calls_total: 0,
    alpha_calls_missed: 0,
    alpha_appointments: 0,
  };

  const missedCalls = latestStats.alpha_calls_missed;
  const totalCalls = latestStats.alpha_calls_total;
  const appointments = latestStats.alpha_appointments;

  return {
    data: {
      calls: { total: totalCalls, missed: missedCalls },
      appointments,
      recentCalls: mockCalls.slice(0, 3),
    },
    insights: [
      missedCalls > 0 
        ? `You have ${missedCalls} missed calls that need follow-up`
        : "All calls handled successfully",
      appointments > 0 
        ? `${appointments} new appointments scheduled`
        : "No new appointments today",
    ],
    decisions: missedCalls > 0 ? [{
      id: "decision-aloha-calls",
      decision: "Follow up on missed calls",
      context: `${missedCalls} calls need attention`,
      urgency: "high" as const,
    }] : [],
    risks: missedCalls > totalCalls * 0.1 ? [{
      id: "risk-aloha-missed",
      risk: "High missed call rate",
      severity: "medium" as const,
      agent: "aloha" as const,
    }] : [],
  };
}

// Helper to query Sync for insights
async function querySync(question: string, timeframe: string) {
  const supabase = getSupabaseServerClient();
  const { data: stats } = await supabase
    .from("agent_stats_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const latestStats = stats || {
    xi_important_emails: 0,
    xi_missed_emails: 0,
    xi_payments_bills: 0,
    xi_invoices: 0,
  };

  const importantEmails = latestStats.xi_important_emails;
  const unreadEmails = latestStats.xi_missed_emails;
  const payments = latestStats.xi_payments_bills;
  const invoices = latestStats.xi_invoices;

  const needsReply = mockEmails.filter((e) => e.status === "needs_reply");
  const paymentEmails = mockEmails.filter((e) => e.categoryId === "payments" || e.categoryId === "invoices");

  return {
    data: {
      importantEmails,
      unreadEmails,
      payments,
      invoices,
      needsReply: needsReply.length,
    },
    insights: [
      importantEmails > 0 
        ? `${importantEmails} important emails flagged for attention`
        : "No urgent emails",
      unreadEmails > 5 
        ? `${unreadEmails} unread emails need triage`
        : "Inbox is well managed",
      payments > 0 || invoices > 0
        ? `${payments + invoices} payment-related items need processing`
        : "No pending payments",
    ],
    decisions: [
      ...needsReply.slice(0, 2).map((e, idx) => ({
        id: `decision-sync-${e.id}`,
        decision: `Reply to: ${e.subject}`,
        context: `From ${e.sender}`,
        urgency: "high" as const,
      })),
      ...(payments > 0 ? [{
        id: "decision-sync-payments",
        decision: "Process payment-related emails",
        context: `${payments} items need attention`,
        urgency: "medium" as const,
      }] : []),
    ],
    risks: unreadEmails > 10 ? [{
      id: "risk-sync-unread",
      risk: "High unread email backlog",
      severity: "medium" as const,
      agent: "sync" as const,
    }] : [],
  };
}

// Helper to query Studio for insights
async function queryStudio(question: string, timeframe: string) {
  const supabase = getSupabaseServerClient();
  const { data: stats } = await supabase
    .from("agent_stats_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const latestStats = stats || {
    mu_media_edits: 0,
  };

  const totalImpressions = mockMediaItems.reduce((sum, item) => sum + (item.impressions || 0), 0);
  const totalLikes = mockMediaItems.reduce((sum, item) => sum + (item.likes || 0), 0);
  const avgEngagement = mockMediaItems.length > 0 
    ? (totalLikes / totalImpressions) * 100 
    : 0;

  const trend = avgEngagement > 3 ? "up" : avgEngagement < 1.5 ? "down" : "stable";

  return {
    data: {
      mediaEdits: latestStats.mu_media_edits,
      impressions: totalImpressions,
      likes: totalLikes,
      engagement: avgEngagement,
    },
    insights: [
      `Media engagement rate: ${avgEngagement.toFixed(1)}%`,
      trend === "up" 
        ? "Engagement trending upward - content performing well"
        : trend === "down"
        ? "Engagement below average - consider content refresh"
        : "Engagement stable",
    ],
    decisions: avgEngagement < 1.5 ? [{
      id: "decision-studio-engagement",
      decision: "Review and refresh content strategy",
      context: "Engagement below target",
      urgency: "medium" as const,
    }] : [],
    risks: avgEngagement < 1 ? [{
      id: "risk-studio-engagement",
      risk: "Very low engagement rate",
      severity: "high" as const,
      agent: "studio" as const,
    }] : [],
    trends: [{
      agent: "studio" as const,
      trend: `Engagement rate: ${avgEngagement.toFixed(1)}%`,
      direction: trend as "up" | "down" | "stable",
      impact: avgEngagement < 1.5 ? "high" as const : "medium" as const,
    }],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: InsightRequest & { language?: string } = await request.json();
    const { question, timeframe = "today", language } = body;
    // Note: Language parameter is accepted but not yet used in this endpoint.
    // Future enhancement: Generate insights in the user's preferred language.

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Query all agents in parallel
    const [alohaResults, syncResults, studioResults] = await Promise.all([
      queryAloha(question, timeframe),
      querySync(question, timeframe),
      queryStudio(question, timeframe),
    ]);

    // Merge insights
    const keyInsights = [
      ...alohaResults.insights,
      ...syncResults.insights,
      ...studioResults.insights,
    ];

    // Merge priority decisions
    const priorityDecisions = [
      ...alohaResults.decisions.map((d) => ({ ...d, agent: "aloha" as const })),
      ...syncResults.decisions.map((d) => ({ ...d, agent: "sync" as const })),
      ...studioResults.decisions.map((d) => ({ ...d, agent: "studio" as const })),
    ];

    // Merge trends
    const trends: InsightResponse["trends"] = [
      ...(studioResults.trends || []),
      {
        agent: "aloha" as const,
        trend: alohaResults.data.calls.missed > 0 
          ? "Missed calls need attention"
          : "Call handling optimal",
        direction: alohaResults.data.calls.missed > 0 ? "down" as const : "up" as const,
        impact: alohaResults.data.calls.missed > 0 ? "medium" as const : "low" as const,
      },
      {
        agent: "sync" as const,
        trend: syncResults.data.unreadEmails > 5
          ? "Unread email backlog growing"
          : "Email management efficient",
        direction: syncResults.data.unreadEmails > 5 ? "down" as const : "up" as const,
        impact: syncResults.data.unreadEmails > 5 ? "medium" as const : "low" as const,
      },
    ];

    // Merge risks
    const risks = [
      ...alohaResults.risks,
      ...syncResults.risks,
      ...studioResults.risks,
    ];

    // Generate recommendations
    const recommendations = [
      ...(alohaResults.data.calls.missed > 0 ? [{
        id: "rec-aloha-calls",
        recommendation: "Review call routing and availability",
        rationale: `${alohaResults.data.calls.missed} missed calls detected`,
        priority: "high" as const,
      }] : []),
      ...(syncResults.data.unreadEmails > 5 ? [{
        id: "rec-sync-emails",
        recommendation: "Prioritize email triage and response",
        rationale: `${syncResults.data.unreadEmails} unread emails need attention`,
        priority: "medium" as const,
      }] : []),
      ...(studioResults.data.engagement < 1.5 ? [{
        id: "rec-studio-content",
        recommendation: "Refresh content strategy",
        rationale: `Engagement rate at ${studioResults.data.engagement.toFixed(1)}% is below target`,
        priority: "medium" as const,
      }] : []),
    ];

    const response: InsightResponse = {
      question,
      generatedAt: new Date().toISOString(),
      keyInsights,
      priorityDecisions,
      trends,
      risks,
      recommendations,
    };

    return NextResponse.json({ ok: true, data: response });
  } catch (error: any) {
    console.error("Error generating insights:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to generate insights" },
      { status: 500 }
    );
  }
}

