/**
 * Social Media Summary API
 * 
 * GET /api/studio/social/summary
 * 
 * Aggregates posts from studio_social_posts (workspace-scoped) into a compact JSON structure
 * suitable for feeding to OpenAI for insights
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SocialSummary } from "@/lib/social/summary";

// Re-export type for convenience
export type { SocialSummary };

const SUMMARY_WINDOW_DAYS = 90;

export async function GET(request: NextRequest) {
  try {
    const { supabaseClient, user } = await getAuthenticatedSupabaseFromRequest(
      request
    );

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json({ error: "workspace_not_found" }, { status: 404 });
    }

    const supabaseAdmin = getSupabaseServerClient();

    // Calculate date threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - SUMMARY_WINDOW_DAYS);

    // Fetch posts from workspace-scoped studio_social_posts
    const { data: posts, error: postsError } = await supabaseAdmin
      .from("studio_social_posts")
      .select(`
        id,
        platform,
        external_post_id,
        caption,
        posted_at,
        metadata,
        studio_social_post_metrics (
          impressions,
          views,
          likes,
          comments,
          shares,
          saves,
          captured_at
        )
      `)
      .eq("workspace_id", workspaceId)
      .gte("posted_at", thresholdDate.toISOString())
      .order("posted_at", { ascending: false });

    if (postsError) {
      throw new Error(`Failed to fetch posts: ${postsError.message}`);
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({});
    }

    // Process posts into summary format (similar to generateSocialSummary)
    const instagramPosts = posts.filter((p) => p.platform === "instagram");
    const tiktokPosts = posts.filter((p) => p.platform === "tiktok");

    const summary: SocialSummary = {};

    // Process Instagram posts
    if (instagramPosts.length > 0) {
      const totals = {
        posts: instagramPosts.length,
        likes: 0,
        comments: 0,
        reach: 0,
        impressions: 0,
        saves: 0,
        shares: 0,
      };

      const topPosts: Array<{
        provider_media_id: string;
        caption_excerpt: string;
        metrics: Record<string, any>;
        taken_at: string;
        media_type?: string;
      }> = [];
      const byMediaType: Record<string, {
        count: number;
        likes: number[];
        comments: number[];
        reach: number[];
      }> = {};

      for (const post of instagramPosts) {
        // Get latest metrics
        const metrics = Array.isArray(post.studio_social_post_metrics) && post.studio_social_post_metrics.length > 0
          ? post.studio_social_post_metrics[0]
          : null;

        const likes = metrics?.likes || 0;
        const comments = metrics?.comments || 0;
        const reach = metrics?.impressions || 0; // Use impressions as proxy for reach
        const impressions = metrics?.impressions || 0;
        const saves = metrics?.saves || 0;
        const shares = metrics?.shares || 0;

        totals.likes += likes;
        totals.comments += comments;
        totals.reach += reach;
        totals.impressions += impressions;
        totals.saves += saves;
        totals.shares += shares;

        const mediaType = (post.metadata as any)?.media_type || "unknown";
        if (!byMediaType[mediaType]) {
          byMediaType[mediaType] = { count: 0, likes: [], comments: [], reach: [] };
        }
        byMediaType[mediaType].count++;
        byMediaType[mediaType].likes.push(likes);
        byMediaType[mediaType].comments.push(comments);
        byMediaType[mediaType].reach.push(reach);

        topPosts.push({
          provider_media_id: post.external_post_id,
          caption_excerpt: (post.caption || "").substring(0, 150),
          metrics: metrics || {},
          taken_at: post.posted_at || "",
          media_type: mediaType,
        });
      }

      // Sort and take top 10
      const sortedTopPosts = topPosts
        .sort((a, b) => {
          const aScore = (a.metrics.likes || 0) + (a.metrics.comments || 0) + (a.metrics.saves || 0) + (a.metrics.shares || 0);
          const bScore = (b.metrics.likes || 0) + (b.metrics.comments || 0) + (b.metrics.saves || 0) + (b.metrics.shares || 0);
          return bScore - aScore;
        })
        .slice(0, 10);

      // Calculate averages
      const byMediaTypeSummary: Record<string, {
        count: number;
        avg_likes: number;
        avg_comments: number;
        avg_reach: number;
      }> = {};

      for (const [type, data] of Object.entries(byMediaType)) {
        byMediaTypeSummary[type] = {
          count: data.count,
          avg_likes: data.likes.length > 0 ? Math.round(data.likes.reduce((a, b) => a + b, 0) / data.likes.length) : 0,
          avg_comments: data.comments.length > 0 ? Math.round(data.comments.reduce((a, b) => a + b, 0) / data.comments.length) : 0,
          avg_reach: data.reach.length > 0 ? Math.round(data.reach.reduce((a, b) => a + b, 0) / data.reach.length) : 0,
        };
      }

      summary.instagram = {
        totals,
        top_posts: sortedTopPosts,
        by_media_type: byMediaTypeSummary,
      };
    }

    // Process TikTok posts (similar logic)
    if (tiktokPosts.length > 0) {
      const totals = {
        posts: tiktokPosts.length,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      };

      const topPosts: Array<{
        provider_media_id: string;
        caption_excerpt: string;
        metrics: Record<string, any>;
        taken_at: string;
        media_type?: string;
      }> = [];
      const byMediaType: Record<string, {
        count: number;
        views: number[];
        likes: number[];
        comments: number[];
      }> = {};

      for (const post of tiktokPosts) {
        const metrics = Array.isArray(post.studio_social_post_metrics) && post.studio_social_post_metrics.length > 0
          ? post.studio_social_post_metrics[0]
          : null;

        const views = metrics?.views || 0;
        const likes = metrics?.likes || 0;
        const comments = metrics?.comments || 0;
        const shares = metrics?.shares || 0;

        totals.views += views;
        totals.likes += likes;
        totals.comments += comments;
        totals.shares += shares;

        const mediaType = "video";
        if (!byMediaType[mediaType]) {
          byMediaType[mediaType] = { count: 0, views: [], likes: [], comments: [] };
        }
        byMediaType[mediaType].count++;
        byMediaType[mediaType].views.push(views);
        byMediaType[mediaType].likes.push(likes);
        byMediaType[mediaType].comments.push(comments);

        topPosts.push({
          provider_media_id: post.external_post_id,
          caption_excerpt: (post.caption || "").substring(0, 150),
          metrics: metrics || {},
          taken_at: post.posted_at || "",
          media_type: mediaType,
        });
      }

      const sortedTopPosts = topPosts
        .sort((a, b) => {
          const aScore = (a.metrics.views || 0) + (a.metrics.likes || 0) + (a.metrics.comments || 0) + (a.metrics.shares || 0);
          const bScore = (b.metrics.views || 0) + (b.metrics.likes || 0) + (b.metrics.comments || 0) + (b.metrics.shares || 0);
          return bScore - aScore;
        })
        .slice(0, 10);

      const byMediaTypeSummary: Record<string, {
        count: number;
        avg_views: number;
        avg_likes: number;
        avg_comments: number;
      }> = {};

      for (const [type, data] of Object.entries(byMediaType)) {
        byMediaTypeSummary[type] = {
          count: data.count,
          avg_views: data.views.length > 0 ? Math.round(data.views.reduce((a, b) => a + b, 0) / data.views.length) : 0,
          avg_likes: data.likes.length > 0 ? Math.round(data.likes.reduce((a, b) => a + b, 0) / data.likes.length) : 0,
          avg_comments: data.comments.length > 0 ? Math.round(data.comments.reduce((a, b) => a + b, 0) / data.comments.length) : 0,
        };
      }

      summary.tiktok = {
        totals,
        top_posts: sortedTopPosts,
        by_media_type: byMediaTypeSummary,
      };
    }

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("Error in social summary endpoint:", error);
    return NextResponse.json(
      {
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

