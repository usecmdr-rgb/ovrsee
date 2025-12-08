/**
 * Thread Context Retrieval
 * Fetches email thread context for draft generation
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { openai } from "@/lib/openai";

export interface ThreadMessage {
  id: string;
  sender: string;
  senderName?: string | null;
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string;
  sentAt: string;
  isFromUser: boolean; // True if email is from the user (outgoing)
}

export interface ThreadIntentMetadata {
  appointments?: Array<{
    id: string;
    title: string;
    appointment_date: string;
    appointment_time: string;
    location?: string | null;
    status: string;
  }>;
  tasks?: Array<{
    id: string;
    description: string;
    due_date?: string | null;
    priority: string;
    status: string;
  }>;
  reminders?: Array<{
    id: string;
    message: string;
    remind_at: string;
    status: string;
  }>;
}

export interface ThreadContext {
  threadSummary?: string; // Optional summary for long threads
  recentMessages: ThreadMessage[];
  intentMetadata?: ThreadIntentMetadata;
  totalMessages: number;
}

const MAX_RECENT_MESSAGES = 5; // Include last 5 messages verbatim
const THREAD_SUMMARY_THRESHOLD = 10; // Summarize if thread has more than 10 messages
const MAX_BODY_LENGTH = 2000; // Truncate email bodies to this length

/**
 * Get thread context for draft generation
 * 
 * @param userId - User ID
 * @param threadId - Gmail thread ID
 * @param currentEmailId - Current email ID (to exclude from context)
 * @param limit - Optional limit for messages (default: all)
 * @returns Thread context with messages and metadata
 */
