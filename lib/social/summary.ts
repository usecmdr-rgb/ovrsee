/**
 * Social Media Summary Generator
 * 
 * DEPRECATED: This function uses user-scoped social_media_posts.
 * New code should use workspace-scoped studio_social_posts via /api/studio/social/summary.
 * 
 * This file is kept for backwards compatibility but should not be used for new features.
 * 
 * @deprecated Use workspace-scoped endpoints instead
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

const SUMMARY_WINDOW_DAYS = 90;

export interface SocialSummary {
  instagram?: {
    totals: {
      posts: number;
      likes: number;
      comments: number;
      reach: number;
      impressions: number;
      saves: number;
      shares: number;
    };
    top_posts: Array<{
      provider_media_id: string;
      caption_excerpt: string;
      metrics: Record<string, any>;
      taken_at: string;
      media_type?: string;
    }>;
    by_media_type: Record<string, {
      count: number;
      avg_likes: number;
      avg_comments: number;
      avg_reach: number;
    }>;
  };
  tiktok?: {
    totals: {
      posts: number;
      views: number;
      likes: number;
      comments: number;
      shares: number;
    };
    top_posts: Array<{
      provider_media_id: string;
      caption_excerpt: string;
      metrics: Record<string, any>;
      taken_at: string;
      media_type?: string;
    }>;
    by_media_type: Record<string, {
      count: number;
      avg_views: number;
      avg_likes: number;
      avg_comments: number;
    }>;
  };
}

/**
 * Generate social media summary for a user
 */
export async function generateSocialSummary(
  userId: string
): Promise<SocialSummary> {
  const supabaseAdmin = getSupabaseServerClient();

  // Calculate date threshold
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - SUMMARY_WINDOW_DAYS);

  // Fetch all posts within the window
  const { data: posts, error: postsError } = await supabaseAdmin
    .from("social_media_posts")
    .select("*")
    .eq("user_id", userId)
    .gte("taken_at", thresholdDate.toISOString())
    .order("taken_at", { ascending: false });

  if (postsError) {
    throw new Error(`Failed to fetch posts: ${postsError.message}`);
  }

  if (!posts || posts.length === 0) {
    return {};
  }

  // Separate by provider
  const instagramPosts = posts.filter((p) => p.provider === "instagram");
  const tiktokPosts = posts.filter((p) => p.provider === "tiktok");

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

    const byMediaType: Record<string, {
      count: number;
      likes: number[];
      comments: number[];
      reach: number[];
    }> = {};

    const postsWithMetrics = instagramPosts.map((post) => {
      const metrics = (post.metrics as Record<string, any>) || {};
      const likes = metrics.likes || 0;
      const comments = metrics.comments || 0;
      const reach = metrics.reach || 0;
      const impressions = metrics.impressions || 0;
      const saves = metrics.saves || 0;
      const shares = metrics.shares || 0;

      totals.likes += likes;
      totals.comments += comments;
      totals.reach += reach;
      totals.impressions += impressions;
      totals.saves += saves;
      totals.shares += shares;

      const mediaType = post.media_type || "unknown";
      if (!byMediaType[mediaType]) {
        byMediaType[mediaType] = {
          count: 0,
          likes: [],
          comments: [],
          reach: [],
        };
      }
      byMediaType[mediaType].count++;
      byMediaType[mediaType].likes.push(likes);
      byMediaType[mediaType].comments.push(comments);
      byMediaType[mediaType].reach.push(reach);

      return {
        provider_media_id: post.provider_media_id,
        caption_excerpt: (post.caption || "").substring(0, 150),
        metrics,
        taken_at: post.taken_at || "",
        media_type: post.media_type || undefined,
        engagement_score: likes + comments + saves + shares,
      };
    });

    // Sort by engagement and take top 10
    const topPosts = postsWithMetrics
      .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
      .slice(0, 10)
      .map(({ engagement_score, ...rest }) => rest);

    // Calculate averages by media type
    const byMediaTypeSummary: Record<string, {
      count: number;
      avg_likes: number;
      avg_comments: number;
      avg_reach: number;
    }> = {};

    for (const [type, data] of Object.entries(byMediaType)) {
      byMediaTypeSummary[type] = {
        count: data.count,
        avg_likes:
          data.likes.length > 0
            ? Math.round(
                data.likes.reduce((a, b) => a + b, 0) / data.likes.length
              )
            : 0,
        avg_comments:
          data.comments.length > 0
            ? Math.round(
                data.comments.reduce((a, b) => a + b, 0) /
                  data.comments.length
              )
            : 0,
        avg_reach:
          data.reach.length > 0
            ? Math.round(
                data.reach.reduce((a, b) => a + b, 0) / data.reach.length
              )
            : 0,
      };
    }

    summary.instagram = {
      totals,
      top_posts: topPosts,
      by_media_type: byMediaTypeSummary,
    };
  }

  // Process TikTok posts
  if (tiktokPosts.length > 0) {
    const totals = {
      posts: tiktokPosts.length,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    };

    const byMediaType: Record<string, {
      count: number;
      views: number[];
      likes: number[];
      comments: number[];
    }> = {};

    const postsWithMetrics = tiktokPosts.map((post) => {
      const metrics = (post.metrics as Record<string, any>) || {};
      const views = metrics.views || metrics.play_count || 0;
      const likes = metrics.likes || metrics.like_count || 0;
      const comments = metrics.comments || metrics.comment_count || 0;
      const shares = metrics.shares || metrics.share_count || 0;

      totals.views += views;
      totals.likes += likes;
      totals.comments += comments;
      totals.shares += shares;

      const mediaType = post.media_type || "video";
      if (!byMediaType[mediaType]) {
        byMediaType[mediaType] = {
          count: 0,
          views: [],
          likes: [],
          comments: [],
        };
      }
      byMediaType[mediaType].count++;
      byMediaType[mediaType].views.push(views);
      byMediaType[mediaType].likes.push(likes);
      byMediaType[mediaType].comments.push(comments);

      return {
        provider_media_id: post.provider_media_id,
        caption_excerpt: (post.caption || "").substring(0, 150),
        metrics,
        taken_at: post.taken_at || "",
        media_type: post.media_type || undefined,
        engagement_score: views + likes + comments + shares,
      };
    });

    // Sort by engagement and take top 10
    const topPosts = postsWithMetrics
      .sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))
      .slice(0, 10)
      .map(({ engagement_score, ...rest }) => rest);

    // Calculate averages by media type
    const byMediaTypeSummary: Record<string, {
      count: number;
      avg_views: number;
      avg_likes: number;
      avg_comments: number;
    }> = {};

    for (const [type, data] of Object.entries(byMediaType)) {
      byMediaTypeSummary[type] = {
        count: data.count,
        avg_views:
          data.views.length > 0
            ? Math.round(
                data.views.reduce((a, b) => a + b, 0) / data.views.length
              )
            : 0,
        avg_likes:
          data.likes.length > 0
            ? Math.round(
                data.likes.reduce((a, b) => a + b, 0) / data.likes.length
              )
            : 0,
        avg_comments:
          data.comments.length > 0
            ? Math.round(
                data.comments.reduce((a, b) => a + b, 0) /
                  data.comments.length
              )
            : 0,
      };
    }

    summary.tiktok = {
      totals,
      top_posts: topPosts,
      by_media_type: byMediaTypeSummary,
    };
  }

  return summary;
}


