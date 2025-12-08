/**
 * Studio Competitor Service
 * 
 * Service for managing competitor accounts and fetching their metrics.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logInfo, logWarn, logError } from "./logging";

export type CompetitorPlatform = "instagram" | "tiktok" | "facebook";

export interface Competitor {
  id: string;
  workspace_id: string;
  platform: CompetitorPlatform;
  handle: string;
  label: string | null;
  created_at: string;
  created_by: string | null;
}

export interface CompetitorMetrics {
  id: string;
  competitor_id: string;
  captured_at: string;
  followers: number | null;
  posts_count: number | null;
  avg_engagement_estimate: number | null;
  metadata: Record<string, any>;
}

export interface CompetitorWithMetrics extends Competitor {
  latest_metrics?: CompetitorMetrics | null;
}

/**
 * List competitors for a workspace
 */
export async function listCompetitors(
  workspaceId: string,
  supabaseClient?: SupabaseClient
): Promise<CompetitorWithMetrics[]> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: competitors, error } = await supabase
    .from("studio_competitors")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error || !competitors) {
    console.error("Error fetching competitors:", error);
    return [];
  }

  // Fetch latest metrics for each competitor
  const competitorsWithMetrics = await Promise.all(
    competitors.map(async (comp) => {
      const latestMetrics = await getLatestCompetitorMetrics(comp.id, supabase);
      return {
        ...comp,
        latest_metrics: latestMetrics,
      } as CompetitorWithMetrics;
    })
  );

  return competitorsWithMetrics;
}

/**
 * Add a competitor
 */
export async function addCompetitor(
  workspaceId: string,
  userId: string,
  data: {
    platform: CompetitorPlatform;
    handle: string;
    label?: string;
  },
  supabaseClient?: SupabaseClient
): Promise<Competitor> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Normalize handle (remove @ if present)
  const normalizedHandle = data.handle.replace(/^@/, "");

  const { data: competitor, error } = await supabase
    .from("studio_competitors")
    .insert({
      workspace_id: workspaceId,
      platform: data.platform,
      handle: normalizedHandle,
      label: data.label || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error || !competitor) {
    throw new Error(`Failed to add competitor: ${error?.message || "unknown error"}`);
  }

  return competitor as Competitor;
}

/**
 * Get latest metrics for a competitor
 */
export async function getLatestCompetitorMetrics(
  competitorId: string,
  supabaseClient?: SupabaseClient
): Promise<CompetitorMetrics | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: metrics, error } = await supabase
    .from("studio_competitor_metrics")
    .select("*")
    .eq("competitor_id", competitorId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !metrics) {
    return null;
  }

  return metrics as CompetitorMetrics;
}

/**
 * Get metrics time-series for a competitor
 */
export async function getCompetitorMetricsTimeSeries(
  competitorId: string,
  days: number = 60,
  supabaseClient?: SupabaseClient
): Promise<CompetitorMetrics[]> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);

  const { data: metrics, error } = await supabase
    .from("studio_competitor_metrics")
    .select("*")
    .eq("competitor_id", competitorId)
    .gte("captured_at", thresholdDate.toISOString())
    .order("captured_at", { ascending: true });

  if (error || !metrics) {
    console.error("Error fetching competitor metrics time-series:", error);
    return [];
  }

  return metrics as CompetitorMetrics[];
}

/**
 * Fetch Instagram competitor metrics (stub for now)
 * TODO: Implement real Instagram Graph API call for public profile data
 */
async function fetchInstagramCompetitorMetrics(handle: string): Promise<Partial<CompetitorMetrics> | null> {
  // TODO: Implement Instagram Graph API call
  // For now, return null to indicate no data available
  // Example structure:
  // const response = await fetch(`https://graph.instagram.com/${userId}?fields=followers_count,media_count&access_token=...`);
  // return {
  //   followers: response.followers_count,
  //   posts_count: response.media_count,
  //   avg_engagement_estimate: null, // Would need to fetch posts to calculate
  // };
  
  await logInfo("competitor_fetch_stub", {
    platform: "instagram",
    handle,
    note: "API not implemented yet",
  });
  return null;
}

/**
 * Fetch TikTok competitor metrics (stub for now)
 * TODO: Implement TikTok Open API call for public profile data
 */
async function fetchTikTokCompetitorMetrics(handle: string): Promise<Partial<CompetitorMetrics> | null> {
  // TODO: Implement TikTok Open API call
  // For now, return null to indicate no data available
  
  await logInfo("competitor_fetch_stub", {
    platform: "tiktok",
    handle,
    note: "API not implemented yet",
  });
  return null;
}

/**
 * Fetch Facebook competitor metrics (stub for now)
 * TODO: Implement Facebook Graph API call for public page data
 */
async function fetchFacebookCompetitorMetrics(handle: string): Promise<Partial<CompetitorMetrics> | null> {
  // TODO: Implement Facebook Graph API call
  // For now, return null to indicate no data available
  
  await logInfo("competitor_fetch_stub", {
    platform: "facebook",
    handle,
    note: "API not implemented yet",
  });
  return null;
}

