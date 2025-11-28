/**
 * Campaign Time Window Enforcement
 * 
 * This module enforces time window rules for call campaigns.
 * Campaigns can ONLY make calls within the allowed time window.
 * 
 * CRITICAL: This is a compliance and user experience feature.
 * Calls outside allowed hours are blocked automatically.
 */

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface TimeWindowConfig {
  timezone: string; // IANA timezone string (e.g., "America/New_York")
  allowedCallStartTime: string; // Time string (e.g., "09:00:00")
  allowedCallEndTime: string; // Time string (e.g., "18:00:00")
  allowedDaysOfWeek: DayOfWeek[]; // Array of allowed days
}

/**
 * Check if current time is within the allowed call window
 * 
 * @param config - Time window configuration
 * @returns Object with isWithinWindow boolean and reason if outside window
 */
export function isWithinCallWindow(config: TimeWindowConfig): {
  isWithinWindow: boolean;
  reason?: string;
  nextWindowOpens?: string;
} {
  try {
    // Get current time in the campaign's timezone
    const now = new Date();
    const timeInTimezone = new Date(
      now.toLocaleString("en-US", { timeZone: config.timezone })
    );

    // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = timeInTimezone.getDay();
    const dayMap: Record<number, DayOfWeek> = {
      0: "sun",
      1: "mon",
      2: "tue",
      3: "wed",
      4: "thu",
      5: "fri",
      6: "sat",
    };
    const currentDay = dayMap[dayOfWeek];

    // Check if current day is allowed
    if (!config.allowedDaysOfWeek.includes(currentDay)) {
      // Find next allowed day
      const nextAllowedDay = findNextAllowedDay(currentDay, config.allowedDaysOfWeek);
      return {
        isWithinWindow: false,
        reason: `Calls are not allowed on ${currentDay}. Next allowed day: ${nextAllowedDay}`,
        nextWindowOpens: `Next ${nextAllowedDay} at ${config.allowedCallStartTime}`,
      };
    }

    // Parse allowed times
    const [startHour, startMin] = config.allowedCallStartTime.split(":").map(Number);
    const [endHour, endMin] = config.allowedCallEndTime.split(":").map(Number);

    const currentHour = timeInTimezone.getHours();
    const currentMin = timeInTimezone.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMin;
    const startTimeMinutes = startHour * 60 + startMin;
    const endTimeMinutes = endHour * 60 + endMin;

    // Check if current time is within allowed window
    if (currentTimeMinutes < startTimeMinutes) {
      return {
        isWithinWindow: false,
        reason: `Current time (${formatTime(currentHour, currentMin)}) is before allowed start time (${config.allowedCallStartTime})`,
        nextWindowOpens: `Today at ${config.allowedCallStartTime}`,
      };
    }

    if (currentTimeMinutes >= endTimeMinutes) {
      // Find next allowed day
      const nextAllowedDay = findNextAllowedDay(currentDay, config.allowedDaysOfWeek);
      return {
        isWithinWindow: false,
        reason: `Current time (${formatTime(currentHour, currentMin)}) is after allowed end time (${config.allowedCallEndTime})`,
        nextWindowOpens: `Next ${nextAllowedDay} at ${config.allowedCallStartTime}`,
      };
    }

    return {
      isWithinWindow: true,
    };
  } catch (error) {
    console.error("Error checking call window:", error);
    // Fail closed: if we can't verify, don't allow calls
    return {
      isWithinWindow: false,
      reason: "Error checking time window. Calls are blocked for safety.",
    };
  }
}

/**
 * Find the next allowed day of week
 */
function findNextAllowedDay(
  currentDay: DayOfWeek,
  allowedDays: DayOfWeek[]
): DayOfWeek {
  const dayOrder: DayOfWeek[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const currentIndex = dayOrder.indexOf(currentDay);
  
  // Check remaining days in current week
  for (let i = currentIndex + 1; i < dayOrder.length; i++) {
    if (allowedDays.includes(dayOrder[i])) {
      return dayOrder[i];
    }
  }
  
  // Check next week
  for (let i = 0; i <= currentIndex; i++) {
    if (allowedDays.includes(dayOrder[i])) {
      return dayOrder[i];
    }
  }
  
  // Fallback (should never happen)
  return allowedDays[0];
}

/**
 * Format time for display
 */
function formatTime(hour: number, minute: number): string {
  const h = hour.toString().padStart(2, "0");
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Get human-readable time window summary
 */
export function getTimeWindowSummary(config: TimeWindowConfig): string {
  const daysStr = config.allowedDaysOfWeek
    .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
    .join(", ");
  return `Calls allowed: ${daysStr} ${config.allowedCallStartTime}–${config.allowedCallEndTime} [${config.timezone}]`;
}








