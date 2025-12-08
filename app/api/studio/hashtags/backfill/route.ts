/**
 * Studio Hashtags Backfill API
 * 
 * POST /api/studio/hashtags/backfill
 * 
 * Backfills hashtags from existing post captions
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { backfillHashtagsFromPosts } from "@/lib/studio/hashtag-service";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const limit = parseInt(body.limit || "1000", 10);

    const result = await backfillHashtagsFromPosts(workspaceId, limit, supabaseClient);

    return NextResponse.json(
      {
        ok: true,
        data: result,
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in hashtag backfill endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

