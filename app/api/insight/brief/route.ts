import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { DailyBrief } from "@/types";
import { mockCalls, mockEmails, mockMediaItems } from "@/lib/data";

// Helper function to fetch Aloha data (calls, appointments, deadlines)
async function fetchAlohaData() {
  // In production, this would query the actual Aloha agent data
  // For now, we'll use mock data and stats
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

  // Get recent calls and appointments
  const recentCalls = mockCalls.slice(0, 5);
  const importantCalls = recentCalls.filter((c) => c.outcome === "missed" || c.followUp);
  
  return {
    calls: {
      total: latestStats.alpha_calls_total,
      missed: latestStats.alpha_calls_missed,
      recent: recentCalls,
    },
    appointments: latestStats.alpha_appointments,
    deadlines: importantCalls.map((c) => ({
      id: c.id,
      description: c.followUp,
      dueDate: new Date().toISOString(),
    })),
    conflicts: [], // Would check calendar for conflicts
  };
}

// Helper function to fetch Sync data (emails, tasks, reminders)
async function fetchSyncData() {
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

  // Get important emails
  const importantEmails = mockEmails.filter((e) => e.categoryId === "important" || e.status === "needs_reply");
  const paymentEmails = mockEmails.filter((e) => e.categoryId === "payments" || e.categoryId === "invoices");

  return {
    importantEmails: latestStats.xi_important_emails,
    unreadEmails: latestStats.xi_missed_emails,
    payments: latestStats.xi_payments_bills,
    invoices: latestStats.xi_invoices,
    tasks: importantEmails.map((e) => ({
      id: e.id,
      description: `Reply to: ${e.subject}`,
      priority: e.status === "needs_reply" ? "high" as const : "medium" as const,
    })),
    reminders: paymentEmails.map((e) => ({
      id: e.id,
      message: `${e.subject} - ${e.sender}`,
      type: e.categoryId === "payments" ? "payment" as const : "deadline" as const,
    })),
  };
}

