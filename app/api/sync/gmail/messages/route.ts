import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { createErrorResponse, validateQueryParams } from "@/lib/validation";
import { z } from "zod";

const querySchema = z.object({
  limit: z.string().transform(Number).optional(),
  before: z.string().optional(),
  after: z.string().optional(),
  query: z.string().optional(),
});

/**
 * GET /api/sync/gmail/messages
 * 
 * List synced Gmail messages for the current workspace
 * 
 * Query params:
 * - limit?: number (default 50)
 * - before?: ISO date string
 * - after?: ISO date string
 * - query?: string (search in subject/snippet)
 * 
 * Returns:
 * - messages: array of message objects
 */
export async function GET(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Validate query params
    const validation = validateQueryParams(request.nextUrl, querySchema);
    if (!validation.success) {
      return validation.error;
    }

    const { limit = 50, before, after, query } = validation.data;

    // Build query
    let messagesQuery = supabaseClient
      .from("sync_email_messages")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("internal_date", { ascending: false })
      .limit(Math.min(limit, 100)); // Cap at 100

    // Apply date filters
    if (after) {
      messagesQuery = messagesQuery.gte("internal_date", after);
    }
    if (before) {
      messagesQuery = messagesQuery.lte("internal_date", before);
    }

    // Apply text search if provided
    if (query) {
      messagesQuery = messagesQuery.or(
        `subject.ilike.%${query}%,snippet.ilike.%${query}%`
      );
    }

    const { data: messages, error: messagesError } = await messagesQuery;

    if (messagesError) {
      return createErrorResponse(
        `Failed to fetch messages: ${messagesError.message}`,
        500
      );
    }

    // Transform messages (exclude raw_headers by default for performance)
    const transformedMessages = (messages || []).map((msg) => ({
      id: msg.id,
      externalId: msg.external_id,
      threadId: msg.thread_id,
      fromAddress: msg.from_address,
      toAddresses: msg.to_addresses,
      ccAddresses: msg.cc_addresses,
      bccAddresses: msg.bcc_addresses,
      subject: msg.subject,
      snippet: msg.snippet,
      internalDate: msg.internal_date,
      labels: msg.labels,
      isRead: msg.is_read,
      isImportant: msg.is_important,
      createdAt: msg.created_at,
      updatedAt: msg.updated_at,
      // rawHeaders: msg.raw_headers, // Excluded by default, can be added if needed
    }));

    return NextResponse.json({
      messages: transformedMessages,
      count: transformedMessages.length,
    }, { headers: responseHeaders });
  } catch (error: any) {
    console.error("Error fetching Gmail messages:", error);
    return createErrorResponse(
      error.message || "Failed to fetch messages",
      500
    );
  }
}
