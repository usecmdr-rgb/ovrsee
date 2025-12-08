/**
 * Gmail API Client
 * Handles authentication, token refresh, and Gmail API operations
 * 
 * IMPORTANT: This uses GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET for OAuth,
 * which is SEPARATE from Supabase Google authentication.
 * 
 * - Supabase Google login: Uses Supabase's OAuth client
 * - Gmail OAuth: Uses GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET from Google Cloud Console
 * 
 * Now uses integrations table instead of gmail_connections
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getOrCreateWorkspace, getWorkspaceIntegration } from "@/lib/sync/integrations";

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId?: string;
  internalDate: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: {
      data?: string;
      size?: number;
    };
    parts?: Array<{
      mimeType: string;
      body: { data?: string; size?: number };
      parts?: Array<{
        mimeType: string;
        body: { data?: string; size?: number };
      }>;
    }>;
  };
}

export interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailMessage[];
}

export interface GmailListResponse {
  messages: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailHistoryResponse {
  history: Array<{
    id: string;
    messages?: Array<{ id: string; threadId: string }>;
    messagesAdded?: Array<{ message: GmailMessage }>;
    messagesDeleted?: Array<{ message: { id: string; threadId: string } }>;
    labelsAdded?: Array<{ message: { id: string; threadId: string }; labelIds: string[] }>;
    labelsRemoved?: Array<{ message: { id: string; threadId: string }; labelIds: string[] }>;
  }>;
  nextHistoryId?: string;
  historyId?: string;
}

/**
 * Get valid access token, refreshing if necessary
 * Now uses integrations table instead of gmail_connections
 */
export async function getGmailAccessToken(userId: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  
  // Get or create workspace
  const workspace = await getOrCreateWorkspace(userId);

  // Get Gmail integration
  const integration = await getWorkspaceIntegration(workspace.id, "gmail");

  if (!integration || !integration.is_active || !integration.access_token) {
    throw new Error("Gmail not connected");
  }

  // Check if token is expired or expires soon (within 5 minutes)
  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAt && expiresAt <= fiveMinutesFromNow) {
    // Token expired or expiring soon, refresh it
    if (!integration.refresh_token) {
      throw new Error("Refresh token missing - please reconnect Gmail");
    }

    const newToken = await refreshGmailToken(integration.refresh_token, userId, integration.id);
    return newToken;
  }

  return integration.access_token;
}

/**
 * Refresh Gmail access token
 * Now uses integrations table instead of gmail_connections
 */
