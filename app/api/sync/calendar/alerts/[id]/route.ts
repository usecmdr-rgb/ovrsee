/**
 * DELETE /api/sync/calendar/alerts/:id
 * 
 * Delete a calendar alert
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const alertId = params.id;

    if (!alertId) {
      return NextResponse.json(
        { error: "Alert ID is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Delete alert (scoped to workspace)
    const { error } = await supabaseClient
      .from("sync_calendar_alerts")
      .delete()
      .eq("id", alertId)
      .eq("workspace_id", workspaceId);

    if (error) {
      // If table doesn't exist, return error
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Calendar alerts table does not exist",
            code: "TABLE_NOT_FOUND"
          },
          { status: 500, headers: responseHeaders }
        );
      }

      console.error("[Sync Calendar Alerts DELETE] Error:", error);
      return NextResponse.json(
        { error: "Failed to delete alert" },
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Alert deleted successfully",
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Sync Calendar Alerts DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete alert" },
      { status: 500 }
    );
  }
}
