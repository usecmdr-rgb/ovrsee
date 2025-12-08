import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/settings/sync
 * Get sync preferences for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const supabase = getSupabaseServerClient();
    const { data: preferences, error } = await supabase
      .from("user_sync_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    // Return defaults if no preferences exist
    if (!preferences) {
      return NextResponse.json({
        follow_up_threshold_days: 5,
        default_meeting_duration_minutes: 30,
        scheduling_time_window_days: 7,
        prefers_auto_time_suggestions: false,
        tone_preset: "professional",
        tone_custom_instructions: null,
        follow_up_intensity: "normal",
        auto_create_calendar_events: false,
        auto_create_tasks: false,
        auto_create_reminders: false,
        default_calendar_id: "primary",
        default_timezone: "America/New_York",
      });
    }

    return NextResponse.json(preferences);
  } catch (error: any) {
    console.error("[Sync Settings] Error fetching preferences:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sync settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/sync
 * Update sync preferences for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const body = await request.json();
    const {
      follow_up_threshold_days,
      default_meeting_duration_minutes,
      scheduling_time_window_days,
      prefers_auto_time_suggestions,
      tone_preset,
      tone_custom_instructions,
      follow_up_intensity,
      auto_create_calendar_events,
      auto_create_tasks,
      auto_create_reminders,
      default_calendar_id,
      default_timezone,
    } = body;

    const supabase = getSupabaseServerClient();

    // Upsert preferences
    const { data: preferences, error } = await supabase
      .from("user_sync_preferences")
      .upsert(
        {
          user_id: userId,
          follow_up_threshold_days,
          default_meeting_duration_minutes,
          scheduling_time_window_days,
          prefers_auto_time_suggestions,
          tone_preset,
          tone_custom_instructions: tone_custom_instructions?.trim() || null,
          follow_up_intensity,
          auto_create_calendar_events,
          auto_create_tasks,
          auto_create_reminders,
          default_calendar_id,
          default_timezone,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ preferences });
  } catch (error: any) {
    console.error("[Sync Settings] Error updating preferences:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update sync settings" },
      { status: 500 }
    );
  }
}


