import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * POST /api/settings/connected-accounts/sync
 * 
 * Syncs connected accounts from the integrations table to user_connected_accounts table.
 * This allows the settings page to show all connected accounts in one place.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();

    // Get user's workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get all active integrations for this workspace
    const { data: integrations, error: integrationsError } = await supabase
      .from("integrations")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .in("provider", ["gmail", "google_calendar"]);

    if (integrationsError) {
      console.error("Error fetching integrations:", integrationsError);
      return NextResponse.json(
        { error: "Failed to fetch integrations" },
        { status: 500 }
      );
    }

    // Sync each integration to user_connected_accounts
    const syncedAccounts = [];
    for (const integration of integrations || []) {
      const status = integration.sync_status === "connected" ? "connected" : 
                     integration.sync_status === "error" ? "error" : "disconnected";

      const { data: account, error: upsertError } = await supabase
        .from("user_connected_accounts")
        .upsert({
          user_id: user.id,
          provider: integration.provider,
          status: status,
          scopes: integration.scopes || [],
          external_account_id: integration.metadata?.email || integration.metadata?.account_id || null,
          metadata: integration.metadata || {},
        }, {
          onConflict: "user_id,provider",
        })
        .select()
        .single();

      if (upsertError) {
        console.error(`Error syncing ${integration.provider}:`, upsertError);
        continue;
      }

      syncedAccounts.push(account);
    }

    return NextResponse.json({
      success: true,
      accounts: syncedAccounts,
    });
  } catch (error: any) {
    console.error("Error syncing connected accounts:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

