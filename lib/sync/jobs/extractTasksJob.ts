/**
 * Task Extraction Background Job
 * Automatically extracts tasks and reminders from emails
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { extractTasks } from "@/lib/sync/extractTasks";
import { isSyncIntelligenceEnabled, getSyncBatchSize, getSyncMaxRetries } from "@/lib/sync/featureFlags";

export interface TaskExtractionJobResult {
  processed: number;
  tasksCreated: number;
  remindersCreated: number;
  failed: number;
}

/**
 * Process a batch of emails for task extraction
 * Only processes important/missed emails that don't already have tasks
 */
export async function processTaskExtractionBatch(): Promise<TaskExtractionJobResult> {
  if (!isSyncIntelligenceEnabled()) {
    console.log("[ExtractTasksJob] Sync Intelligence is disabled, skipping");
    return { processed: 0, tasksCreated: 0, remindersCreated: 0, failed: 0 };
  }

  const supabase = getSupabaseServerClient();
  const batchSize = getSyncBatchSize();
  const maxRetries = getSyncMaxRetries();

  let processed = 0;
  let tasksCreated = 0;
  let remindersCreated = 0;
  let failed = 0;

  try {
    // Find emails that need task extraction
    // Only process important/missed emails that have been classified and don't have tasks yet
    const { data: emailsToProcess, error: fetchError } = await supabase
      .from("email_queue")
      .select("id, user_id, from_address, subject, body_text, internal_date, category, has_tasks")
      .eq("has_tasks", false)
      .in("category", ["important", "missed_unread"]) // Only process important emails
      .is("deleted_at", null)
      .order("internal_date", { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      console.error("[ExtractTasksJob] Error fetching emails:", fetchError);
      return { processed: 0, tasksCreated: 0, remindersCreated: 0, failed: 0 };
    }

    if (!emailsToProcess || emailsToProcess.length === 0) {
      return { processed: 0, tasksCreated: 0, remindersCreated: 0, failed: 0 };
    }

    // Process each email
    for (const email of emailsToProcess) {
      processed++;
      let retries = 0;
      let success = false;

      while (retries < maxRetries && !success) {
        try {
          // Check if tasks already exist (idempotency)
          const { data: existingTasks } = await supabase
            .from("email_tasks")
            .select("id")
            .eq("email_id", email.id)
            .limit(1);

          if (existingTasks && existingTasks.length > 0) {
            // Already processed, skip
            success = true;
            continue;
          }

          // Extract tasks
          const extraction = await extractTasks(
            email.from_address || "",
            email.subject || "(No subject)",
            email.body_text || null,
            email.internal_date
          );

          // Insert tasks if found
          if (extraction.hasTasks && extraction.tasks && extraction.tasks.length > 0) {
            const taskInserts = extraction.tasks.map((task) => ({
              email_id: email.id,
              user_id: email.user_id,
              description: task.description,
              due_date: task.dueDate || null,
              due_time: task.dueTime || null,
              priority: task.priority,
              assignee_email: task.assignee || null,
              is_recurring: !!task.recurring?.frequency,
              recurring_frequency: task.recurring?.frequency || null,
              recurring_end_date: task.recurring?.endDate || null,
              status: "open",
              extraction_raw: extraction.rawResponse,
            }));

            const { error: tasksError } = await supabase
              .from("email_tasks")
              .insert(taskInserts);

            if (tasksError) {
              throw new Error(`Failed to insert tasks: ${tasksError.message}`);
            }

            tasksCreated += taskInserts.length;
          }

          // Insert reminders if found
          if (extraction.reminders && extraction.reminders.length > 0) {
            // Get task IDs if tasks were created
            let taskIds: string[] = [];
            if (extraction.hasTasks && extraction.tasks) {
              const { data: insertedTasks } = await supabase
                .from("email_tasks")
                .select("id")
                .eq("email_id", email.id)
                .order("created_at", { ascending: false })
                .limit(extraction.tasks.length);

              taskIds = (insertedTasks || []).map((t) => t.id);
            }

            const reminderInserts = extraction.reminders.map((reminder, index) => ({
              email_id: email.id,
              task_id: taskIds[index] || null, // Link to first task if available
              user_id: email.user_id,
              message: reminder.message,
              remind_at: reminder.remindAt,
              status: "pending",
              notification_method: "in_app",
            }));

            const { error: remindersError } = await supabase
              .from("email_reminders")
              .insert(reminderInserts);

            if (remindersError) {
              throw new Error(`Failed to insert reminders: ${remindersError.message}`);
            }

            remindersCreated += reminderInserts.length;
          }

          // Update email to mark as having tasks (if any tasks or reminders were created)
          if ((extraction.hasTasks && extraction.tasks && extraction.tasks.length > 0) || 
              (extraction.reminders && extraction.reminders.length > 0)) {
            const { error: updateError } = await supabase
              .from("email_queue")
              .update({
                has_tasks: true,
                tasks_detected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", email.id);

            if (updateError) {
              throw new Error(`Failed to update email: ${updateError.message}`);
            }
          }

          success = true;
          if (extraction.hasTasks || (extraction.reminders && extraction.reminders.length > 0)) {
            console.log(
              `[ExtractTasksJob] Extracted ${extraction.tasks?.length || 0} tasks and ${extraction.reminders?.length || 0} reminders from email ${email.id}`
            );
          }
        } catch (error: any) {
          retries++;
          console.error(
            `[ExtractTasksJob] Error extracting tasks for email ${email.id} (attempt ${retries}/${maxRetries}):`,
            error
          );

          if (retries >= maxRetries) {
            failed++;
          } else {
            // Exponential backoff
            const backoffMs = Math.pow(2, retries) * 60 * 1000;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          }
        }
      }
    }

    return { processed, tasksCreated, remindersCreated, failed };
  } catch (error: any) {
    console.error("[ExtractTasksJob] Fatal error:", error);
    return { processed, tasksCreated, remindersCreated, failed };
  }
}


