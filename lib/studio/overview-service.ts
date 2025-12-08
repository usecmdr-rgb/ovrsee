/**
 * Studio Overview Service
 * 
 * Service for aggregating overview data for the Studio dashboard.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeMetricsSummary } from "./metrics-summary-service";
import { getWorkspaceReports } from "./report-service";
import { getTopHashtagsForSuggestions } from "./hashtag-analytics-service";
import { getWorkspaceExperiments } from "./experiment-service";

export interface StudioOverview {
  schedule: {
    next_7_days: Array<{
      id: string;
      platform: string;
      caption: string | null;
      status: string;
      scheduled_for: string | null;
      published_at: string | null;
      predicted_score_label?: string | null;
      experiment_variant_label?: string | null;
    }>;
  };
  metrics_snapshot: {
    total_posts: number;
    total_impressions: number;
    avg_engagement_rate: number;
    period_days: number;
  };
  latest_report: {
    id: string;
    period_start: string;
    period_end: string;
    summary_preview: string; // First 500 chars
  } | null;
  top_hashtags: Array<{
    name: string;
    engagement_rate: number;
  }>;
  recent_experiments: Array<{
    id: string;
    name: string;
    status: string;
    winner_variant_label: string | null;
  }>;
}

/**
 * Get overview data for a workspace
 */
export async function getOverview(
  workspaceId: string,
  supabaseClient?: SupabaseClient
): Promise<StudioOverview> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const now = new Date();
  const next7Days = new Date();
  next7Days.setDate(now.getDate() + 7);

  // 1. Get next 7 days' posts
  const { data: schedulePosts, error: scheduleError } = await supabase
    .from("studio_social_posts")
    .select(`
      id,
      platform,
      caption,
      status,
      scheduled_for,
      published_at,
      predicted_score_label,
      experiment_variant_label
    `)
    .eq("workspace_id", workspaceId)
    .or(`scheduled_for.gte.${now.toISOString()},scheduled_for.lte.${next7Days.toISOString()},and(status.eq.draft,created_at.gte.${now.toISOString()})`)
    .order("scheduled_for", { ascending: true, nullsFirst: true })
    .limit(20);

  // 2. Get metrics snapshot (last 7 days)
  let metricsSummary;
  try {
    metricsSummary = await computeMetricsSummary(workspaceId, 7, supabase);
  } catch (error) {
    console.error("Error computing metrics summary:", error);
    // Fallback to empty metrics
    metricsSummary = {
      total_posts: 0,
      platforms: [],
      overall_avg_engagement: 0,
      period_days: 7,
    };
  }

  // 3. Get latest report
  let latestReport = null;
  try {
    const reports = await getWorkspaceReports(workspaceId, 1, supabase);
    if (reports && reports.length > 0) {
      latestReport = {
        id: reports[0].id,
        period_start: reports[0].period_start,
        period_end: reports[0].period_end,
        summary_preview: reports[0].summary_markdown.substring(0, 500),
      };
    }
  } catch (error) {
    console.error("Error fetching reports:", error);
    // Continue with null if reports table doesn't exist yet
  }

  // 4. Get top hashtags (gracefully handle if table doesn't exist yet)
  let topHashtags: Array<{ name: string; engagement_rate: number }> = [];
  try {
    const topPerformingHashtags = await getTopHashtagsForSuggestions(workspaceId, 5, 30, supabase);
    if (topPerformingHashtags && Array.isArray(topPerformingHashtags)) {
      topHashtags = topPerformingHashtags.map((h) => ({
        name: h.name,
        engagement_rate: h.engagement_rate,
      }));
    }
  } catch (error) {
    console.error("Error fetching hashtag data:", error);
    // Continue with empty array if hashtags table doesn't exist yet
  }

  // 5. Get recent experiments (gracefully handle if table doesn't exist yet)
  let recentExperiments: Array<{
    id: string;
    name: string;
    status: string;
    winner_variant_label: string | null;
  }> = [];
  try {
    const experiments = await getWorkspaceExperiments(workspaceId, {
      limit: 3,
      supabaseClient: supabase,
    });
    if (experiments && Array.isArray(experiments)) {
      recentExperiments = experiments.map((exp) => ({
        id: exp.id,
        name: exp.name,
        status: exp.status,
        winner_variant_label: exp.winner_variant_label || null,
      }));
    }
  } catch (error) {
    console.error("Error fetching experiments:", error);
    // Continue with empty array if experiments table doesn't exist yet
  }

  return {
    schedule: {
      next_7_days: (schedulePosts || []).slice(0, 10),
    },
    metrics_snapshot: {
      total_posts: metricsSummary.total_posts || 0,
      total_impressions: metricsSummary.platforms
        ? metricsSummary.platforms.reduce(
            (sum, p) => sum + (p.avg_impressions || 0) * (p.total_posts || 0),
            0
          )
        : 0,
      avg_engagement_rate: metricsSummary.overall_avg_engagement || 0,
      period_days: 7,
    },
    latest_report: latestReport,
    top_hashtags: topHashtags,
    recent_experiments: recentExperiments,
  };
}

