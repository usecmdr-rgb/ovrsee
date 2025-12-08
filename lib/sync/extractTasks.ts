/**
 * Task and Reminder Extraction Helper
 * Uses OpenAI to extract actionable tasks and reminders from emails
 */

import { openai } from "@/lib/openai";

export interface TaskExtractionResult {
  hasTasks: boolean;
  tasks?: Array<{
    description: string;
    dueDate?: string; // YYYY-MM-DD
    dueTime?: string; // HH:MM
    priority: "high" | "medium" | "low";
    assignee?: string; // email address
    recurring?: {
      frequency: "daily" | "weekly" | "monthly" | null;
      endDate?: string; // YYYY-MM-DD
    };
  }>;
  reminders?: Array<{
    message: string;
    remindAt: string; // ISO date-time
  }>;
  rawResponse?: any;
}

const SYSTEM_PROMPT = `You are a task and reminder extraction assistant. Analyze the email and extract:
1. Explicit tasks or action items requested
2. Due dates or deadlines mentioned
3. Priority indicators (urgent, important, asap)
4. Recurring patterns (daily, weekly, monthly)

Return ONLY valid JSON with this exact structure:
{
  "hasTasks": true/false,
  "tasks": [
    {
      "description": "Task description",
      "dueDate": "YYYY-MM-DD" (if mentioned, else null),
      "dueTime": "HH:MM" (if mentioned, else null),
      "priority": "high" | "medium" | "low" (based on urgency keywords),
      "assignee": "email@example.com" (if task assigned to someone, else null),
      "recurring": {
        "frequency": "daily" | "weekly" | "monthly" | null,
        "endDate": "YYYY-MM-DD" (if recurring has end date, else null)
      }
    }
  ],
  "reminders": [
    {
      "message": "Reminder text",
      "remindAt": "YYYY-MM-DDTHH:MM:SS" (when to remind user)
    }
  ]
}

If no tasks or reminders are found, return: {"hasTasks": false}

Current date: ${new Date().toISOString().split('T')[0]}`;

/**
 * Extract tasks and reminders from email content
 * 
 * @param fromAddress - Email sender address
 * @param subject - Email subject line
 * @param bodyText - Plain text body of the email
 * @param internalDate - Email internal date (for resolving relative dates)
 * @returns Task extraction result
 */
export async function extractTasks(
  fromAddress: string,
  subject: string,
  bodyText?: string | null,
  internalDate?: string
): Promise<TaskExtractionResult> {
  try {
    // Build the user prompt with email content
    const emailContent = [
      `From: ${fromAddress}`,
      `Subject: ${subject}`,
      bodyText ? `Body: ${bodyText.substring(0, 3000)}` : "", // Limit body to 3000 chars
      internalDate ? `Email Date: ${internalDate}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const userPrompt = `Extract tasks and reminders from this email:\n\n${emailContent}`;

    // Call OpenAI with JSON mode
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for cost efficiency
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Slightly higher than classification for more natural extraction
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[ExtractTasks] Empty response from OpenAI");
      return { hasTasks: false, rawResponse: response };
    }

    // Parse JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("[ExtractTasks] Failed to parse JSON response:", content);
      return { hasTasks: false, rawResponse: { content, error: "parse_error" } };
    }

    // Validate response structure
    if (!parsed.hasTasks || !parsed.tasks || parsed.tasks.length === 0) {
      return {
        hasTasks: false,
        reminders: parsed.reminders || [],
        rawResponse: response,
      };
    }

    // Validate and clean tasks
    const validTasks = parsed.tasks
      .filter((task: any) => task.description && task.description.trim().length > 0)
      .map((task: any) => ({
        description: task.description.trim(),
        dueDate: task.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) ? task.dueDate : undefined,
        dueTime: task.dueTime && /^\d{2}:\d{2}$/.test(task.dueTime) ? task.dueTime : undefined,
        priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
        assignee: task.assignee || undefined,
        recurring: task.recurring?.frequency
          ? {
              frequency: ["daily", "weekly", "monthly"].includes(task.recurring.frequency)
                ? task.recurring.frequency
                : null,
              endDate: task.recurring.endDate && /^\d{4}-\d{2}-\d{2}$/.test(task.recurring.endDate)
                ? task.recurring.endDate
                : undefined,
            }
          : undefined,
      }));

    // Validate and clean reminders
    const validReminders = (parsed.reminders || [])
      .filter((reminder: any) => reminder.message && reminder.remindAt)
      .map((reminder: any) => ({
        message: reminder.message.trim(),
        remindAt: reminder.remindAt, // ISO date-time string
      }));

    if (validTasks.length === 0 && validReminders.length === 0) {
      return { hasTasks: false, rawResponse: response };
    }

    return {
      hasTasks: validTasks.length > 0,
      tasks: validTasks.length > 0 ? validTasks : undefined,
      reminders: validReminders.length > 0 ? validReminders : undefined,
      rawResponse: response,
    };
  } catch (error: any) {
    console.error("[ExtractTasks] Error extracting tasks:", error);
    // Return no tasks as safe default on any error
    return {
      hasTasks: false,
      rawResponse: { error: error.message || "unknown_error" },
    };
  }
}