async function refreshGmailToken(refreshToken: string, userId: string, integrationId: string): Promise<string> {
  const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    throw new Error(
      "Gmail OAuth not configured. " +
      "Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your environment variables. " +
      "See app/api/gmail/auth/route.ts for setup instructions."
    );
  }
  
  // Validate they're not placeholders
  if (GMAIL_CLIENT_ID.includes("your_") || GMAIL_CLIENT_SECRET.includes("your_")) {
    throw new Error(
      "Gmail OAuth credentials contain placeholder values. " +
      "Please set actual values from Google Cloud Console in your .env.local file."
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Token refresh failed:", error);
    throw new Error("Failed to refresh Gmail token");
  }

  const data = await response.json();
  const { access_token, expires_in } = data;

  // Update stored token in integrations table
  const supabase = getSupabaseServerClient();
  const expiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString();

  await supabase
    .from("integrations")
    .update({
      access_token: access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId);

  return access_token;
}

/**
 * Make authenticated Gmail API request
 */
async function gmailApiRequest(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = await getGmailAccessToken(userId);

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Handle token refresh on 401
  if (response.status === 401) {
    // Try refreshing token once
    const supabase = getSupabaseServerClient();
    const { data: connection } = await supabase
      .from("gmail_connections")
      .select("refresh_token")
      .eq("user_id", userId)
      .single();

    if (connection?.refresh_token) {
      await refreshGmailToken(connection.refresh_token, userId);
      const newAccessToken = await getGmailAccessToken(userId);
      
      // Retry request with new token
      return fetch(`https://gmail.googleapis.com/gmail/v1/${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${newAccessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    }
  }

  return response;
}

/**
 * List messages from Gmail
 */
export async function listGmailMessages(
  userId: string,
  options: {
    maxResults?: number;
    pageToken?: string;
    q?: string; // Gmail search query
    labelIds?: string[];
  } = {}
): Promise<GmailListResponse> {
  const params = new URLSearchParams();
  if (options.maxResults) params.set("maxResults", String(options.maxResults));
  if (options.pageToken) params.set("pageToken", options.pageToken);
  if (options.q) params.set("q", options.q);
  if (options.labelIds) {
    options.labelIds.forEach((label) => params.append("labelIds", label));
  }

  const response = await gmailApiRequest(
    userId,
    `users/me/messages?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list messages: ${error}`);
  }

  return response.json();
}

/**
 * Get full message details
 */
export async function getGmailMessage(
  userId: string,
  messageId: string,
  format: "full" | "metadata" | "minimal" = "full"
): Promise<GmailMessage> {
  const response = await gmailApiRequest(
    userId,
    `users/me/messages/${messageId}?format=${format}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get message: ${error}`);
  }

  return response.json();
}

/**
 * Get thread details
 */
export async function getGmailThread(
  userId: string,
  threadId: string
): Promise<GmailThread> {
  const response = await gmailApiRequest(
    userId,
    `users/me/threads/${threadId}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get thread: ${error}`);
  }

  return response.json();
}

/**
 * Get history for incremental sync
 */
export async function getGmailHistory(
  userId: string,
  startHistoryId: string,
  maxResults?: number
): Promise<GmailHistoryResponse> {
  const params = new URLSearchParams();
  params.set("startHistoryId", startHistoryId);
  if (maxResults) params.set("maxResults", String(maxResults));

  const response = await gmailApiRequest(
    userId,
    `users/me/history?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get history: ${error}`);
  }

  return response.json();
}

/**
 * Modify message labels (mark read/unread, archive, etc.)
 */
export async function modifyMessageLabels(
  userId: string,
  messageId: string,
  addLabelIds?: string[],
  removeLabelIds?: string[]
): Promise<GmailMessage> {
  const body: any = {};
  if (addLabelIds && addLabelIds.length > 0) {
    body.addLabelIds = addLabelIds;
  }
  if (removeLabelIds && removeLabelIds.length > 0) {
    body.removeLabelIds = removeLabelIds;
  }

  const response = await gmailApiRequest(userId, `users/me/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to modify labels: ${error}`);
  }

  return response.json();
}

/**
 * Send email via Gmail
 */
export async function sendGmailMessage(
  userId: string,
  rawMessage: string, // RFC 2822 formatted email
  threadId?: string
): Promise<{ id: string; threadId: string; labelIds: string[] }> {
  const body: any = { raw: rawMessage };
  if (threadId) {
    body.threadId = threadId;
  }

  const response = await gmailApiRequest(userId, "users/me/messages/send", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send message: ${error}`);
  }

  return response.json();
}

/**
 * Trash a message
 */
export async function trashGmailMessage(
  userId: string,
  messageId: string
): Promise<GmailMessage> {
  const response = await gmailApiRequest(
    userId,
    `users/me/messages/${messageId}/trash`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to trash message: ${error}`);
  }

  return response.json();
}

/**
 * Parse email headers
 */
export function parseEmailHeaders(headers: Array<{ name: string; value: string }>): {
  from?: string;
  fromName?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  date?: string;
} {
  const result: any = {};

  for (const header of headers) {
    const name = header.name.toLowerCase();
    const value = header.value;

    switch (name) {
      case "from":
        // Parse "Name <email@example.com>" format
        const fromMatch = value.match(/^(.+?)\s*<(.+?)>$|^(.+?)$/);
        if (fromMatch) {
          result.fromName = fromMatch[1]?.trim() || fromMatch[3]?.trim();
          result.from = fromMatch[2]?.trim() || fromMatch[3]?.trim();
        } else {
          result.from = value.trim();
        }
        break;
      case "to":
        result.to = value.split(",").map((e) => e.trim());
        break;
      case "cc":
        result.cc = value.split(",").map((e) => e.trim());
        break;
      case "bcc":
        result.bcc = value.split(",").map((e) => e.trim());
        break;
      case "subject":
        result.subject = value;
        break;
      case "date":
        result.date = value;
        break;
    }
  }

  return result;
}

/**
 * Decode base64url email body
 */
export function decodeEmailBody(data: string): string {
  // Gmail uses base64url encoding
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  const paddedBase64 = base64 + "=".repeat(padding ? 4 - padding : 0);
  
  try {
    return Buffer.from(paddedBase64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/**
 * Extract email body from message payload
 */
export function extractEmailBody(message: GmailMessage): {
  html?: string;
  text?: string;
} {
  const result: { html?: string; text?: string } = {};

  if (!message.payload) {
    return result;
  }

  function extractFromPart(part: any) {
    if (part.body?.data) {
      const decoded = decodeEmailBody(part.body.data);
      if (part.mimeType === "text/html") {
        result.html = decoded;
      } else if (part.mimeType === "text/plain") {
        result.text = decoded;
      }
    }

    if (part.parts) {
      part.parts.forEach(extractFromPart);
    }
  }

  // Check main body
  if (message.payload.body?.data) {
    const decoded = decodeEmailBody(message.payload.body.data);
    result.text = decoded;
  }

  // Check parts
  if (message.payload.parts) {
    message.payload.parts.forEach(extractFromPart);
  }

  return result;
}

