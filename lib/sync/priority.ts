/**
 * Email Priority Scoring
 * Computes priority scores for emails based on various factors
 */

import type { EmailQueueItem } from "@/types";

export interface PriorityInput {
  email: EmailQueueItem;
  lead?: {
    lead_score: number;
    lead_stage: string;
  } | null;
  tasks?: Array<{ due_at?: string | null; status: string }>;
  reminders?: Array<{ remind_at: string; status: string }>;
  category?: string | null;
  isUnread: boolean;
  hasFollowUpSuggestion: boolean;
}

/**
 * Compute email priority score
 * Returns a number (0-100+) where higher = more important
 */
export function computeEmailPriority(input: PriorityInput): number {
  let score = 0;

  // Lead score contribution (0-60 points)
  if (input.lead) {
    score += Math.round(input.lead.lead_score * 0.6);
  }

  // Category weights
  if (input.category === "important") {
    score += 15;
  } else if (input.category === "payment_bill" || input.category === "invoice") {
    score += 15;
  } else if (input.category === "missed_unread") {
    score += 10;
  } else if (input.category === "marketing" || input.category === "other") {
    score += 2;
  }

  // Tasks/Reminders urgency
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (input.tasks) {
    for (const task of input.tasks) {
      if (task.status !== "completed" && task.status !== "cancelled" && task.due_at) {
        const dueDate = new Date(task.due_at);
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        if (dueDateOnly < today) {
          // Overdue
          score += 30;
        } else if (dueDateOnly.getTime() === today.getTime()) {
          // Due today
          score += 20;
        }
      }
    }
  }

  if (input.reminders) {
    for (const reminder of input.reminders) {
      if (reminder.status === "active") {
        const remindDate = new Date(reminder.remind_at);
        if (remindDate <= now) {
          // Reminder is due or overdue
          score += 20;
        }
      }
    }
  }

  // Unread bonus
  if (input.isUnread) {
    score += 10;
  }

  // Follow-up suggestion bonus
  if (input.hasFollowUpSuggestion) {
    score += 15;
  }

  return Math.max(0, score);
}

/**
 * Update priority score for an email
 */
export async function updateEmailPriority(
  emailId: string,
  userId: string,
  priorityScore: number
): Promise<void> {
  const { getSupabaseServerClient } = await import("@/lib/supabaseServerClient");
  const supabase = getSupabaseServerClient();

  await supabase
    .from("email_queue")
    .update({ priority_score: priorityScore })
    .eq("id", emailId)
    .eq("user_id", userId);
}


