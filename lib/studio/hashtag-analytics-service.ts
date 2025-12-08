/**
 * Studio Hashtag Analytics Service
 * 
 * Service for computing hashtag performance metrics and insights.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface HashtagMetrics {
  hashtag_id: string;
  name: string;
  usage_count: number; // Number of posts using this hashtag
  avg_impressions: number;
  avg_views: number;
  avg_likes: number;
  avg_comments: number;
  avg_shares: number;
  avg_saves: number;
  avg_engagement_rate: number; // (likes + comments + shares + saves) / impressions (or views)
  total_impressions: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_saves: number;
  first_used_at: string;
  last_used_at: string;
}

export interface HashtagInsights {
  top_by_usage: HashtagMetrics[]; // Most frequently used
  top_by_engagement: HashtagMetrics[]; // Highest engagement rate
  top_by_impressions: HashtagMetrics[]; // Highest average impressions
  total_hashtags: number;
  period_days: number;
}

const DEFAULT_PERIOD_DAYS = 30;

/**
 * Calculate engagement rate for a post
 */
function calculateEngagementRate(
  platform: string,
  metrics: {
    impressions?: number;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
  }
): number {
  const engagement = (metrics.likes || 0) + (metrics.comments || 0) + 
                    (metrics.shares || 0) + (metrics.saves || 0);
  const denominator = platform === "tiktok"
    ? (metrics.views || 0)
    : (metrics.impressions || 0);
  
  if (denominator === 0) return 0;
  return (engagement / denominator) * 100;
}

/**
 * Compute hashtag analytics for a workspace
 */