/**
 * Refresh metrics for a single competitor
 */
export async function refreshCompetitorMetrics(
  competitorId: string,
  supabaseClient?: SupabaseClient
): Promise<CompetitorMetrics | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Get competitor details
  const { data: competitor, error: compError } = await supabase
    .from("studio_competitors")
    .select("*")
    .eq("id", competitorId)
    .single();

  if (compError || !competitor) {
    await logError("competitor_refresh_not_found", {
      competitor_id: competitorId,
      error: compError?.message,
    });
    return null;
  }

  await logInfo("competitor_refresh_start", {
    workspace_id: competitor.workspace_id,
    competitor_id: competitorId,
    platform: competitor.platform,
    handle: competitor.handle,
  });

  // Fetch metrics based on platform
  let metricsData: Partial<CompetitorMetrics> | null = null;

  switch (competitor.platform) {
    case "instagram":
      metricsData = await fetchInstagramCompetitorMetrics(competitor.handle);
      break;
    case "tiktok":
      metricsData = await fetchTikTokCompetitorMetrics(competitor.handle);
      break;
    case "facebook":
      metricsData = await fetchFacebookCompetitorMetrics(competitor.handle);
      break;
  }

  // If no data available, skip creating metrics record
  if (!metricsData) {
    await logWarn("competitor_refresh_no_data", {
      workspace_id: competitor.workspace_id,
      competitor_id: competitorId,
      platform: competitor.platform,
      handle: competitor.handle,
      note: "API stub returned no data",
    });
    return null;
  }

  // Insert metrics snapshot
  const { data: metrics, error: metricsError } = await supabase
    .from("studio_competitor_metrics")
    .insert({
      competitor_id: competitorId,
      followers: metricsData.followers || null,
      posts_count: metricsData.posts_count || null,
      avg_engagement_estimate: metricsData.avg_engagement_estimate || null,
      metadata: metricsData.metadata || {},
    })
    .select()
    .single();

  if (metricsError || !metrics) {
    await logError("competitor_refresh_save_error", {
      workspace_id: competitor.workspace_id,
      competitor_id: competitorId,
      error: metricsError?.message,
    });
    return null;
  }

  await logInfo("competitor_refresh_success", {
    workspace_id: competitor.workspace_id,
    competitor_id: competitorId,
    platform: competitor.platform,
    handle: competitor.handle,
  });

  return metrics as CompetitorMetrics;
}

/**
 * Refresh metrics for all competitors in a workspace
 */
export async function refreshWorkspaceCompetitorMetrics(
  workspaceId: string,
  supabaseClient?: SupabaseClient
): Promise<{ refreshed: number; failed: number }> {
  const supabase = supabaseClient || getSupabaseServerClient();

  await logInfo("competitor_refresh_workspace_start", {
    workspace_id: workspaceId,
  });

  const { data: competitors, error } = await supabase
    .from("studio_competitors")
    .select("id")
    .eq("workspace_id", workspaceId);

  if (error || !competitors) {
    await logError("competitor_refresh_workspace_fetch_error", {
      workspace_id: workspaceId,
      error: error?.message,
    });
    return { refreshed: 0, failed: 0 };
  }

  let refreshed = 0;
  let failed = 0;

  for (const competitor of competitors) {
    try {
      const result = await refreshCompetitorMetrics(competitor.id, supabase);
      if (result) {
        refreshed++;
      } else {
        failed++;
      }
      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error refreshing metrics for competitor ${competitor.id}:`, error);
      failed++;
    }
  }

  return { refreshed, failed };
}

/**
 * Refresh metrics for all competitors across all workspaces
 */
export async function refreshAllCompetitorsMetrics(
  supabaseClient?: SupabaseClient
): Promise<{ refreshed: number; failed: number }> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: competitors, error } = await supabase
    .from("studio_competitors")
    .select("id, workspace_id");

  if (error || !competitors) {
    console.error("Error fetching all competitors:", error);
    return { refreshed: 0, failed: 0 };
  }

  let refreshed = 0;
  let failed = 0;

  for (const competitor of competitors) {
    try {
      const result = await refreshCompetitorMetrics(competitor.id, supabase);
      if (result) {
        refreshed++;
      } else {
        failed++;
      }
      // Small delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error refreshing metrics for competitor ${competitor.id}:`, error);
      failed++;
    }
  }

  return { refreshed, failed };
}

/**
 * Get competitor summary for reports/planner context
 */
export async function getCompetitorSummary(
  workspaceId: string,
  supabaseClient?: SupabaseClient
): Promise<{
  competitors: Array<{
    platform: CompetitorPlatform;
    handle: string;
    label: string | null;
    followers: number | null;
    posts_count: number | null;
  }>;
}> {
  const competitors = await listCompetitors(workspaceId, supabaseClient);

  return {
    competitors: competitors.map((comp) => ({
      platform: comp.platform,
      handle: comp.handle,
      label: comp.label,
      followers: comp.latest_metrics?.followers || null,
      posts_count: comp.latest_metrics?.posts_count || null,
    })),
  };
}

