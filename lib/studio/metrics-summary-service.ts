/**
 * Studio Metrics Summary Service
 * 
 * Computes performance summaries from posts and metrics for LLM input.
 * Provides insights like top posts, engagement rates, best posting times.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialPlatform } from "./social-account-service";
import { logInfo, logError } from "./logging";

export interface PostMetrics {
  post_id: string;
  platform: SocialPlatform;
  caption: string | null;
  posted_at: string | null;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement_rate: number; // (likes + comments + shares + saves) / impressions (or views for TikTok)
}

export interface PlatformSummary {
  platform: SocialPlatform;
  total_posts: number;
  avg_engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  avg_impressions: number;
  avg_views: number;
  posting_frequency: number; // posts per week
  top_posts: PostMetrics[];
  best_day_of_week?: {
    day: string; // "Monday", "Tuesday", etc.
    avg_engagement: number;
  };
  best_time_window?: {
    hour_range: string; // "9-12", "12-15", etc.
    avg_engagement: number;
  };
}

export interface MetricsSummary {
  period_days: number;
  platforms: PlatformSummary[];
  overall_avg_engagement: number;
  total_posts: number;
}

const DEFAULT_WINDOW_DAYS = 60; // Last 60 days for weekly planning

/**
 * Calculate engagement rate for a post
 */
function calculateEngagementRate(
  platform: SocialPlatform,
  metrics: {
    impressions?: number;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
  }
): number {
  const engagement = (metrics.likes || 0) + (metrics.comments || 0) + (metrics.shares || 0) + (metrics.saves || 0);
  const denominator = platform === "tiktok" 
    ? (metrics.views || 0)
    : (metrics.impressions || 0);
  
  if (denominator === 0) return 0;
  return (engagement / denominator) * 100;
}

/**
 * Get day of week from ISO date string
 */
function getDayOfWeek(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}

/**
 * Get hour range from ISO date string (e.g., "9-12", "12-15")
 */
function getHourRange(dateStr: string): string {
  const date = new Date(dateStr);
  const hour = date.getHours();
  
  if (hour < 9) return "0-9";
  if (hour < 12) return "9-12";
  if (hour < 15) return "12-15";
  if (hour < 18) return "15-18";
  if (hour < 21) return "18-21";
  return "21-24";
}

/**
 * Compute metrics summary for a workspace
 */
