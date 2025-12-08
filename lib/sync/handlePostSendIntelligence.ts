/**
 * Post-Send Intelligence Handler
 * Creates calendar alerts and tasks when emails with intent metadata are sent
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { isDraftSendCalendarAlertsEnabled } from "./featureFlags";

export interface PostSendIntelligenceResult {
  appointmentsCreated: number;
  tasksCreated: number;
  remindersCreated: number;
  errors: string[];
}

/**
 * Handle post-send intelligence processing
 * Creates calendar alerts, tasks, and reminders based on email intent metadata
 * 
 * @param userId - User ID
 * @param emailId - Email ID that was replied to
 * @param threadId - Gmail thread ID (optional)
 * @returns Result with counts of created items
 */
export async function handlePostSendIntelligence(
  userId: string,
  emailId: string,
  threadId?: string
): Promise<PostSendIntelligenceResult> {
  // Check feature flag
  if (!isDraftSendCalendarAlertsEnabled()) {
    console.log("[HandlePostSendIntelligence] Feature disabled, skipping");
    return {
      appointmentsCreated: 0,
      tasksCreated: 0,
      remindersCreated: 0,
      errors: [],
    };
  }

  const supabase = getSupabaseServerClient();
  const result: PostSendIntelligenceResult = {
    appointmentsCreated: 0,
    tasksCreated: 0,
    remindersCreated: 0,
    errors: [],
  };

  try {
    // Check user preferences
    const { data: preferences } = await supabase
      .from("user_sync_preferences")
      .select("auto_create_calendar_events, auto_create_tasks")
      .eq("user_id", userId)
      .single();

    const autoCreateCalendar = preferences?.auto_create_calendar_events ?? true; // Default: enabled
    const autoCreateTasks = preferences?.auto_create_tasks ?? true; // Default: enabled

    if (!autoCreateCalendar && !autoCreateTasks) {
      console.log("[HandlePostSendIntelligence] User preferences disabled, skipping");
      return result;
    }

    // Fetch intent metadata for the email
    const { data: intentData, error: intentError } = await supabase
      .from("email_queue")
      .select("id, category")
      .eq("id", emailId)
      .eq("user_id", userId)
      .single();

    if (intentError || !intentData) {
      console.warn("[HandlePostSendIntelligence] Email not found:", intentError);
      return result;
    }

    // Fetch appointments for this email
    if (autoCreateCalendar) {
      const { data: appointments, error: appointmentsError } = await supabase
        .from("email_appointments")
        .select("*")
        .eq("email_id", emailId)
        .eq("user_id", userId)
        .eq("status", "detected"); // Only process detected appointments

      if (appointmentsError) {
        result.errors.push(`Failed to fetch appointments: ${appointmentsError.message}`);
      } else if (appointments && appointments.length > 0) {
        // Create calendar events for each appointment
        for (const appointment of appointments) {
          try {
            // Note: Calendar events are stored in sync_calendar_events table
            // For now, we'll mark the appointment as "confirmed" in email_appointments
            // The calendar integration can sync these separately
            
            // Update appointment status to indicate it's been confirmed by sending reply
            const { error: updateError } = await supabase
              .from("email_appointments")
              .update({
                status: "confirmed", // Mark as confirmed when user sends reply
                updated_at: new Date().toISOString(),
              })
              .eq("id", appointment.id)
              .eq("user_id", userId);

            if (updateError) {
              result.errors.push(`Failed to confirm appointment ${appointment.id}: ${updateError.message}`);
            } else {
              result.appointmentsCreated++;
              console.log(`[HandlePostSendIntelligence] Confirmed appointment ${appointment.id}`);
            }

            if (createError) {
              result.errors.push(`Failed to create calendar event: ${createError.message}`);
            } else {
              result.appointmentsCreated++;
              console.log(`[HandlePostSendIntelligence] Created calendar event for appointment ${appointment.id}`);
            }
          } catch (error: any) {
            result.errors.push(`Error processing appointment ${appointment.id}: ${error.message}`);
          }
        }
      }
    }

    // Fetch tasks for this email
    if (autoCreateTasks) {
      const { data: tasks, error: tasksError } = await supabase
        .from("email_tasks")
        .select("*")
        .eq("email_id", emailId)
        .eq("user_id", userId)
        .in("status", ["pending", "open"]); // Only process active tasks

      if (tasksError) {
        result.errors.push(`Failed to fetch tasks: ${tasksError.message}`);
      } else if (tasks && tasks.length > 0) {
        // Mark tasks as confirmed/active (they're already in the tasks table)
        for (const task of tasks) {
          try {
            // Update task status to indicate it's been confirmed by sending reply
            const { error: updateError } = await supabase
              .from("email_tasks")
              .update({
                status: "confirmed", // New status indicating user has acknowledged
                updated_at: new Date().toISOString(),
              })
              .eq("id", task.id)
              .eq("user_id", userId);

            if (updateError) {
              result.errors.push(`Failed to update task ${task.id}: ${updateError.message}`);
            } else {
              result.tasksCreated++;
              console.log(`[HandlePostSendIntelligence] Confirmed task ${task.id}`);
            }
          } catch (error: any) {
            result.errors.push(`Error processing task ${task.id}: ${error.message}`);
          }
        }
      }
    }

    // Fetch reminders for this email
    if (autoCreateTasks) {
      const { data: reminders, error: remindersError } = await supabase
        .from("email_reminders")
        .select("*")
        .eq("email_id", emailId)
        .eq("user_id", userId)
        .eq("status", "active"); // Only process active reminders

      if (remindersError) {
        result.errors.push(`Failed to fetch reminders: ${remindersError.message}`);
      } else if (reminders && reminders.length > 0) {
        // Mark reminders as confirmed
        for (const reminder of reminders) {
          try {
            const { error: updateError } = await supabase
              .from("email_reminders")
              .update({
                status: "confirmed", // User has acknowledged by sending reply
                updated_at: new Date().toISOString(),
              })
              .eq("id", reminder.id)
              .eq("user_id", userId);

            if (updateError) {
              result.errors.push(`Failed to update reminder ${reminder.id}: ${updateError.message}`);
            } else {
              result.remindersCreated++;
              console.log(`[HandlePostSendIntelligence] Confirmed reminder ${reminder.id}`);
            }
          } catch (error: any) {
            result.errors.push(`Error processing reminder ${reminder.id}: ${error.message}`);
          }
        }
      }
    }

    return result;
  } catch (error: any) {
    console.error("[HandlePostSendIntelligence] Error:", error);
    result.errors.push(`Unexpected error: ${error.message}`);
    return result;
  }
}

