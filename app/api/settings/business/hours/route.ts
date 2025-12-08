import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getBusinessProfileByUserId, setBusinessHours } from "@/lib/sync/businessInfo";

/**
 * POST /api/settings/business/hours
 * Set business hours for all days
 * Expects: { hours: [{ day_of_week, open_time, close_time, timezone, is_closed }, ...] }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const body = await request.json();
    const { hours, timezone } = body;

    if (!hours || !Array.isArray(hours)) {
      return NextResponse.json(
        { error: "Hours array is required" },
        { status: 400 }
      );
    }

    const profile = await getBusinessProfileByUserId(userId);
    if (!profile) {
      return NextResponse.json(
        { error: "Business profile not found. Please create a business profile first." },
        { status: 404 }
      );
    }

    const defaultTimezone = timezone || "America/New_York";
    const results = [];

    for (const hourData of hours) {
      const { day_of_week, open_time, close_time, is_closed } = hourData;
      
      if (day_of_week === undefined || day_of_week === null) {
        continue;
      }

      const hour = await setBusinessHours(profile.id, day_of_week, {
        open_time: open_time || null,
        close_time: close_time || null,
        timezone: defaultTimezone,
        is_closed: is_closed || false,
      });

      results.push(hour);
    }

    return NextResponse.json({ hours: results });
  } catch (error: any) {
    console.error("[Business Settings] Error setting business hours:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save business hours" },
      { status: 500 }
    );
  }
}


