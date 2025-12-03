/**
 * GET /api/sync/email/message/:id
 * 
 * Returns detailed email message information
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const messageId = params.id;

    if (!messageId) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Get message
    const { data: message, error: messageError } = await supabaseClient
      .from("sync_email_messages")
      .select("*")
      .eq("id", messageId)
      .eq("workspace_id", workspaceId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Map to response format
    return NextResponse.json({
      id: message.id,
      subject: message.subject,
      snippet: message.snippet,
      fromAddress: message.from_address,
      toAddresses: message.to_addresses || [],
      ccAddresses: message.cc_addresses || [],
      bccAddresses: message.bcc_addresses || [],
      internalDate: message.internal_date,
      labels: message.labels || [],
      rawHeaders: message.raw_headers || {},
      metadata: message.metadata || {},
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Sync Email Message] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch email message" },
      { status: 500 }
    );
  }
}
