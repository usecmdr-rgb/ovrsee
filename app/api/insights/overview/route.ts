import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/insights/overview
 * Get aggregated insights metrics for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const supabase = getSupabaseServerClient();

    // Initialize response with zeros
    const insights: {
      leadFunnel: Record<string, number>;
      hotLeadCount: number;
      warmLeadCount: number;
      pendingFollowUps: number;
      avgFollowUpDelayDays?: number;
      upcomingMeetings: number;
      scheduledBySyncCount?: number;
      importantThisWeek: number;
      paymentsThisWeek: number;
      missedNeedsReply: number;
      revenue: {
        pipelineValueByStage: Record<string, number>;
        totalOpenPipelineValue: number;
        totalWonRevenueLast30Days: number;
        totalWonRevenueAllTime: number;
      };
    } = {
      leadFunnel: {
        new: 0,
        cold: 0,
        qualified: 0,
        warm: 0,
        negotiating: 0,
        ready_to_close: 0,
        won: 0,
        lost: 0,
      },
      hotLeadCount: 0,
      warmLeadCount: 0,
      pendingFollowUps: 0,
      upcomingMeetings: 0,
      importantThisWeek: 0,
      paymentsThisWeek: 0,
      missedNeedsReply: 0,
      revenue: {
        pipelineValueByStage: {},
        totalOpenPipelineValue: 0,
        totalWonRevenueLast30Days: 0,
        totalWonRevenueAllTime: 0,
      },
    };

    // 1. Lead funnel: Count of leads per lead_stage
    const { data: leadStages } = await supabase
      .from("leads")
      .select("lead_stage")
      .eq("user_id", userId);

    if (leadStages) {
      leadStages.forEach((lead) => {
        const stage = lead.lead_stage as keyof typeof insights.leadFunnel;
        if (stage in insights.leadFunnel) {
          insights.leadFunnel[stage]++;
        }
      });
    }

    // 2. Hot & warm leads
    const { data: hotLeads } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .gte("lead_score", 80);

    const { data: warmLeads } = await supabase
      .from("leads")
      .select("id")
      .eq("user_id", userId)
      .gte("lead_score", 60)
      .lt("lead_score", 80);

    insights.hotLeadCount = hotLeads?.length || 0;
    insights.warmLeadCount = warmLeads?.length || 0;

    // 3. Follow-up metrics
    const now = new Date().toISOString();
    const { data: pendingFollowUps } = await supabase
      .from("lead_follow_up_suggestions")
      .select("suggested_for")
      .eq("user_id", userId)
      .eq("status", "pending")
      .lte("suggested_for", now);

    insights.pendingFollowUps = pendingFollowUps?.length || 0;

    // Calculate average follow-up delay (optional)
    if (pendingFollowUps && pendingFollowUps.length > 0) {
      const delays = pendingFollowUps
        .map((fu) => {
          const suggested = new Date(fu.suggested_for);
          const now = new Date();
          const diffMs = now.getTime() - suggested.getTime();
          return Math.floor(diffMs / (1000 * 60 * 60 * 24)); // Convert to days
        })
        .filter((d) => d >= 0);

      if (delays.length > 0) {
        insights.avgFollowUpDelayDays = Math.round(
          delays.reduce((a, b) => a + b, 0) / delays.length
        );
      }
    }

    // 4. Meetings & scheduling (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    sevenDaysFromNow.setHours(23, 59, 59, 999);

    const { data: upcomingMeetings } = await supabase
      .from("email_appointments")
      .select("id")
      .eq("user_id", userId)
      .gte("start_at", now)
      .lte("start_at", sevenDaysFromNow.toISOString());

    insights.upcomingMeetings = upcomingMeetings?.length || 0;

    // Optional: Count meetings scheduled by Sync (if a flag exists)
    // This would require a column like `created_by_sync` or similar
    // For now, we'll skip this as it's optional

    // 5. Email workload (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Important emails (last 7 days)
    const { data: importantEmails } = await supabase
      .from("email_queue")
      .select("id")
      .eq("user_id", userId)
      .eq("category", "important")
      .gte("internal_date", sevenDaysAgo.toISOString())
      .is("deleted_at", null);

    insights.importantThisWeek = importantEmails?.length || 0;

    // Payment/billing emails (last 7 days)
    const { data: paymentEmails } = await supabase
      .from("email_queue")
      .select("id")
      .eq("user_id", userId)
      .eq("category", "payment_bill")
      .gte("internal_date", sevenDaysAgo.toISOString())
      .is("deleted_at", null);

    insights.paymentsThisWeek = paymentEmails?.length || 0;

    // Missed emails needing reply
    // This is a bit more complex - we need emails that are:
    // - Category "missed_unread" or similar
    // - Requiring reply (could check if there's a follow-up suggestion or task)
    const { data: missedEmails } = await supabase
      .from("email_queue")
      .select("id")
      .eq("user_id", userId)
      .eq("category", "missed_unread")
      .is("deleted_at", null);

    // Also check for emails with pending follow-up suggestions or tasks
    const { data: emailsNeedingReply } = await supabase
      .from("lead_follow_up_suggestions")
      .select("email_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .not("email_id", "is", null);

    const { data: taskEmails } = await supabase
      .from("email_tasks")
      .select("email_id")
      .eq("user_id", userId)
      .in("status", ["pending", "open"])
      .not("email_id", "is", null);

    const emailIdsNeedingReply = new Set([
      ...(missedEmails?.map((e) => e.id) || []),
      ...(emailsNeedingReply?.map((e) => e.email_id).filter(Boolean) || []),
      ...(taskEmails?.map((e) => e.email_id).filter(Boolean) || []),
    ]);

    insights.missedNeedsReply = emailIdsNeedingReply.size;

    // 6. Revenue metrics
    const revenue = {
      pipelineValueByStage: {
        new: 0,
        qualified: 0,
        warm: 0,
        negotiating: 0,
        ready_to_close: 0,
      },
      totalOpenPipelineValue: 0,
      totalWonRevenueLast30Days: 0,
      totalWonRevenueAllTime: 0,
    };

    // Get leads with potential_value for pipeline calculation
    const { data: pipelineLeads } = await supabase
      .from("leads")
      .select("lead_stage, potential_value, currency, closed_value, closed_at")
      .eq("user_id", userId)
      .not("potential_value", "is", null);

    if (pipelineLeads) {
      // Calculate pipeline value by stage (only for open stages)
      const openStages = ["new", "qualified", "warm", "negotiating", "ready_to_close"];
      pipelineLeads.forEach((lead) => {
        if (lead.potential_value && openStages.includes(lead.lead_stage)) {
          const stage = lead.lead_stage as keyof typeof revenue.pipelineValueByStage;
          if (stage in revenue.pipelineValueByStage) {
            revenue.pipelineValueByStage[stage] += Number(lead.potential_value) || 0;
          }
          revenue.totalOpenPipelineValue += Number(lead.potential_value) || 0;
        }
      });
    }

    // Calculate won revenue (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const { data: wonLeadsLast30Days } = await supabase
      .from("leads")
      .select("closed_value")
      .eq("user_id", userId)
      .eq("lead_stage", "won")
      .not("closed_value", "is", null)
      .gte("closed_at", thirtyDaysAgo.toISOString());

    if (wonLeadsLast30Days) {
      revenue.totalWonRevenueLast30Days = wonLeadsLast30Days.reduce(
        (sum, lead) => sum + (Number(lead.closed_value) || 0),
        0
      );
    }

    // Calculate total won revenue (all time)
    const { data: allWonLeads } = await supabase
      .from("leads")
      .select("closed_value")
      .eq("user_id", userId)
      .eq("lead_stage", "won")
      .not("closed_value", "is", null);

    if (allWonLeads) {
      revenue.totalWonRevenueAllTime = allWonLeads.reduce(
        (sum, lead) => sum + (Number(lead.closed_value) || 0),
        0
      );
    }

    insights.revenue = revenue;

    return NextResponse.json({
      ok: true,
      data: insights,
    });
  } catch (error: any) {
    console.error("[Insights] Error fetching overview:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch insights" },
      { status: 500 }
    );
  }
}