export async function getThreadContext(
  userId: string,
  threadId: string,
  currentEmailId: string,
  limit?: number
): Promise<ThreadContext> {
  const supabase = getSupabaseServerClient();

  try {
    // Fetch all emails in the thread
    const { data: threadEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("id, from_address, from_name, to_addresses, cc_addresses, subject, body_text, internal_date, user_id")
      .eq("user_id", userId)
      .eq("gmail_thread_id", threadId)
      .neq("id", currentEmailId) // Exclude current email
      .is("deleted_at", null)
      .order("internal_date", { ascending: true }); // Oldest first (chronological order)

    if (fetchError) {
      console.error("[GetThreadContext] Error fetching thread emails:", fetchError);
      return {
        recentMessages: [],
        totalMessages: 0,
      };
    }

    if (!threadEmails || threadEmails.length === 0) {
      // No thread context available
      return {
        recentMessages: [],
        totalMessages: 0,
      };
    }

    const totalMessages = threadEmails.length;

    // Determine if we need to summarize
    const needsSummarization = totalMessages > THREAD_SUMMARY_THRESHOLD;

    // Get user's email address to determine if message is from user
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    const userEmail = userProfile?.email?.toLowerCase() || "";

    // Process messages
    let messagesToInclude: typeof threadEmails;
    let threadSummary: string | undefined;

    if (needsSummarization) {
      // Split into older messages (to summarize) and recent messages (to include verbatim)
      const olderMessages = threadEmails.slice(0, totalMessages - MAX_RECENT_MESSAGES);
      const recentMessages = threadEmails.slice(-MAX_RECENT_MESSAGES);

      // Summarize older messages
      threadSummary = await summarizeThreadMessages(olderMessages, userEmail);

      messagesToInclude = recentMessages;
    } else {
      // Include all messages if thread is small
      messagesToInclude = limit ? threadEmails.slice(-limit) : threadEmails;
    }

    // Format messages
    const recentMessages: ThreadMessage[] = messagesToInclude.map((email) => {
      // Determine if email is from user (check if from_address matches user email)
      const fromAddressLower = (email.from_address || "").toLowerCase();
      const isFromUser = fromAddressLower === userEmail;

      // Truncate body text
      let bodyText = email.body_text || "";
      if (bodyText.length > MAX_BODY_LENGTH) {
        bodyText = bodyText.substring(0, MAX_BODY_LENGTH) + "... [truncated]";
      }

      return {
        id: email.id,
        sender: email.from_address || "",
        senderName: email.from_name,
        to: email.to_addresses || [],
        cc: email.cc_addresses || [],
        subject: email.subject || "(No subject)",
        bodyText,
        sentAt: email.internal_date,
        isFromUser,
      };
    });

    // Fetch intent metadata (appointments, tasks, reminders) for emails in thread
    const emailIds = threadEmails.map((e) => e.id);
    const intentMetadata = await fetchThreadIntentMetadata(userId, emailIds);

    return {
      threadSummary,
      recentMessages,
      intentMetadata: Object.keys(intentMetadata).length > 0 ? intentMetadata : undefined,
      totalMessages,
    };
  } catch (error: any) {
    console.error("[GetThreadContext] Error getting thread context:", error);
    // Return empty context on error (graceful fallback)
    return {
      recentMessages: [],
      totalMessages: 0,
    };
  }
}

/**
 * Summarize older messages in a thread using AI
 */
async function summarizeThreadMessages(
  messages: Array<{
    from_address: string;
    subject: string;
    body_text: string | null;
    internal_date: string;
  }>,
  userEmail: string
): Promise<string> {
  try {
    // Format messages for summarization
    const messagesText = messages
      .map((msg, idx) => {
        const fromAddressLower = (msg.from_address || "").toLowerCase();
        const isFromUser = fromAddressLower === userEmail;
        const sender = isFromUser ? "You" : msg.from_address || "Unknown";
        const body = (msg.body_text || "").substring(0, 500); // Limit each message
        return `Message ${idx + 1} (${msg.internal_date}):\nFrom: ${sender}\nSubject: ${msg.subject}\n${body}`;
      })
      .join("\n\n---\n\n");

    // Call OpenAI to summarize
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for cost efficiency
      messages: [
        {
          role: "system",
          content: `You are a thread summarization assistant. Summarize the following email thread conversation into a concise, factual summary (2-3 sentences). Focus on:
- Key topics discussed
- Important commitments or agreements made
- Dates, deadlines, or scheduling mentioned
- Decisions reached

Keep it brief and factual.`,
        },
        {
          role: "user",
          content: `Summarize this email thread:\n\n${messagesText}`,
        },
      ],
      temperature: 0.2, // Low temperature for factual summaries
      max_tokens: 200, // Keep summary short
    });

    const summary = response.choices[0]?.message?.content?.trim();
    return summary || "Previous conversation in this thread.";
  } catch (error: any) {
    console.error("[GetThreadContext] Error summarizing thread:", error);
    return "Previous conversation in this thread.";
  }
}

/**
 * Fetch intent metadata (appointments, tasks, reminders) for emails in thread
 */
async function fetchThreadIntentMetadata(
  userId: string,
  emailIds: string[]
): Promise<ThreadIntentMetadata> {
  const supabase = getSupabaseServerClient();
  const metadata: ThreadIntentMetadata = {};

  try {
    // Fetch appointments
    const { data: appointments } = await supabase
      .from("email_appointments")
      .select("id, title, appointment_date, appointment_time, location, status")
      .eq("user_id", userId)
      .in("email_id", emailIds)
      .eq("status", "detected");

    if (appointments && appointments.length > 0) {
      metadata.appointments = appointments;
    }

    // Fetch tasks
    const { data: tasks } = await supabase
      .from("email_tasks")
      .select("id, description, due_date, priority, status")
      .eq("user_id", userId)
      .in("email_id", emailIds)
      .in("status", ["open", "in_progress"]);

    if (tasks && tasks.length > 0) {
      metadata.tasks = tasks;
    }

    // Fetch reminders
    const { data: reminders } = await supabase
      .from("email_reminders")
      .select("id, message, remind_at, status")
      .eq("user_id", userId)
      .in("email_id", emailIds)
      .eq("status", "pending");

    if (reminders && reminders.length > 0) {
      metadata.reminders = reminders;
    }
  } catch (error: any) {
    console.error("[GetThreadContext] Error fetching intent metadata:", error);
    // Continue without metadata on error
  }

  return metadata;
}

