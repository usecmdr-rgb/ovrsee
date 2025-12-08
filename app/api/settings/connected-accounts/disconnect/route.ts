import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * POST /api/settings/connected-accounts/disconnect
 * 
 * Disconnects a connected account by:
 * 1. Revoking OAuth tokens with the provider (if applicable)
 * 2. Marking the account as disconnected in user_connected_accounts
 * 3. Optionally deactivating the integration in the integrations table
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const { accountId, provider } = await request.json();

    if (!accountId || !provider) {
      return NextResponse.json(
        { error: "accountId and provider are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Get the connected account
    const { data: account, error: accountError } = await supabase
      .from("user_connected_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "Connected account not found" },
        { status: 404 }
      );
    }

    // Revoke tokens for Google providers
    if (provider === "gmail" || provider === "google_calendar") {
      try {
        // Get workspace to find the integration
        const { data: workspace } = await supabase
          .from("workspaces")
          .select("id")
          .eq("owner_user_id", user.id)
          .single();

        if (workspace) {
          // Get the integration to revoke tokens
          const { data: integration } = await supabase
            .from("integrations")
            .select("access_token, refresh_token")
            .eq("workspace_id", workspace.id)
            .eq("provider", provider)
            .eq("is_active", true)
            .single();

          if (integration?.access_token) {
            try {
              // Revoke the token with Google
              // Note: We can revoke using just the access token via HTTP request
              // No need for OAuth2 client with credentials
              const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(integration.access_token)}`;
              const revokeResponse = await fetch(revokeUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
              });

              if (!revokeResponse.ok) {
                console.warn("Token revocation may have failed, but continuing with disconnection");
              }
            } catch (revokeError) {
              console.error("Error revoking Google token:", revokeError);
              // Continue with disconnection even if revocation fails
            }

            // Deactivate the integration
            await supabase
              .from("integrations")
              .update({ is_active: false, sync_status: "disconnected" })
              .eq("workspace_id", workspace.id)
              .eq("provider", provider);
          }
        }
      } catch (error) {
        console.error("Error revoking tokens:", error);
        // Continue with disconnection even if revocation fails
      }
    }

    // Mark account as disconnected
    const { error: updateError } = await supabase
      .from("user_connected_accounts")
      .update({ status: "disconnected" })
      .eq("id", accountId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating account status:", updateError);
      return NextResponse.json(
        { error: "Failed to disconnect account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account disconnected successfully",
    });
  } catch (error: any) {
    console.error("Error disconnecting account:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

