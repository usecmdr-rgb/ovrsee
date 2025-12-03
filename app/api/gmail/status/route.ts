import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * GET /api/gmail/status
 * Get Gmail connection status for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken || accessToken === "dev-token") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = userResult.user.id;

    // Check for Gmail connection
    const { data: connection, error: connectionError } = await supabase
      .from("gmail_connections")
      .select("last_sync_at, sync_status, sync_error, last_history_id, access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json({
        connected: false,
        lastSyncAt: null,
        syncStatus: null,
        syncError: null,
        lastHistoryId: null,
      });
    }

    // Check if tokens are valid (access token exists and not expired)
    const hasValidTokens = connection.access_token && 
      connection.refresh_token && 
      (!connection.expires_at || new Date(connection.expires_at) > new Date());

    return NextResponse.json({
      connected: hasValidTokens,
      lastSyncAt: connection.last_sync_at,
      syncStatus: connection.sync_status || "idle",
      syncError: connection.sync_error,
      lastHistoryId: connection.last_history_id,
    });
  } catch (error: any) {
    console.error("Error getting Gmail status:", error);
    return NextResponse.json(
      { 
        error: "Failed to get Gmail status",
        connected: false,
      },
      { status: 500 }
    );
  }
}



