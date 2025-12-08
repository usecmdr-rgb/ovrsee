/**
 * Smart Scheduling Helper
 * Gets available time slots based on calendar availability and business hours
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getBusinessContextForUser } from "./businessInfo";

export interface TimeSlot {
  start: string; // ISO 8601 string
  end: string; // ISO 8601 string
  timezone: string;
  source: "calendar" | "business_hours";
}

export interface GetAvailableTimeSlotsOptions {
  userId: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  slotDurationMinutes?: number; // Default: 60
  businessHoursAware?: boolean; // Default: true
}

/**
 * Get available time slots for scheduling
 * 
 * Combines:
 * - Calendar free/busy data
 * - Business hours constraints
 * - User preferences
 */
export async function getAvailableTimeSlots(
  options: GetAvailableTimeSlotsOptions
): Promise<TimeSlot[]> {
  const {
    userId,
    dateRange,
    slotDurationMinutes = 60,
    businessHoursAware = true,
  } = options;

  const supabase = getSupabaseServerClient();

  // Get user preferences
  const { data: preferences } = await supabase
    .from("user_sync_preferences")
    .select("prefers_auto_time_suggestions, default_meeting_duration_minutes, scheduling_time_window_days")
    .eq("user_id", userId)
    .single();

  const duration = preferences?.default_meeting_duration_minutes || slotDurationMinutes;
  const timeWindow = preferences?.scheduling_time_window_days || 7;

  // Get business hours if enabled
  let businessHours: Array<{ day_of_week: number; open_time: string | null; close_time: string | null; timezone: string; is_closed: boolean }> = [];
  if (businessHoursAware) {
    const businessContext = await getBusinessContextForUser(userId);
    if (businessContext?.hours) {
      businessHours = businessContext.hours;
    }
  }

  // Get workspace_id from user_id (workspaces table has owner_user_id)
  let workspaceId: string | null = null;
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_user_id", userId)
    .single();
  
  if (workspace) {
    workspaceId = workspace.id;
  }

  // Get calendar events (busy times) from sync_calendar_events
  // Note: This assumes the calendar is synced via the existing calendar integration
  let calendarEvents: Array<{ start_at: string; end_at: string }> | null = null;
  
  if (workspaceId) {
    const { data: events, error: calendarError } = await supabase
      .from("sync_calendar_events")
      .select("start_at, end_at")
      .eq("workspace_id", workspaceId)
      .gte("start_at", dateRange.start.toISOString())
      .lte("start_at", dateRange.end.toISOString())
      .eq("status", "confirmed")
      .order("start_at");

    if (calendarError) {
      console.warn("[SmartScheduling] Error fetching calendar events:", calendarError);
    } else {
      calendarEvents = events;
    }
  }

  if (calendarError) {
    console.warn("[SmartScheduling] Error fetching calendar events:", calendarError);
  }

  // Build busy time ranges
  const busyRanges: Array<{ start: Date; end: Date }> = [];
  if (calendarEvents) {
    for (const event of calendarEvents) {
      if (event.start_at && event.end_at) {
        busyRanges.push({
          start: new Date(event.start_at),
          end: new Date(event.end_at),
        });
      }
    }
  }

  // Generate candidate time slots
  const slots: TimeSlot[] = [];
  const currentDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);

  // Default timezone (can be overridden by business hours)
  const defaultTimezone = businessHours[0]?.timezone || "America/New_York";

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dayHours = businessHours.find((h) => h.day_of_week === dayOfWeek);

    // Skip if business is closed on this day
    if (businessHoursAware && dayHours && dayHours.is_closed) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
      continue;
    }

    // Determine working hours for this day
    let workStartHour = 9; // Default: 9 AM
    let workEndHour = 17; // Default: 5 PM

    if (businessHoursAware && dayHours && !dayHours.is_closed && dayHours.open_time && dayHours.close_time) {
      // Parse time strings (HH:MM:SS format)
      const [openHour, openMin] = dayHours.open_time.split(":").map(Number);
      const [closeHour, closeMin] = dayHours.close_time.split(":").map(Number);
      workStartHour = openHour;
      workEndHour = closeHour;
    }

    // Generate slots for this day
    const dayStart = new Date(currentDate);
    dayStart.setHours(workStartHour, 0, 0, 0);

    const dayEnd = new Date(currentDate);
    dayEnd.setHours(workEndHour, 0, 0, 0);

    let slotStart = new Date(dayStart);

    while (slotStart < dayEnd) {
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Check if this slot overlaps with any busy time
      const isBusy = busyRanges.some((busy) => {
        return (
          (slotStart >= busy.start && slotStart < busy.end) ||
          (slotEnd > busy.start && slotEnd <= busy.end) ||
          (slotStart <= busy.start && slotEnd >= busy.end)
        );
      });

      // Only add if not busy and in the future
      if (!isBusy && slotStart > new Date()) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          timezone: dayHours?.timezone || defaultTimezone,
          source: "calendar",
        });
      }

      // Move to next slot (30-minute increments for more options)
      slotStart.setMinutes(slotStart.getMinutes() + 30);
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  }

  // Sort by start time and limit to top N (e.g., 10 slots)
  return slots
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 10);
}

/**
 * Format time slot for display in AI prompts
 */
export function formatTimeSlotForAI(slot: TimeSlot): string {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  
  const dateStr = start.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  
  const timeStr = `${start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })} - ${end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
  
  return `${dateStr} at ${timeStr} (${slot.timezone})`;
}

