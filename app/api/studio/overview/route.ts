/**
 * Studio Overview API
 * 
 * GET /api/studio/overview
 * 
 * Returns aggregated overview data for the Studio dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getOverview } from "@/lib/studio/overview-service";

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

    const overview = await getOverview(workspaceId, supabaseClient);

    return NextResponse.json(
      {
        ok: true,
        data: overview,
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio overview endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}
