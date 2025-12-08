/**
 * Studio Report Service
 * 
 * Service for generating weekly reports with insights and recommendations.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { computeMetricsSummary } from "./metrics-summary-service";
import { getBrandProfile, formatBrandProfileForPrompt } from "./brand-profile-service";
import { getWorkspaceExperiments, computeExperimentResults } from "./experiment-service";
import { getCompetitorSummary } from "./competitor-service";
import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";
import { logInfo, logError, logWarn } from "./logging";
import { LLMOutputError } from "./errors";

export interface WeeklyReport {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  summary_markdown: string;
  created_at: string;
  created_by: string | null;
}

export interface ReportMetrics {
  total_posts: number;
  total_impressions: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_saves: number;
  avg_engagement_rate: number;
  top_posts: Array<{
    post_id: string;
    platform: string;
    caption_excerpt: string;
    engagement_rate: number;
    impressions: number;
    likes: number;
    reason?: string; // Why it performed well
  }>;
  deltas?: {
    posts: number; // Change vs previous period
    impressions: number;
    engagement_rate: number;
  };
}

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
 * Fetch metrics for a specific period
 */
async function fetchPeriodMetrics(
  workspaceId: string,
  periodStart: Date,
  periodEnd: Date,
  supabase: SupabaseClient,
  campaignId?: string
): Promise<ReportMetrics> {
  // Fetch posts with metrics for the period
  let query = supabase
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
    .gte("posted_at", periodStart.toISOString())
    .lte("posted_at", periodEnd.toISOString())
    .not("posted_at", "is", null);

  // Filter by campaign if provided
  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }

  const { data: posts, error } = await query;

  if (error || !posts) {
    return {
      total_posts: 0,
      total_impressions: 0,
      total_views: 0,
      total_likes: 0,
      total_comments: 0,
      total_shares: 0,
      total_saves: 0,
      avg_engagement_rate: 0,
      top_posts: [],
    };
  }

  // Process posts and calculate metrics
  let totalImpressions = 0;
  let totalViews = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;
  let totalSaves = 0;
  const postMetrics: Array<{
    post_id: string;
    platform: string;
    caption_excerpt: string;
    engagement_rate: number;
    impressions: number;
    likes: number;
  }> = [];

  for (const post of posts) {
    const metricsArray = post.studio_social_post_metrics as any[];
    const latestMetrics = metricsArray && metricsArray.length > 0
      ? metricsArray.sort((a: any, b: any) => 
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        )[0]
      : null;

    if (!latestMetrics) continue;

    const impressions = latestMetrics.impressions || 0;
    const views = latestMetrics.views || 0;
    const likes = latestMetrics.likes || 0;
    const comments = latestMetrics.comments || 0;
    const shares = latestMetrics.shares || 0;
    const saves = latestMetrics.saves || 0;

    totalImpressions += impressions;
    totalViews += views;
    totalLikes += likes;
    totalComments += comments;
    totalShares += shares;
    totalSaves += saves;

    const engagementRate = calculateEngagementRate(post.platform, latestMetrics);

    postMetrics.push({
      post_id: post.id,
      platform: post.platform,
      caption_excerpt: (post.caption || "").substring(0, 100),
      engagement_rate: engagementRate,
      impressions: impressions,
      likes: likes,
    });
  }

  // Calculate average engagement rate
  const avgEngagementRate = postMetrics.length > 0
    ? postMetrics.reduce((sum, p) => sum + p.engagement_rate, 0) / postMetrics.length
    : 0;

  // Get top 3 posts by engagement rate
  const topPosts = [...postMetrics]
    .sort((a, b) => b.engagement_rate - a.engagement_rate)
    .slice(0, 3);

  return {
    total_posts: posts.length,
    total_impressions: totalImpressions,
    total_views: totalViews,
    total_likes: totalLikes,
    total_comments: totalComments,
    total_shares: totalShares,
    total_saves: totalSaves,
    avg_engagement_rate: Math.round(avgEngagementRate * 10) / 10,
    top_posts: topPosts,
  };
}

