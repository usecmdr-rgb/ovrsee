/**
 * GET /api/aloha/conversation-intelligence/summary
 * 
 * Returns lightweight stats for the Conversation Intelligence card
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
    
    // Get time range (default to last 30 days)
    const now = new Date();
    const to = now;
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Check if we have any call data with transcripts/summaries
    const { data: callsWithData, error: callsError } = await supabaseClient
      .from("call_logs")
      .select("id")
      .eq("workspace_id", workspaceId)
      .gte("started_at", from.toISOString())
      .lte("started_at", to.toISOString())
      .limit(1);
    
    // Check voicemail messages with transcripts
    const { data: voicemailsWithData, error: voicemailsError } = await supabaseClient
      .from("voicemail_messages")
      .select("id")
      .eq("workspace_id", workspaceId)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .not("transcript", "is", null)
      .limit(1);
    
    const hasData = (callsWithData && callsWithData.length > 0) || 
                    (voicemailsWithData && voicemailsWithData.length > 0);
    
    return NextResponse.json({
      hasData,
      samplePeriod: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      stats: {
        // Placeholder stats - can be populated when AI processing is implemented
        totalConversations: 0,
        analyzedConversations: 0,
        averageSentiment: null,
        keyTopics: [],
      },
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    console.error("[Conversation Intelligence Summary] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation intelligence summary" },
      { status: 500 }
    );
  }
}
