/**
 * Studio Social Accounts API
 * 
 * GET /api/studio/social/accounts
 * 
 * Returns current connection status for each platform for this workspace
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
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Fetch social accounts for this workspace
    const { data: accounts, error: accountsError } = await supabaseClient
      .from("studio_social_accounts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("platform", { ascending: true });

    if (accountsError) {
      console.error("Error fetching social accounts:", accountsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch social accounts", details: accountsError.message },
        { status: 500, headers: responseHeaders }
      );
    }

    // Build response with all platforms (default to disconnected if not found)
    const platforms = ["instagram", "tiktok", "facebook"];
    const accountMap = new Map(
      (accounts || []).map((acc) => [acc.platform, acc])
    );

    const result = platforms.map((platform) => {
      const account = accountMap.get(platform);
      return {
        platform,
        status: account?.status || "disconnected",
        external_account_id: account?.external_account_id || null,
        handle: account?.handle || null,
        avatar_url: account?.avatar_url || null,
        connected_at: account?.connected_at || null,
        last_sync_at: account?.last_sync_at || null,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          accounts: result,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio social accounts endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
