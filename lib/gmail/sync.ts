/**
 * Gmail Sync Service
 * Handles syncing Gmail messages to OVRSEE email queue
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import {
  listGmailMessages,
  getGmailMessage,
  getGmailHistory,
  parseEmailHeaders,
  extractEmailBody,
  type GmailMessage,
} from "./client";

export interface SyncResult {
  synced: number;
  updated: number;
  errors: number;
  lastHistoryId?: string;
}

/**
 * Initial sync: Import messages from Gmail
 */
export async function initialGmailSync(
  userId: string,
  options: {
    daysBack?: number; // Default 30 days
    maxMessages?: number; // Default 500
  } = {}
): Promise<SyncResult> {
  const { daysBack = 30, maxMessages = 500 } = options;
  const supabase = getSupabaseServerClient();

  console.log(`[Gmail Sync] Starting initial sync for user_id: ${userId}, daysBack: ${daysBack}, maxMessages: ${maxMessages}`);

  // Check if Gmail is connected
  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!connection) {
    console.error(`[Gmail Sync] No Gmail connection found for user_id: ${userId}`);
    throw new Error("Gmail not connected");
  }

  console.log(`[Gmail Sync] Found Gmail connection for user_id: ${userId}`);

  // Calculate date for query
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - daysBack);
  const query = `in:inbox after:${Math.floor(dateThreshold.getTime() / 1000)}`;

  let synced = 0;
  let updated = 0;
  let errors = 0;
  let pageToken: string | undefined;
  let lastHistoryId: string | undefined;

  // Update sync status
  await supabase
    .from("gmail_connections")
    .update({
      sync_status: "syncing",
      sync_error: null,
    })
    .eq("user_id", userId);

  try {
    do {
      // List messages
      const listResponse = await listGmailMessages(userId, {
        maxResults: Math.min(100, maxMessages - synced),
        pageToken,
        q: query,
        labelIds: ["INBOX"],
      });

      if (!listResponse.messages || listResponse.messages.length === 0) {
        break;
      }

      // Process messages in batches
      console.log(`[Gmail Sync] Processing ${listResponse.messages.length} messages...`);
      for (const msgRef of listResponse.messages) {
        try {
          const message = await getGmailMessage(userId, msgRef.id, "full");
          lastHistoryId = message.historyId;

          // Parse message
          const parsed = await parseGmailMessage(message);

          // Upsert into email_queue
          const { error: upsertError } = await supabase
            .from("email_queue")
            .upsert(
              {
                user_id: userId,
                gmail_message_id: message.id,
                gmail_thread_id: message.threadId,
                gmail_history_id: message.historyId,
                gmail_labels: message.labelIds || [],
                from_address: parsed.from || "",
                from_name: parsed.fromName,
                to_addresses: parsed.to || [],
                cc_addresses: parsed.cc || [],
                bcc_addresses: parsed.bcc || [],
                subject: parsed.subject || "(No subject)",
                snippet: message.snippet || "",
                body_html: parsed.bodyHtml,
                body_text: parsed.bodyText,
                internal_date: new Date(parseInt(message.internalDate)).toISOString(),
                is_read: !message.labelIds?.includes("UNREAD"),
                is_starred: message.labelIds?.includes("STARRED"),
                queue_status: determineQueueStatus(message.labelIds || []),
                category_id: determineCategory(parsed.subject || "", message.snippet || ""),
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: "user_id,gmail_message_id",
              }
            );

          if (upsertError) {
            console.error(`[Gmail Sync] Error upserting message ${message.id} for user_id ${userId}:`, upsertError);
            errors++;
          } else {
            // Check if it was an insert or update
            const { data: existing } = await supabase
              .from("email_queue")
              .select("id")
              .eq("user_id", userId)
              .eq("gmail_message_id", message.id)
              .single();

            if (existing) {
              updated++;
            } else {
              synced++;
            }
          }
        } catch (error: any) {
          console.error(`[Gmail Sync] Error processing message ${msgRef.id} for user_id ${userId}:`, error);
          errors++;
        }
      }

      pageToken = listResponse.nextPageToken;
    } while (pageToken && synced < maxMessages);

    // Update connection with last sync info
    await supabase
      .from("gmail_connections")
      .update({
        last_history_id: lastHistoryId,
        last_sync_at: new Date().toISOString(),
        sync_status: "idle",
        sync_error: null,
      })
      .eq("user_id", userId);

    console.log(`[Gmail Sync] Initial sync completed for user_id: ${userId}, synced: ${synced}, updated: ${updated}, errors: ${errors}`);

    return {
      synced,
      updated,
      errors,
      lastHistoryId,
    };
  } catch (error: any) {
    // Update sync status with error
    await supabase
      .from("gmail_connections")
      .update({
        sync_status: "error",
        sync_error: error.message || "Unknown error",
      })
      .eq("user_id", userId);

    throw error;
  }
}

/**
 * Incremental sync: Get changes since last sync
 */
