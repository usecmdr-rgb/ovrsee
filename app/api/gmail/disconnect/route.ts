import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getOrCreateWorkspace } from "@/lib/sync/integrations";

/**
 * DELETE /api/gmail/disconnect
 * Disconnect Gmail account
 * Handles both integrations table (primary) and gmail_connections table (legacy)
 */
export async function DELETE(request: NextRequest) {
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

    // Get workspace for user
    let workspace;
    try {
      workspace = await getOrCreateWorkspace(userId);
    } catch (error: any) {
      console.error("[Gmail Disconnect] Error getting workspace:", error);
      // Continue with legacy table cleanup even if workspace fails
    }

    // Disconnect from integrations table (primary method)
    if (workspace) {
      const { error: integrationError } = await supabase
        .from("integrations")
        .update({ 
          is_active: false,
          sync_status: "disconnected"
        })
        .eq("workspace_id", workspace.id)
        .eq("provider", "gmail")
        .eq("integration_type", "oauth");

      if (integrationError) {
        console.error("[Gmail Disconnect] Error updating integrations:", integrationError);
        // Continue with legacy cleanup
      }
    }

    // Delete from gmail_connections table (legacy method)
    const { error: deleteError } = await supabase
      .from("gmail_connections")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      // Log but don't fail if legacy table doesn't exist or has no records
      console.error("[Gmail Disconnect] Error deleting from gmail_connections:", deleteError);
    }

    // Optionally: Soft delete all email queue items (or keep them for reference)
    // For now, we'll keep them but mark as disconnected
    // User can manually delete if needed

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Error disconnecting Gmail:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Gmail" },
      { status: 500 }
    );
  }
}




