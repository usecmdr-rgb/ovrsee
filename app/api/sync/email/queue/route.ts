/**
 * GET /api/sync/email/queue
 * 
 * Returns email queue list for the authenticated user's workspace
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";

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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const filter = searchParams.get("filter"); // Optional filter

    // Build query
    let query = supabaseClient
      .from("sync_email_messages")
      .select("id, subject, snippet, from_address, internal_date, labels", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .order("internal_date", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filter if provided
    if (filter === "unread") {
      query = query.eq("is_read", false);
    } else if (filter === "important") {
      query = query.contains("labels", ["IMPORTANT"]);
    }

    const { data: messages, error: messagesError, count } = await query;

    if (messagesError) {
      console.error("[Sync Email Queue] Error:", messagesError);
      return NextResponse.json(
        { error: "Failed to fetch email queue" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Map to response format
    const items = (messages || []).map((msg) => ({
      id: msg.id,
      subject: msg.subject,
      snippet: msg.snippet,
      fromAddress: msg.from_address,
      internalDate: msg.internal_date,
      labels: msg.labels || [],
    }));

    return NextResponse.json({
      items,
      total: count || 0,
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Sync Email Queue] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch email queue" },
      { status: 500 }
    );
  }
}
