/**
 * Gmail sync worker
 * Fetches messages from Gmail API and stores in sync_email_messages table
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { google } from "googleapis";
import { googleConfig } from "@/lib/config/env";

interface SyncJobRow {
  id: string;
  workspace_id: string;
  integration_id: string | null;
  job_type: string;
  status: string;
  from_cursor: string | null;
  to_cursor: string | null;
}

/**
 * Run initial Gmail sync
 * Fetches recent messages and stores them
 */
export async function runGmailInitialSync(job: SyncJobRow): Promise<void> {
  const supabase = getSupabaseServerClient();

  // Get integration with access token
  if (!job.integration_id) {
    throw new Error("Integration ID is required for sync job");
  }

  const { data: integration, error: integrationError } = await supabase
    .from("integrations")
    .select("access_token, refresh_token, metadata")
    .eq("id", job.integration_id)
    .single();

  if (integrationError || !integration) {
    throw new Error(
      `Integration not found: ${integrationError?.message || "Unknown error"}`
    );
  }

  if (!integration.access_token) {
    throw new Error("Integration missing access token");
  }

  // Initialize Gmail API client with credentials for token refresh
  const oauth2Client = new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret,
    googleConfig.redirectUrl
  );
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token || undefined,
  });

  // Refresh token if needed (googleapis handles this automatically, but we'll update DB)
  try {
    await oauth2Client.refreshAccessToken();
    const credentials = oauth2Client.credentials;
    
    // Update tokens in DB if they changed
    if (credentials.access_token && credentials.access_token !== integration.access_token) {
      await supabase
        .from("integrations")
        .update({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || integration.refresh_token,
          token_expires_at: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
        })
        .eq("id", job.integration_id);
    }
  } catch (refreshError) {
    // If refresh fails, continue with existing token (might still be valid)
    console.warn("Token refresh failed, using existing token:", refreshError);
  }

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Fetch recent messages (last 50 for initial sync)
  const maxResults = 50;
  const { data: messagesResponse, error: messagesError } =
    await gmail.users.messages.list({
      userId: "me",
      maxResults,
      q: "in:inbox", // Only inbox messages for now
    });

  if (messagesError) {
    throw new Error(`Gmail API error: ${messagesError.message}`);
  }

  const messages = messagesResponse.data.messages || [];

  // Fetch full message details and upsert
  for (const messageRef of messages.slice(0, maxResults)) {
    try {
      const { data: message, error: messageError } =
        await gmail.users.messages.get({
          userId: "me",
          id: messageRef.id!,
          format: "full",
        });

      if (messageError || !message.data) {
        console.error(
          `Failed to fetch message ${messageRef.id}:`,
          messageError?.message
        );
        continue;
      }

      const msg = message.data;
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
          ?.value || "";

      // Extract addresses
      const parseAddresses = (value: string): string[] => {
        if (!value) return [];
        return value
          .split(",")
          .map((addr) => addr.trim())
          .filter(Boolean);
      };

      const fromAddress = getHeader("From");
      const toAddresses = parseAddresses(getHeader("To"));
      const ccAddresses = parseAddresses(getHeader("Cc"));
      const bccAddresses = parseAddresses(getHeader("Bcc"));

      // Extract labels
      const labels = msg.labelIds || [];

      // Get user_id from workspace
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("owner_user_id")
        .eq("id", job.workspace_id)
        .single();

      if (!workspace) {
        console.error(`[Gmail Sync] Workspace ${job.workspace_id} not found`);
        continue;
      }

      const userId = workspace.owner_user_id;

      // Parse email body (extract HTML and text)
      let bodyHtml: string | null = null;
      let bodyText: string | null = null;

      if (msg.payload?.body?.data) {
        // Simple body extraction
        const decoded = Buffer.from(msg.payload.body.data, "base64url").toString("utf-8");
        bodyText = decoded;
      }

      if (msg.payload?.parts) {
        for (const part of msg.payload.parts) {
          if (part.mimeType === "text/html" && part.body?.data) {
            bodyHtml = Buffer.from(part.body.data, "base64url").toString("utf-8");
          } else if (part.mimeType === "text/plain" && part.body?.data && !bodyText) {
            bodyText = Buffer.from(part.body.data, "base64url").toString("utf-8");
          }
        }
      }

      // Upsert into email_queue (canonical table)
      const { error: upsertError } = await supabase
        .from("email_queue")
        .upsert(
          {
            user_id: userId,
            gmail_message_id: msg.id!,
            gmail_thread_id: msg.threadId || msg.id!,
            gmail_history_id: msg.historyId || null,
            gmail_labels: labels,
            from_address: fromAddress,
            from_name: null, // Could extract from "From" header if needed
            to_addresses: toAddresses,
            cc_addresses: ccAddresses,
            bcc_addresses: bccAddresses,
            subject: getHeader("Subject") || "(No subject)",
            snippet: msg.snippet || "",
            body_html: bodyHtml,
            body_text: bodyText,
            internal_date: msg.internalDate
              ? new Date(parseInt(msg.internalDate)).toISOString()
              : new Date().toISOString(),
            is_read: !labels.includes("UNREAD"),
            is_starred: labels.includes("STARRED"),
            queue_status: labels.includes("INBOX") ? "open" : "archived",
            classification_status: "pending", // Mark for automatic classification
            metadata: {
              raw_headers: headers.reduce(
                (acc, h) => {
                  if (h.name && h.value) {
                    acc[h.name] = h.value;
                  }
                  return acc;
                },
                {} as Record<string, string>
              ),
            },
          },
          {
            onConflict: "user_id,gmail_message_id",
          }
        );

      if (upsertError) {
        console.error(
          `Failed to upsert message ${msg.id}:`,
          upsertError.message
        );
        // Continue with other messages
      }
    } catch (error: any) {
      console.error(
        `Error processing message ${messageRef.id}:`,
        error.message
      );
      // Continue with other messages
    }
  }

  // Update job with cursor (using the last message ID as cursor)
  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  if (lastMessageId) {
    await supabase
      .from("sync_jobs")
      .update({
        to_cursor: lastMessageId,
      })
      .eq("id", job.id);
  }

  // Update integration last_synced_at
  await supabase
    .from("integrations")
    .update({
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", job.integration_id);
}

