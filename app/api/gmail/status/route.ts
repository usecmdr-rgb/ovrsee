import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIntegration, getOrCreateWorkspace } from "@/lib/sync/integrations";

/**
 * GET /api/gmail/status
 * Get Gmail connection status for the current user
 * Now uses the integrations table instead of gmail_connections
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

    // Get or create workspace for user
    let workspace;
    try {
      workspace = await getOrCreateWorkspace(userId);
    } catch (error: any) {
      console.error("[Gmail Status] Error getting workspace:", error);
      return NextResponse.json({
        connected: false,
        lastSyncAt: null,
        syncStatus: null,
        syncError: null,
        lastHistoryId: null,
      });
    }

    // Check for Gmail integration in the integrations table
    let integration;
    try {
      integration = await getWorkspaceIntegration(workspace.id, "gmail");
    } catch (error: any) {
      // Integration not found is okay - means not connected
      console.log("[Gmail Status] No Gmail integration found for workspace:", workspace.id);
    }

    if (!integration) {
      return NextResponse.json({
        connected: false,
        lastSyncAt: null,
        syncStatus: null,
        syncError: null,
        lastHistoryId: null,
      });
    }

    // Check if tokens are valid (access token exists and not expired)
    const hasValidTokens = integration.access_token && 
      integration.refresh_token && 
      (!integration.token_expires_at || new Date(integration.token_expires_at) > new Date());

    return NextResponse.json({
      connected: hasValidTokens && integration.is_active,
      lastSyncAt: integration.last_synced_at,
      syncStatus: integration.sync_status || "idle",
      syncError: integration.last_error,
      lastHistoryId: null, // Not stored in integrations table, would need to add if needed
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