/**
 * Calculate deltas vs previous period
 */
async function calculateDeltas(
  workspaceId: string,
  currentPeriod: ReportMetrics,
  periodStart: Date,
  periodEnd: Date,
  supabase: SupabaseClient
): Promise<ReportMetrics["deltas"]> {
  // Calculate previous period (same length, one period before)
  const periodLength = periodEnd.getTime() - periodStart.getTime();
  const previousPeriodEnd = new Date(periodStart.getTime() - 1);
  const previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodLength);

  const previousMetrics = await fetchPeriodMetrics(
    workspaceId,
    previousPeriodStart,
    previousPeriodEnd,
    supabase
  );

  if (previousMetrics.total_posts === 0) {
    return undefined; // No previous data to compare
  }

  return {
    posts: currentPeriod.total_posts - previousMetrics.total_posts,
    impressions: currentPeriod.total_impressions - previousMetrics.total_impressions,
    engagement_rate: currentPeriod.avg_engagement_rate - previousMetrics.avg_engagement_rate,
  };
}

/**
 * Generate a weekly report for a workspace
 */
export async function generateWeeklyReport(
  workspaceId: string,
  periodStart?: Date,
  periodEnd?: Date,
  userId?: string,
  options?: {
    campaign_id?: string;
    supabaseClient?: SupabaseClient;
  }
): Promise<WeeklyReport> {
  const supabaseClient = options?.supabaseClient || getSupabaseServerClient();
  const supabase = supabaseClient || getSupabaseServerClient();
  const startTime = Date.now();

  await logInfo("report_generation_start", {
    workspace_id: workspaceId,
    period_start: periodStart?.toISOString(),
    period_end: periodEnd?.toISOString(),
    campaign_id: options?.campaign_id,
  });

  try {

  // Determine period (default to last week, Monday to Sunday)
  let reportPeriodStart: Date;
  let reportPeriodEnd: Date;

  if (periodStart && periodEnd) {
    reportPeriodStart = periodStart;
    reportPeriodEnd = periodEnd;
  } else {
    // Default to last week
    const lastWeek = subWeeks(new Date(), 1);
    reportPeriodStart = startOfWeek(lastWeek, { weekStartsOn: 1 }); // Monday
    reportPeriodEnd = endOfWeek(lastWeek, { weekStartsOn: 1 }); // Sunday
  }

  // Check if report already exists for this period
  const { data: existingReport } = await supabase
    .from("studio_reports")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("period_start", reportPeriodStart.toISOString())
    .eq("period_end", reportPeriodEnd.toISOString())
    .single();

  if (existingReport) {
    // Return existing report
    const { data: report } = await supabase
      .from("studio_reports")
      .select("*")
      .eq("id", existingReport.id)
      .single();

    if (report) {
      return report as WeeklyReport;
    }
  }

  // Fetch metrics for current period
  const currentMetrics = await fetchPeriodMetrics(
    workspaceId,
    reportPeriodStart,
    reportPeriodEnd,
    supabase,
    options?.campaign_id
  );

  // Calculate deltas vs previous period
  const deltas = await calculateDeltas(
    workspaceId,
    currentMetrics,
    reportPeriodStart,
    reportPeriodEnd,
    supabase
  );

  // Fetch brand profile
  const brandProfile = await getBrandProfile(workspaceId, supabase);
  const brandProfileText = formatBrandProfileForPrompt(brandProfile);

  // Fetch competitor summary
  const competitorSummary = await getCompetitorSummary(workspaceId, supabase);

  // Fetch experiments for the period
  const experiments = await getWorkspaceExperiments(workspaceId, {
    supabaseClient: supabase,
  });

  // Filter experiments relevant to this period (created or had posts published in period)
  const relevantExperiments = experiments.filter((exp) => {
    const expCreated = new Date(exp.created_at);
    return expCreated >= reportPeriodStart && expCreated <= reportPeriodEnd;
  });

  // Compute results for relevant experiments
  const experimentSummaries: Array<{
    name: string;
    type: string;
    variants: number;
    winner: string | null;
    engagement_rates: Record<string, number>;
  }> = [];

  for (const exp of relevantExperiments) {
    try {
      const results = await computeExperimentResults(exp.id, supabase);
      experimentSummaries.push({
        name: exp.name,
        type: exp.type,
        variants: results.variant_metrics.length,
        winner: results.winner_variant_label,
        engagement_rates: results.variant_metrics.reduce(
          (acc, v) => {
            acc[v.variant_label] = v.engagement_rate;
            return acc;
          },
          {} as Record<string, number>
        ),
      });
    } catch (error: any) {
      await logWarn("report_experiment_compute_error", {
        workspace_id: workspaceId,
        experiment_id: exp.id,
        error: error.message,
      });
    }
  }

  // Determine if this is a "getting started" report (sparse metrics)
  const isGettingStarted = currentMetrics.total_posts < 5 || currentMetrics.total_impressions === 0;

  // Build LLM prompt
  const systemPrompt = `You are a social media analytics expert and content strategist. Your job is to write clear, actionable weekly reports that help brands understand their social media performance and improve.

Write in plain, conversational language. Be specific and actionable. Focus on:
1. What worked (top posts, successful strategies)
2. What didn't work (underperforming content, missed opportunities)
3. What to do next week (specific recommendations)

Use markdown formatting for readability.`;

  const userPrompt = `Generate a weekly report for the period ${format(reportPeriodStart, "MMM d")} - ${format(reportPeriodEnd, "MMM d, yyyy")}.

${isGettingStarted ? `
⚠️ GETTING STARTED: This workspace has limited data (${currentMetrics.total_posts} posts). Write a shorter, encouraging "getting started" report that:
- Acknowledges they're just beginning
- Provides general best practices
- Encourages consistent posting
- Sets expectations
` : `
PERFORMANCE METRICS:
- Total Posts: ${currentMetrics.total_posts}
- Total Impressions: ${currentMetrics.total_impressions.toLocaleString()}
- Total Views: ${currentMetrics.total_views.toLocaleString()}
- Total Likes: ${currentMetrics.total_likes.toLocaleString()}
- Total Comments: ${currentMetrics.total_comments.toLocaleString()}
- Total Shares: ${currentMetrics.total_shares.toLocaleString()}
- Total Saves: ${currentMetrics.total_saves.toLocaleString()}
- Average Engagement Rate: ${currentMetrics.avg_engagement_rate}%

${deltas ? `
CHANGES vs Previous Week:
- Posts: ${deltas.posts > 0 ? "+" : ""}${deltas.posts}
- Impressions: ${deltas.impressions > 0 ? "+" : ""}${deltas.impressions.toLocaleString()}
- Engagement Rate: ${deltas.engagement_rate > 0 ? "+" : ""}${deltas.engagement_rate.toFixed(1)}%
` : ""}

TOP PERFORMING POSTS:
${currentMetrics.top_posts.map((post, i) => `
${i + 1}. ${post.platform.toUpperCase()} - "${post.caption_excerpt}..."
   - Engagement Rate: ${post.engagement_rate.toFixed(1)}%
   - Impressions: ${post.impressions.toLocaleString()}
   - Likes: ${post.likes.toLocaleString()}
`).join("\n")}
`}

${brandProfileText ? `
BRAND PROFILE:
${brandProfileText}
` : ""}

${competitorSummary.competitors.length > 0 ? `
COMPETITOR CONTEXT:
${competitorSummary.competitors.map((comp: any) => `
- ${comp.label || comp.handle} (@${comp.handle} on ${comp.platform}):
  - Followers: ${comp.followers ? comp.followers.toLocaleString() : "N/A"}
  - Posts: ${comp.posts_count ? comp.posts_count.toLocaleString() : "N/A"}
`).join("\n")}
` : ""}

Write a markdown report with these sections:
1. **Week at a Glance** - Quick summary of key numbers
2. **What Worked** - Top posts and successful strategies
3. **What Didn't Work** - Areas for improvement
4. **Recommendations for Next Week** - Specific, actionable steps

Keep it concise but informative. Use bullet points and clear headings.`;

  // Call LLM
  const llmStartTime = Date.now();
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.studio.primaryModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });
  } catch (error: any) {
    await logError("report_llm_error", {
      workspace_id: workspaceId,
      period_start: reportPeriodStart.toISOString(),
      period_end: reportPeriodEnd.toISOString(),
      error: error.message,
    });
    throw new LLMOutputError("Failed to generate weekly report", {
      workspaceId,
      metadata: { periodStart: reportPeriodStart, periodEnd: reportPeriodEnd },
      cause: error,
    });
  }

  const llmDurationMs = Date.now() - llmStartTime;
  await logInfo("report_llm_call", {
    workspace_id: workspaceId,
    period_start: reportPeriodStart.toISOString(),
    period_end: reportPeriodEnd.toISOString(),
    duration_ms: llmDurationMs,
  });

  const summaryMarkdown = completion.choices[0]?.message?.content;
  if (!summaryMarkdown) {
    await logError("report_no_llm_content", {
      workspace_id: workspaceId,
      period_start: reportPeriodStart.toISOString(),
      period_end: reportPeriodEnd.toISOString(),
    });
    throw new LLMOutputError("No content returned from LLM", {
      workspaceId,
      metadata: { periodStart: reportPeriodStart, periodEnd: reportPeriodEnd },
    });
  }

  // Save report to database
  const { data: report, error: reportError } = await supabase
    .from("studio_reports")
    .insert({
      workspace_id: workspaceId,
      period_start: reportPeriodStart.toISOString(),
      period_end: reportPeriodEnd.toISOString(),
      summary_markdown: summaryMarkdown,
      created_by: userId || null,
    })
    .select()
    .single();

  if (reportError || !report) {
    await logError("report_save_error", {
      workspace_id: workspaceId,
      period_start: reportPeriodStart.toISOString(),
      period_end: reportPeriodEnd.toISOString(),
      error: reportError?.message,
    });
    throw new Error("Failed to save report");
  }

  const durationMs = Date.now() - startTime;
  await logInfo("report_generation_success", {
    workspace_id: workspaceId,
    report_id: report.id,
    period_start: reportPeriodStart.toISOString(),
    period_end: reportPeriodEnd.toISOString(),
    duration_ms: durationMs,
  });

  return report as WeeklyReport;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    await logError("report_generation_exception", {
      workspace_id: workspaceId,
      period_start: periodStart?.toISOString(),
      period_end: periodEnd?.toISOString(),
      error: error.message,
      stack: error.stack,
      duration_ms: durationMs,
    });
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Get reports for a workspace
 */
export async function getWorkspaceReports(
  workspaceId: string,
  limit: number = 10,
  supabaseClient?: SupabaseClient
): Promise<WeeklyReport[]> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: reports, error } = await supabase
    .from("studio_reports")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("period_start", { ascending: false })
    .limit(limit);

  if (error || !reports) {
    console.error("Error fetching reports:", error);
    return [];
  }

  return reports as WeeklyReport[];
}

/**
 * Get a specific report by ID
 */
export async function getReport(
  reportId: string,
  supabaseClient?: SupabaseClient
): Promise<WeeklyReport | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: report, error } = await supabase
    .from("studio_reports")
    .select("*")
    .eq("id", reportId)
    .single();

  if (error || !report) {
    console.error("Error fetching report:", error);
    return null;
  }

  return report as WeeklyReport;
}

