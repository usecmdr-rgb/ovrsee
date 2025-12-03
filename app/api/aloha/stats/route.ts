/**
 * GET /api/aloha/stats
 * 
 * Returns call statistics for the authenticated user's workspace
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
    
    // Get time range from query params (default to last 30 days)
    const searchParams = new URL(request.url).searchParams;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    
    const now = new Date();
    const to = toParam ? new Date(toParam) : now;
    const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Build query for call_logs
    let query = supabaseClient
      .from("call_logs")
      .select("id, status, has_voicemail", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .gte("started_at", from.toISOString())
      .lte("started_at", to.toISOString());
    
    const { data: calls, error: callsError, count } = await query;
    
    if (callsError) {
      console.error("[Aloha Stats] Error fetching calls:", callsError);
      return NextResponse.json(
        { error: "Failed to fetch call statistics" },
        { status: 500, headers: responseHeaders }
      );
    }
    
    // Calculate stats
    const totalCalls = count || 0;
    const answeredCalls = calls?.filter(c => c.status === "completed" || c.status === "in-progress").length || 0;
    const missedCalls = calls?.filter(c => c.status === "no-answer" || c.status === "missed").length || 0;
    
    // TODO: Derive newAppointments from calls that have appointment-related flags
    // For now, return 0 as placeholder
    const newAppointments = 0;
    
    return NextResponse.json({
      totalCalls,
      answeredCalls,
      missedCalls,
      newAppointments,
      timeRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    console.error("[Aloha Stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
