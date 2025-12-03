/**
 * GET /api/aloha/calls/:id
 * 
 * Get detailed call log information including voicemail, transcript, summary
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

    const callId = params.id;

    if (!callId) {
      return NextResponse.json(
        { error: "Call ID is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Get call log
    const { data: callLog, error: callLogError } = await supabaseClient
      .from("call_logs")
      .select("*")
      .eq("id", callId)
      .eq("workspace_id", workspaceId)
      .single();

    if (callLogError || !callLog) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Get voicemail if exists
    const { data: voicemail } = await supabaseClient
      .from("voicemail_messages")
      .select("*")
      .eq("call_log_id", callId)
      .single();

    // Determine outcome
    let outcome: "answered" | "missed" | "voicemail";
    if (callLog.has_voicemail) {
      outcome = "voicemail";
    } else if (callLog.status === "completed" || callLog.status === "in-progress") {
      outcome = "answered";
    } else {
      outcome = "missed";
    }

    // Extract sentiment from metadata
    const sentiment = callLog.metadata?.sentiment || null;

    return NextResponse.json({
      id: callLog.id,
      callerName: callLog.caller_name,
      callerNumber: callLog.caller_number,
      startedAt: callLog.started_at,
      durationSeconds: callLog.duration_seconds,
      outcome,
      sentiment: sentiment && ["positive", "neutral", "negative"].includes(sentiment) 
        ? sentiment 
        : null,
      summary: voicemail?.summary || callLog.metadata?.summary || null,
      recordingUrl: callLog.recording_url || null,
      voicemail: voicemail
        ? {
            id: voicemail.id,
            recordingUrl: voicemail.recording_url,
            recordingDurationSeconds: voicemail.recording_duration_seconds,
            transcript: voicemail.transcript,
            transcriptCompletedAt: voicemail.transcript_completed_at,
            summary: voicemail.summary,
            summaryCompletedAt: voicemail.summary_completed_at,
            extractedFields: voicemail.extracted_fields,
            isRead: voicemail.is_read,
            createdAt: voicemail.created_at,
          }
        : null,
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Aloha Call Detail] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch call details" },
      { status: 500 }
    );
  }
}
