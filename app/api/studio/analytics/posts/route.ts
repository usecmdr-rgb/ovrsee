/**
 * Studio Analytics Posts API
 * 
 * GET /api/studio/analytics/posts?limit=&platform=
 * 
 * Returns posts with their latest metrics for the Posts & Interactions table
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

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const platform = searchParams.get("platform");

    // Build query
    let query = supabaseClient
      .from("studio_social_posts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (platform && ["instagram", "tiktok", "facebook"].includes(platform)) {
      query = query.eq("platform", platform);
    }

    const { data: posts, error: postsError } = await query;

    if (postsError) {
      console.error("Error fetching social posts:", postsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch posts", details: postsError.message },
        { status: 500, headers: responseHeaders }
      );
    }

    // For each post, get the latest metrics
    const postsWithMetrics = await Promise.all(
      (posts || []).map(async (post) => {
        const { data: latestMetric } = await supabaseClient
          .from("studio_social_post_metrics")
          .select("*")
          .eq("social_post_id", post.id)
          .order("captured_at", { ascending: false })
          .limit(1)
          .single();

        return {
          ...post,
          metrics: latestMetric || {
            impressions: 0,
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
          },
        };
      })
    );

    return NextResponse.json(
      {
        ok: true,
        data: {
          posts: postsWithMetrics,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio analytics posts endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
