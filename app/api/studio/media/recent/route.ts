/**
 * Studio Recent Media API
 * 
 * GET /api/studio/media/recent?limit=10
 * 
 * Returns recent media assets
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

    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Fetch recent media assets
    const { data: assets, error: assetsError } = await supabaseClient
      .from("studio_assets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("asset_type", "media")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (assetsError) {
      console.error("Error fetching recent media:", assetsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch media", details: assetsError.message },
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          assets: assets || [],
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio recent media endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
