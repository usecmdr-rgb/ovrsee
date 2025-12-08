import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { initialGmailSync, incrementalGmailSync } from "@/lib/gmail/sync";
import { getOrCreateWorkspace, getWorkspaceIntegration } from "@/lib/sync/integrations";

/**
 * POST /api/gmail/sync
 * Trigger Gmail sync (initial or incremental)
 * Now uses integrations table instead of gmail_connections
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

    // Get or create workspace
    const workspace = await getOrCreateWorkspace(userId);

    // Check if Gmail is connected (using integrations table)
    const integration = await getWorkspaceIntegration(workspace.id, "gmail");

    if (!integration || !integration.is_active) {
      return NextResponse.json(
        { error: "Gmail not connected. Please connect Gmail first." },
        { status: 400 }
      );
    }

    // Determine sync type
    const body = await request.json().catch(() => ({}));
    // For now, default to initial if no last_synced_at, otherwise incremental
    const syncType = body.type || (integration.last_synced_at ? "incremental" : "initial");

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
 * Now uses integrations table instead of gmail_connections
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

    // Get or create workspace
    const workspace = await getOrCreateWorkspace(userId);

    // Get Gmail integration
    const integration = await getWorkspaceIntegration(workspace.id, "gmail");

    if (!integration || !integration.is_active) {
      return NextResponse.json({
        connected: false,
      });
    }

    return NextResponse.json({
      connected: true,
      lastSyncAt: integration.last_synced_at,
      syncStatus: integration.sync_status || "idle",
      syncError: integration.last_error,
      lastHistoryId: null, // Not stored in integrations table, would need to add if needed
    });
  } catch (error: any) {
    console.error("Error getting sync status:", error);
    return NextResponse.json(
      { error: "Failed to get sync status" },
      { status: 500 }
    );
  }
}