export async function computeMetricsSummary(
  workspaceId: string,
  windowDays: number = DEFAULT_WINDOW_DAYS,
  supabaseClient?: SupabaseClient
): Promise<MetricsSummary> {
  const supabase = supabaseClient || getSupabaseServerClient();
  const startTime = Date.now();

  try {
    // Calculate date threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - windowDays);

  // Fetch posts with latest metrics
  const { data: posts, error } = await supabase
    .from("studio_social_posts")
    .select(`
      id,
      platform,
      caption,
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
    `)
    .eq("workspace_id", workspaceId)
    .gte("posted_at", thresholdDate.toISOString())
    .not("posted_at", "is", null)
    .order("posted_at", { ascending: false });

  if (error || !posts) {
    await logError("metrics_summary_fetch_error", {
      workspace_id: workspaceId,
      period_days: windowDays,
      error: error?.message,
    });
    return {
      period_days: windowDays,
      platforms: [],
      overall_avg_engagement: 0,
      total_posts: 0,
    };
  }

  // Process posts into PostMetrics
  const postMetrics: PostMetrics[] = [];

  for (const post of posts) {
    // Get latest metrics
    const metricsArray = post.studio_social_post_metrics as any[];
    const latestMetrics = metricsArray && metricsArray.length > 0
      ? metricsArray.sort((a, b) => 
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        )[0]
      : null;

    if (!latestMetrics) continue;

    const engagementRate = calculateEngagementRate(
      post.platform as SocialPlatform,
      latestMetrics
    );

    postMetrics.push({
      post_id: post.id,
      platform: post.platform as SocialPlatform,
      caption: post.caption,
      posted_at: post.posted_at,
      impressions: latestMetrics.impressions || 0,
      views: latestMetrics.views || 0,
      likes: latestMetrics.likes || 0,
      comments: latestMetrics.comments || 0,
      shares: latestMetrics.shares || 0,
      saves: latestMetrics.saves || 0,
      engagement_rate: engagementRate,
    });
  }

  // Group by platform
  const platforms: SocialPlatform[] = ["instagram", "tiktok", "facebook"];
  const platformSummaries: PlatformSummary[] = [];

  for (const platform of platforms) {
    const platformPosts = postMetrics.filter((p) => p.platform === platform);
    
    if (platformPosts.length === 0) continue;

    // Calculate averages
    const totalEngagement = platformPosts.reduce((sum, p) => sum + p.engagement_rate, 0);
    const avgEngagement = totalEngagement / platformPosts.length;
    const avgLikes = platformPosts.reduce((sum, p) => sum + p.likes, 0) / platformPosts.length;
    const avgComments = platformPosts.reduce((sum, p) => sum + p.comments, 0) / platformPosts.length;
    const avgImpressions = platformPosts.reduce((sum, p) => sum + p.impressions, 0) / platformPosts.length;
    const avgViews = platformPosts.reduce((sum, p) => sum + p.views, 0) / platformPosts.length;

    // Calculate posting frequency (posts per week)
    const daysDiff = windowDays;
    const postingFrequency = (platformPosts.length / daysDiff) * 7;

    // Get top posts by engagement
    const topPosts = [...platformPosts]
      .sort((a, b) => b.engagement_rate - a.engagement_rate)
      .slice(0, 10);

    // Analyze best day of week
    const dayOfWeekEngagement: Record<string, number[]> = {};
    platformPosts.forEach((p) => {
      if (!p.posted_at) return;
      const day = getDayOfWeek(p.posted_at);
      if (!dayOfWeekEngagement[day]) {
        dayOfWeekEngagement[day] = [];
      }
      dayOfWeekEngagement[day].push(p.engagement_rate);
    });

    let bestDay: { day: string; avg_engagement: number } | undefined;
    for (const [day, rates] of Object.entries(dayOfWeekEngagement)) {
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      if (!bestDay || avg > bestDay.avg_engagement) {
        bestDay = { day, avg_engagement: avg };
      }
    }

    // Analyze best time window
    const timeWindowEngagement: Record<string, number[]> = {};
    platformPosts.forEach((p) => {
      if (!p.posted_at) return;
      const window = getHourRange(p.posted_at);
      if (!timeWindowEngagement[window]) {
        timeWindowEngagement[window] = [];
      }
      timeWindowEngagement[window].push(p.engagement_rate);
    });

    let bestTime: { hour_range: string; avg_engagement: number } | undefined;
    for (const [window, rates] of Object.entries(timeWindowEngagement)) {
      const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
      if (!bestTime || avg > bestTime.avg_engagement) {
        bestTime = { hour_range: window, avg_engagement: avg };
      }
    }

    platformSummaries.push({
      platform,
      total_posts: platformPosts.length,
      avg_engagement_rate: avgEngagement,
      avg_likes: Math.round(avgLikes),
      avg_comments: Math.round(avgComments),
      avg_impressions: Math.round(avgImpressions),
      avg_views: Math.round(avgViews),
      posting_frequency: Math.round(postingFrequency * 10) / 10, // Round to 1 decimal
      top_posts: topPosts,
      best_day_of_week: bestDay,
      best_time_window: bestTime,
    });
  }

  // Calculate overall average engagement
  const overallAvgEngagement = postMetrics.length > 0
    ? postMetrics.reduce((sum, p) => sum + p.engagement_rate, 0) / postMetrics.length
    : 0;

    const durationMs = Date.now() - startTime;
    await logInfo("metrics_summary_complete", {
      workspace_id: workspaceId,
      period_days: windowDays,
      total_posts: postMetrics.length,
      platforms_count: platformSummaries.length,
      duration_ms: durationMs,
    });

    return {
      period_days: windowDays,
      platforms: platformSummaries,
      overall_avg_engagement: Math.round(overallAvgEngagement * 10) / 10,
      total_posts: postMetrics.length,
    };
  } catch (error: any) {
    await logError("metrics_summary_exception", {
      workspace_id: workspaceId,
      period_days: windowDays,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