export async function incrementalGmailSync(userId: string): Promise<SyncResult> {
  const supabase = getSupabaseServerClient();

  // Get last history ID
  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("last_history_id")
    .eq("user_id", userId)
    .single();

  if (!connection?.last_history_id) {
    // No previous sync, do initial sync
    return initialGmailSync(userId, { daysBack: 7, maxMessages: 100 });
  }

  // Update sync status
  await supabase
    .from("gmail_connections")
    .update({
      sync_status: "syncing",
      sync_error: null,
    })
    .eq("user_id", userId);

  let synced = 0;
  let updated = 0;
  let errors = 0;
  let lastHistoryId: string | undefined;

  try {
    // Get history
    const historyResponse = await getGmailHistory(userId, connection.last_history_id, 100);

    if (!historyResponse.history || historyResponse.history.length === 0) {
      // No changes
      await supabase
        .from("gmail_connections")
        .update({
          last_sync_at: new Date().toISOString(),
          sync_status: "idle",
        })
        .eq("user_id", userId);

      return { synced: 0, updated: 0, errors: 0 };
    }

    lastHistoryId = historyResponse.historyId || historyResponse.nextHistoryId;

    // Process history entries
    for (const historyEntry of historyResponse.history) {
      try {
        // Handle new messages
        if (historyEntry.messagesAdded) {
          for (const added of historyEntry.messagesAdded) {
            const message = await getGmailMessage(userId, added.message.id, "full");
            const parsed = await parseGmailMessage(message);

            const { error: upsertError } = await supabase
              .from("email_queue")
              .upsert(
                {
                  user_id: userId,
                  gmail_message_id: message.id,
                  gmail_thread_id: message.threadId,
                  gmail_history_id: message.historyId,
                  gmail_labels: message.labelIds || [],
                  from_address: parsed.from || "",
                  from_name: parsed.fromName,
                  to_addresses: parsed.to || [],
                  cc_addresses: parsed.cc || [],
                  bcc_addresses: parsed.bcc || [],
                  subject: parsed.subject || "(No subject)",
                  snippet: message.snippet || "",
                  body_html: parsed.bodyHtml,
                  body_text: parsed.bodyText,
                  internal_date: new Date(parseInt(message.internalDate)).toISOString(),
                  is_read: !message.labelIds?.includes("UNREAD"),
                  is_starred: message.labelIds?.includes("STARRED"),
                  queue_status: determineQueueStatus(message.labelIds || []),
                  category_id: determineCategory(parsed.subject || "", message.snippet || ""),
                  updated_at: new Date().toISOString(),
                },
                {
                  onConflict: "user_id,gmail_message_id",
                }
              );

            if (upsertError) {
              errors++;
            } else {
              synced++;
            }
          }
        }

        // Handle label changes (read/unread, archive, etc.)
        if (historyEntry.labelsAdded || historyEntry.labelsRemoved) {
          for (const labelChange of [
            ...(historyEntry.labelsAdded || []),
            ...(historyEntry.labelsRemoved || []),
          ]) {
            const messageId = labelChange.message.id;
            const labels = labelChange.labelIds || [];

            // Update queue status based on labels
            const queueStatus = determineQueueStatus(labels);
            const isRead = !labels.includes("UNREAD");
            const isStarred = labels.includes("STARRED");

            const { error: updateError } = await supabase
              .from("email_queue")
              .update({
                gmail_labels: labels,
                queue_status: queueStatus,
                is_read: isRead,
                is_starred: isStarred,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId)
              .eq("gmail_message_id", messageId);

            if (!updateError) {
              updated++;
            } else {
              errors++;
            }
          }
        }

        // Handle deleted messages
        if (historyEntry.messagesDeleted) {
          for (const deleted of historyEntry.messagesDeleted) {
            const { error: deleteError } = await supabase
              .from("email_queue")
              .update({
                deleted_at: new Date().toISOString(),
                deleted_by: userId,
                deleted_source: "gmail",
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId)
              .eq("gmail_message_id", deleted.message.id);

            if (deleteError) {
              errors++;
            } else {
              updated++;
            }
          }
        }
      } catch (error: any) {
        console.error("Error processing history entry:", error);
        errors++;
      }
    }

    // Update connection
    await supabase
      .from("gmail_connections")
      .update({
        last_history_id: lastHistoryId,
        last_sync_at: new Date().toISOString(),
        sync_status: "idle",
        sync_error: null,
      })
      .eq("user_id", userId);

    return {
      synced,
      updated,
      errors,
      lastHistoryId,
    };
  } catch (error: any) {
    await supabase
      .from("gmail_connections")
      .update({
        sync_status: "error",
        sync_error: error.message || "Unknown error",
      })
      .eq("user_id", userId);

    throw error;
  }
}

/**
 * Parse Gmail message into structured format
 */
async function parseGmailMessage(message: GmailMessage): Promise<{
  from?: string;
  fromName?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
}> {
  const headers = message.payload?.headers || [];
  const parsedHeaders = parseEmailHeaders(headers);
  const body = extractEmailBody(message);

  return {
    from: parsedHeaders.from,
    fromName: parsedHeaders.fromName,
    to: parsedHeaders.to,
    cc: parsedHeaders.cc,
    bcc: parsedHeaders.bcc,
    subject: parsedHeaders.subject,
    bodyHtml: body.html,
    bodyText: body.text,
  };
}

/**
 * Determine queue status from Gmail labels
 */
function determineQueueStatus(labelIds: string[]): "open" | "snoozed" | "done" | "archived" {
  // If archived (not in INBOX), mark as archived
  if (!labelIds.includes("INBOX")) {
    return "archived";
  }

  // Default to open
  return "open";
}

/**
 * Determine category from subject and snippet
 */
function determineCategory(subject: string, snippet: string): string | null {
  const text = `${subject} ${snippet}`.toLowerCase();

  if (
    text.includes("payment") ||
    text.includes("invoice") ||
    text.includes("bill") ||
    text.includes("payout") ||
    text.includes("stripe") ||
    text.includes("paypal")
  ) {
    return "payments";
  }

  if (text.includes("invoice") || text.includes("billing")) {
    return "invoices";
  }

  if (
    text.includes("urgent") ||
    text.includes("important") ||
    text.includes("asap") ||
    text.includes("deadline")
  ) {
    return "important";
  }

  if (text.includes("meeting") || text.includes("calendar") || text.includes("appointment")) {
    return "meetings";
  }

  if (text.includes("subscription") || text.includes("renewal")) {
    return "subscriptions";
  }

  return null;
}

