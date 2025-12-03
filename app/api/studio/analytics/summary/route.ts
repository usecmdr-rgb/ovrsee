/**
 * Studio Analytics Summary API
 * 
 * GET /api/studio/analytics/summary
 * 
 * Returns performance overview metrics
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

    // Get total edits count
    const { count: totalEdits, error: editsError } = await supabaseClient
      .from("studio_edit_events")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    if (editsError) {
      console.error("Error counting edit events:", editsError);
    }

    // Get total posts count
    const { count: totalPosts, error: postsError } = await supabaseClient
      .from("studio_social_posts")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    if (postsError) {
      console.error("Error counting social posts:", postsError);
    }

    // Get latest metrics for each post and sum them
    const { data: posts, error: postsDataError } = await supabaseClient
      .from("studio_social_posts")
      .select("id")
      .eq("workspace_id", workspaceId);

    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;

    if (!postsDataError && posts && posts.length > 0) {
      const postIds = posts.map((p) => p.id);

      // Get latest metric for each post
      for (const postId of postIds) {
        const { data: postMetrics } = await supabaseClient
          .from("studio_social_post_metrics")
          .select("views, likes, comments")
          .eq("social_post_id", postId)
          .order("captured_at", { ascending: false })
          .limit(1)
          .single();

        if (postMetrics) {
          totalViews += postMetrics.views || 0;
          totalLikes += postMetrics.likes || 0;
          totalComments += postMetrics.comments || 0;
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          totalEdits: totalEdits || 0,
          totalPosts: totalPosts || 0,
          totalViews,
          totalLikes,
          totalComments,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio analytics summary endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
