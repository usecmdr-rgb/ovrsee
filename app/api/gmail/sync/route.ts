import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { initialGmailSync, incrementalGmailSync } from "@/lib/gmail/sync";

/**
 * POST /api/gmail/sync
 * Trigger Gmail sync (initial or incremental)
 */
export async function POST(request: NextRequest) {
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

    // Get authenticated user
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = userResult.user.id;

    // Check if Gmail is connected
    const { data: connection } = await supabase
      .from("gmail_connections")
      .select("last_history_id")
      .eq("user_id", userId)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "Gmail not connected" },
        { status: 400 }
      );
    }

    // Determine sync type
    const body = await request.json().catch(() => ({}));
    const syncType = body.type || (connection.last_history_id ? "incremental" : "initial");

    let result;
    if (syncType === "initial") {
      result = await initialGmailSync(userId, {
        daysBack: body.daysBack || 30,
        maxMessages: body.maxMessages || 500,
      });
    } else {
      result = await incrementalGmailSync(userId);
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Gmail sync error:", error);
    return NextResponse.json(
      {
        error: "Sync failed",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gmail/sync
 * Get sync status
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

    const { data: connection } = await supabase
      .from("gmail_connections")
      .select("last_sync_at, sync_status, sync_error, last_history_id")
      .eq("user_id", userId)
      .single();

    if (!connection) {
      return NextResponse.json({
        connected: false,
      });
    }

    return NextResponse.json({
      connected: true,
      lastSyncAt: connection.last_sync_at,
      syncStatus: connection.sync_status,
      syncError: connection.sync_error,
      lastHistoryId: connection.last_history_id,
    });
  } catch (error: any) {
    console.error("Error getting sync status:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}



