/**
 * GET /api/aloha/calls
 * 
 * List call logs for the authenticated user's workspace
 * Supports filtering by outcome, search, pagination
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

    // Query parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const outcome = searchParams.get("outcome"); // answered, missed, voicemail
    const search = searchParams.get("search"); // caller name/number

    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabaseClient
      .from("call_logs")
      .select("id, caller_name, caller_number, started_at, duration_seconds, status, has_voicemail, recording_url, metadata", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .order("started_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    // Map outcome to status
    if (outcome === "answered") {
      query = query.in("status", ["completed", "in-progress"]);
    } else if (outcome === "missed") {
      query = query.in("status", ["no-answer", "missed", "busy"]);
    } else if (outcome === "voicemail") {
      query = query.eq("has_voicemail", true);
    }

    // Search by caller name or number
    if (search) {
      query = query.or(`caller_name.ilike.%${search}%,caller_number.ilike.%${search}%`);
    }

    const { data: calls, error: callsError, count } = await query;

    if (callsError) {
      console.error("[Aloha Calls] Error fetching calls:", callsError);
      return NextResponse.json(
        { error: "Failed to fetch calls" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Get voicemail data for calls that have voicemail
    const callIdsWithVoicemail = calls?.filter(c => c.has_voicemail).map(c => c.id) || [];
    let voicemails: any[] = [];
    if (callIdsWithVoicemail.length > 0) {
      const { data: vmData } = await supabaseClient
        .from("voicemail_messages")
        .select("call_log_id, transcript, summary")
        .in("call_log_id", callIdsWithVoicemail);
      voicemails = vmData || [];
    }

    // Map to UI contract
    const items = (calls || []).map((call) => {
      const voicemail = voicemails.find(v => v.call_log_id === call.id);
      
      // Determine outcome
      let callOutcome: "answered" | "missed" | "voicemail";
      if (call.has_voicemail) {
        callOutcome = "voicemail";
      } else if (call.status === "completed" || call.status === "in-progress") {
        callOutcome = "answered";
      } else {
        callOutcome = "missed";
      }

      // Extract sentiment from metadata if available
      const sentiment = call.metadata?.sentiment || null;
      
      return {
        id: call.id,
        callerName: call.caller_name,
        callerNumber: call.caller_number,
        startedAt: call.started_at,
        durationSeconds: call.duration_seconds,
        outcome: callOutcome,
        sentiment: sentiment && ["positive", "neutral", "negative"].includes(sentiment) 
          ? sentiment 
          : null,
        summary: voicemail?.summary || call.metadata?.summary || null,
      };
    });

    return NextResponse.json({
      items,
      page,
      pageSize,
      total: count || 0,
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Aloha Calls] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calls" },
      { status: 500 }
    );
  }
}