// Helper function to fetch Studio data (metrics, anomalies, performance)
async function fetchStudioData() {
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

  // Calculate metrics from media items
  const totalImpressions = mockMediaItems.reduce((sum, item) => sum + (item.impressions || 0), 0);
  const totalLikes = mockMediaItems.reduce((sum, item) => sum + (item.likes || 0), 0);
  const avgEngagement = mockMediaItems.length > 0 
    ? (totalLikes / totalImpressions) * 100 
    : 0;

  return {
    mediaEdits: latestStats.mu_media_edits,
    metrics: {
      impressions: totalImpressions,
      likes: totalLikes,
      engagement: avgEngagement,
    },
    anomalies: avgEngagement < 2 ? ["Low engagement rate detected"] : [],
    performance: {
      trend: avgEngagement > 3 ? "up" as const : avgEngagement < 1.5 ? "down" as const : "stable" as const,
      insight: avgEngagement > 3 
        ? "Strong engagement on recent posts"
        : avgEngagement < 1.5
        ? "Engagement below average - consider content refresh"
        : "Engagement stable",
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: { language?: string } = await request.json().catch(() => ({}));
    const { language } = body;
    // Note: Language parameter is accepted but not yet used in this endpoint.
    // Future enhancement: Generate brief content in the user's preferred language.
    
    // Fetch data from all agents
    const [alohaData, syncData, studioData] = await Promise.all([
      fetchAlohaData(),
      fetchSyncData(),
      fetchStudioData(),
    ]);

    // Generate top 5 priorities
    const topPriorities = [
      ...alohaData.deadlines.slice(0, 2).map((d) => d.description),
      ...syncData.tasks.slice(0, 2).map((t) => t.description),
      studioData.anomalies.length > 0 ? studioData.anomalies[0] : "Review media performance metrics",
    ].slice(0, 5);

    // Generate action items
    const actionItems = [
      ...syncData.tasks.map((task) => ({
        id: `task-${task.id}`,
        description: task.description,
        agent: "sync" as const,
        priority: task.priority,
      })),
      ...alohaData.deadlines.map((deadline) => ({
        id: `deadline-${deadline.id}`,
        description: deadline.description,
        agent: "aloha" as const,
        priority: "high" as const,
      })),
    ].slice(0, 10);

    // Generate alerts
    const alerts = [
      ...alohaData.calls.missed > 0 ? [{
        id: "alert-missed-calls",
        type: "deadline" as const,
        message: `${alohaData.calls.missed} missed calls need follow-up`,
        agent: "aloha" as const,
      }] : [],
      ...syncData.payments > 0 ? [{
        id: "alert-payments",
        type: "payment" as const,
        message: `${syncData.payments} payment-related emails need attention`,
        agent: "sync" as const,
      }] : [],
      ...syncData.invoices > 0 ? [{
        id: "alert-invoices",
        type: "deadline" as const,
        message: `${syncData.invoices} invoices to process`,
        agent: "sync" as const,
      }] : [],
      ...studioData.anomalies.map((anomaly, idx) => ({
        id: `alert-studio-${idx}`,
        type: "deadline" as const,
        message: anomaly,
        agent: "studio" as const,
      })),
    ];

    // Calendar issues (would check actual calendar)
    const calendarIssues: DailyBrief["calendarIssues"] = [];

    // Metric insights
    const metricInsights: DailyBrief["metricInsights"] = [
      {
        agent: "aloha",
        metric: "Calls",
        value: alohaData.calls.total,
        trend: alohaData.calls.missed > alohaData.calls.total * 0.1 ? "down" : "up",
        insight: alohaData.calls.missed > 0 
          ? `${alohaData.calls.missed} missed calls need attention`
          : "All calls handled successfully",
      },
      {
        agent: "sync",
        metric: "Important Emails",
        value: syncData.importantEmails,
        trend: syncData.importantEmails > 5 ? "up" : "stable",
        insight: `${syncData.importantEmails} important emails flagged`,
      },
      {
        agent: "studio",
        metric: "Engagement Rate",
        value: `${studioData.metrics.engagement.toFixed(1)}%`,
        trend: studioData.performance.trend,
        insight: studioData.performance.insight,
      },
    ];

    // Suggested corrections
    const suggestedCorrections: DailyBrief["suggestedCorrections"] = [
      ...alohaData.calls.missed > 0 ? [{
        id: "correction-aloha-calls",
        issue: "Missed calls detected",
        suggestion: "Review call routing and availability settings",
        agent: "aloha" as const,
      }] : [],
      ...syncData.unreadEmails > 5 ? [{
        id: "correction-sync-emails",
        issue: "High unread email count",
        suggestion: "Prioritize email triage and response automation",
        agent: "sync" as const,
      }] : [],
      ...studioData.anomalies.map((anomaly, idx) => ({
        id: `correction-studio-${idx}`,
        issue: anomaly,
        suggestion: "Review content strategy and posting schedule",
        agent: "studio" as const,
      })),
    ];

    // Follow-up list
    const followUpList: DailyBrief["followUpList"] = [
      ...alohaData.deadlines.map((deadline) => ({
        id: `followup-${deadline.id}`,
        item: deadline.description,
        agent: "aloha" as const,
        priority: "high" as const,
      })),
      ...syncData.tasks.slice(0, 3).map((task) => ({
        id: `followup-${task.id}`,
        item: task.description,
        agent: "sync" as const,
        priority: task.priority,
      })),
    ];

    const brief: DailyBrief = {
      title: "Daily Command Brief",
      generatedAt: new Date().toISOString(),
      topPriorities,
      actionItems,
      alerts,
      calendarIssues,
      metricInsights,
      suggestedCorrections,
      followUpList,
    };

    return NextResponse.json({ ok: true, data: brief });
  } catch (error: any) {
    console.error("Error generating brief:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to generate brief" },
      { status: 500 }
    );
  }
}

