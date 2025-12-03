/**
 * GET /api/aloha/analytics/conversation
 * 
 * Returns conversation intelligence analytics
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

    // Get time range (default to last 30 days)
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const now = new Date();
    const to = toParam ? new Date(toParam) : now;
    const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Check if we have any data
    const { data: calls, error: callsError } = await supabaseClient
      .from("call_logs")
      .select("id, metadata")
      .eq("workspace_id", workspaceId)
      .gte("started_at", from.toISOString())
      .lte("started_at", to.toISOString());

    const { data: voicemails, error: voicemailsError } = await supabaseClient
      .from("voicemail_messages")
      .select("id, extracted_fields, metadata")
      .eq("workspace_id", workspaceId)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());

    const hasData = (calls && calls.length > 0) || (voicemails && voicemails.length > 0);

    // For now, return zeros with stable shape
    // Future AI processing can populate these fields
    return NextResponse.json({
      hasData,
      from: from.toISOString(),
      to: to.toISOString(),
      questionTypes: {},
      statementTypes: {},
      emotionalStates: {},
      callFlowIntents: {},
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Conversation Analytics] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation analytics" },
      { status: 500 }
    );
  }
}
