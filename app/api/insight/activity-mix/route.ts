import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getTimeRangeBounds } from "@/lib/insight/utils";
import type { ActivityMixResponse, TimeRange } from "@/types";

/**
 * GET /api/insight/activity-mix
 * 
 * Get activity mix (calls vs emails) for a given time range
 * 
 * Query params:
 * - range: 'daily' | 'weekly' | 'monthly' (default: 'daily')
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    
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

    const searchParams = request.nextUrl.searchParams;
    const range = (searchParams.get("range") || "daily") as TimeRange;

    // Calculate time range bounds
    const { start, end } = getTimeRangeBounds(range);

    // Fetch agent stats for the time range
    const { data: stats, error: statsError } = await supabase
      .from("agent_stats_daily")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", start.toISOString().split("T")[0])
      .lte("date", end.toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (statsError) {
      console.error("Error fetching stats:", statsError);
      return NextResponse.json(
        { error: statsError.message },
        { status: 500 }
      );
    }

    // Generate buckets based on range
    const buckets: { label: string; calls: number; emails: number }[] = [];

    if (range === "daily") {
      // For daily, show hourly buckets (24 hours)
      const hours = Array.from({ length: 24 }, (_, i) => i);
      for (const hour of hours) {
        const hourStart = new Date(start);
        hourStart.setHours(hour, 0, 0, 0);
        const hourEnd = new Date(start);
        hourEnd.setHours(hour, 59, 59, 999);

        // For now, distribute stats evenly across hours
        // In production, you'd query actual call/email timestamps
        const dailyStats = stats?.[0] || {
          alpha_calls_total: 0,
          xi_important_emails: 0,
        };
        const callsPerHour = Math.floor(dailyStats.alpha_calls_total / 24);
        const emailsPerHour = Math.floor(dailyStats.xi_important_emails / 24);

        buckets.push({
          label: `${hour.toString().padStart(2, "0")}:00`,
          calls: callsPerHour,
          emails: emailsPerHour,
        });
      }
    } else if (range === "weekly") {
      // For weekly, show daily buckets (7 days)
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      for (let i = 0; i < 7; i++) {
        const dayStats = stats?.[i] || {
          alpha_calls_total: 0,
          xi_important_emails: 0,
        };
        buckets.push({
          label: days[i],
          calls: dayStats.alpha_calls_total || 0,
          emails: dayStats.xi_important_emails || 0,
        });
      }
    } else {
      // For monthly, show weekly buckets (4-5 weeks)
      const weekCount = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
      for (let i = 0; i < weekCount; i++) {
        const weekStart = new Date(start);
        weekStart.setDate(start.getDate() + i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        // Aggregate stats for this week
        const weekStats = (stats || []).filter((s) => {
          const statDate = new Date(s.date);
          return statDate >= weekStart && statDate <= weekEnd;
        });

        const totalCalls = weekStats.reduce((sum, s) => sum + (s.alpha_calls_total || 0), 0);
        const totalEmails = weekStats.reduce((sum, s) => sum + (s.xi_important_emails || 0), 0);

        buckets.push({
          label: `W${i + 1}`,
          calls: totalCalls,
          emails: totalEmails,
        });
      }
    }

    const response: ActivityMixResponse = {
      range,
      buckets,
    };

    return NextResponse.json({ ok: true, data: response });
  } catch (error: any) {
    console.error("Error in activity-mix endpoint:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}