export async function computeHashtagInsights(
  workspaceId: string,
  periodDays: number = DEFAULT_PERIOD_DAYS,
  supabaseClient?: SupabaseClient
): Promise<HashtagInsights> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Calculate date threshold
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - periodDays);

  // Fetch hashtags with their usage and post metrics
  const { data: hashtagLinks, error } = await supabase
    .from("studio_post_hashtags")
    .select(`
      hashtag_id,
      post_id,
      created_at,
      studio_hashtags (
        id,
        name,
        first_used_at,
        last_used_at
      ),
      studio_social_posts (
        id,
        platform,
        posted_at,
        studio_social_post_metrics (
          impressions,
          views,
          likes,
          comments,
          shares,
          saves,
          captured_at
        )
      )
    `)
    .eq("studio_social_posts.workspace_id", workspaceId)
    .gte("studio_social_posts.posted_at", thresholdDate.toISOString())
    .not("studio_social_posts.posted_at", "is", null);

  if (error || !hashtagLinks) {
    console.error("Error fetching hashtag data:", error);
    return {
      top_by_usage: [],
      top_by_engagement: [],
      top_by_impressions: [],
      total_hashtags: 0,
      period_days: periodDays,
    };
  }

  // Aggregate metrics per hashtag
  const hashtagMap = new Map<string, {
    hashtag: any;
    posts: Array<{
      platform: string;
      metrics: any;
    }>;
  }>();

  for (const link of hashtagLinks) {
    const hashtag = (link as any).studio_hashtags;
    const post = (link as any).studio_social_posts;

    if (!hashtag || !post) continue;

    const hashtagId = hashtag.id;

    if (!hashtagMap.has(hashtagId)) {
      hashtagMap.set(hashtagId, {
        hashtag,
        posts: [],
      });
    }

    // Get latest metrics for this post
    const metricsArray = post.studio_social_post_metrics as any[];
    const latestMetrics = metricsArray && metricsArray.length > 0
      ? metricsArray.sort((a: any, b: any) => 
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        )[0]
      : null;

    if (latestMetrics) {
      hashtagMap.get(hashtagId)!.posts.push({
        platform: post.platform,
        metrics: latestMetrics,
      });
    }
  }

  // Calculate metrics for each hashtag
  const hashtagMetrics: HashtagMetrics[] = [];

  for (const [hashtagId, data] of hashtagMap.entries()) {
    const { hashtag, posts } = data;

    if (posts.length === 0) continue;

    // Aggregate metrics
    let totalImpressions = 0;
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalSaves = 0;
    let totalEngagementRate = 0;

    for (const post of posts) {
      const impressions = post.metrics.impressions || 0;
      const views = post.metrics.views || 0;
      const likes = post.metrics.likes || 0;
      const comments = post.metrics.comments || 0;
      const shares = post.metrics.shares || 0;
      const saves = post.metrics.saves || 0;

      totalImpressions += impressions;
      totalViews += views;
      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;
      totalSaves += saves;

      const engagementRate = calculateEngagementRate(post.platform, post.metrics);
      totalEngagementRate += engagementRate;
    }

    const usageCount = posts.length;
    const avgImpressions = totalImpressions / usageCount;
    const avgViews = totalViews / usageCount;
    const avgLikes = totalLikes / usageCount;
    const avgComments = totalComments / usageCount;
    const avgShares = totalShares / usageCount;
    const avgSaves = totalSaves / usageCount;
    const avgEngagementRate = totalEngagementRate / usageCount;

    hashtagMetrics.push({
      hashtag_id: hashtagId,
      name: hashtag.name,
      usage_count: usageCount,
      avg_impressions: Math.round(avgImpressions),
      avg_views: Math.round(avgViews),
      avg_likes: Math.round(avgLikes),
      avg_comments: Math.round(avgComments),
      avg_shares: Math.round(avgShares),
      avg_saves: Math.round(avgSaves),
      avg_engagement_rate: Math.round(avgEngagementRate * 10) / 10,
      total_impressions: totalImpressions,
      total_views: totalViews,
      total_likes: totalLikes,
      total_comments: totalComments,
      total_shares: totalShares,
      total_saves: totalSaves,
      first_used_at: hashtag.first_used_at,
      last_used_at: hashtag.last_used_at,
    });
  }

  // Sort and get top performers
  const topByUsage = [...hashtagMetrics]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 20);

  const topByEngagement = [...hashtagMetrics]
    .filter((h) => h.usage_count >= 2) // At least 2 uses for statistical significance
    .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)
    .slice(0, 20);

  const topByImpressions = [...hashtagMetrics]
    .sort((a, b) => b.avg_impressions - a.avg_impressions)
    .slice(0, 20);

  return {
    top_by_usage: topByUsage,
    top_by_engagement: topByEngagement,
    top_by_impressions: topByImpressions,
    total_hashtags: hashtagMetrics.length,
    period_days: periodDays,
  };
}

/**
 * Get top-performing hashtags for AI suggestions
 * Returns a simplified list suitable for LLM prompts
 */
export async function getTopHashtagsForSuggestions(
  workspaceId: string,
  limit: number = 15,
  periodDays: number = 30,
  supabaseClient?: SupabaseClient
): Promise<Array<{ name: string; engagement_rate: number; usage_count: number }>> {
  const insights = await computeHashtagInsights(workspaceId, periodDays, supabaseClient);

  // Combine top by engagement and usage, deduplicate, and sort
  const combined = new Map<string, { name: string; engagement_rate: number; usage_count: number }>();

  for (const hashtag of insights.top_by_engagement) {
    combined.set(hashtag.name, {
      name: hashtag.name,
      engagement_rate: hashtag.avg_engagement_rate,
      usage_count: hashtag.usage_count,
    });
  }

  for (const hashtag of insights.top_by_usage) {
    if (!combined.has(hashtag.name)) {
      combined.set(hashtag.name, {
        name: hashtag.name,
        engagement_rate: hashtag.avg_engagement_rate,
        usage_count: hashtag.usage_count,
      });
    }
  }

  // Sort by engagement rate (prioritize high-performing), then by usage
  return Array.from(combined.values())
    .sort((a, b) => {
      if (Math.abs(a.engagement_rate - b.engagement_rate) < 0.5) {
        // If engagement rates are very close, prefer higher usage
        return b.usage_count - a.usage_count;
      }
      return b.engagement_rate - a.engagement_rate;
    })
    .slice(0, limit);
}

