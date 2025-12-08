/**
 * Studio Post Scoring API
 * 
 * POST /api/studio/posts/[postId]/score
 * 
 * Manually trigger scoring (and optionally explanation) for a draft post
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { scoreDraftPost } from "@/lib/studio/scoring-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
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

    const postId = params.postId;
    const body = await request.json();
    const { generateExplanation = false } = body;

    // Verify post belongs to workspace
    const { data: post, error: postError } = await supabaseClient
      .from("studio_social_posts")
      .select("id, workspace_id")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { ok: false, error: "Post not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Score the post
    const result = await scoreDraftPost(workspaceId, postId, {
      generateExplanation,
      supabaseClient,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          score: result.score,
          explanation: result.explanation,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in post scoring endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

