/**
 * Studio Experiment Service
 * 
 * Service for managing A/B tests (experiments) and computing results.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";
import { getCachedLLMResponse, setCachedLLMResponse } from "./cache";

export type ExperimentType = "caption" | "hook" | "time" | "hashtags" | "media" | "other";
export type ExperimentStatus = "pending" | "running" | "completed" | "cancelled";

export interface Experiment {
  id: string;
  workspace_id: string;
  name: string;
  type: ExperimentType;
  status: ExperimentStatus;
  description?: string | null;
  created_at: string;
  created_by?: string | null;
  completed_at?: string | null;
  winner_variant_label?: string | null;
  summary_markdown?: string | null;
}

export interface VariantMetrics {
  variant_label: string;
  post_id: string;
  platform: string;
  caption: string | null;
  impressions: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement: number; // likes + comments + shares + saves
  engagement_rate: number; // engagement / impressions (or views for TikTok)
  predicted_score_label?: string | null;
  predicted_score_numeric?: number | null;
}

export interface ExperimentResults {
  experiment_id: string;
  variant_metrics: VariantMetrics[];
  winner_variant_label: string | null;
  winner_reason: string | null;
  total_impressions: number;
  total_engagement: number;
  avg_engagement_rate: number;
}

const MIN_IMPRESSIONS_THRESHOLD = 500; // Minimum impressions to declare a winner

/**
 * Create an experiment and assign variant labels to posts
 */
export async function createExperiment(
  workspaceId: string,
  userId: string,
  data: {
    name: string;
    type: ExperimentType;
    description?: string;
    post_ids: string[];
  },
  supabaseClient?: SupabaseClient
): Promise<Experiment> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Validate: at least 2 posts
  if (!data.post_ids || data.post_ids.length < 2) {
    throw new Error("At least 2 posts are required for an experiment");
  }

  // Validate: all posts belong to workspace and are not in another experiment
  const { data: posts, error: postsError } = await supabase
    .from("studio_social_posts")
    .select("id, experiment_id")
    .eq("workspace_id", workspaceId)
    .in("id", data.post_ids);

  if (postsError || !posts || posts.length !== data.post_ids.length) {
    throw new Error("Some posts not found or don't belong to workspace");
  }

  // Check for existing experiments
  const postsInExperiments = posts.filter((p) => p.experiment_id !== null);
  if (postsInExperiments.length > 0) {
    throw new Error("Some posts are already part of an experiment");
  }

  // Create experiment
  const { data: experiment, error: experimentError } = await supabase
    .from("studio_experiments")
    .insert({
      workspace_id: workspaceId,
      name: data.name,
      type: data.type,
      description: data.description || null,
      status: "running",
      created_by: userId,
    })
    .select()
    .single();

  if (experimentError || !experiment) {
    throw new Error(`Failed to create experiment: ${experimentError?.message || "unknown error"}`);
  }

  // Assign variant labels
  const variantMap = assignVariants(data.post_ids);

  // Update posts with experiment_id and variant labels
  for (const [postId, variantLabel] of Object.entries(variantMap)) {
    const { error: updateError } = await supabase
      .from("studio_social_posts")
      .update({
        experiment_id: experiment.id,
        experiment_variant_label: variantLabel,
      })
      .eq("id", postId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      console.error(`Failed to assign variant to post ${postId}:`, updateError);
      // Continue with other posts, but log error
    }
  }

  return experiment as Experiment;
}

/**
 * Assign variant labels deterministically to post IDs
 */
export function assignVariants(postIds: string[]): Record<string, string> {
  const labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const variantMap: Record<string, string> = {};

  // Sort post IDs for deterministic assignment
  const sortedIds = [...postIds].sort();

  sortedIds.forEach((postId, index) => {
    if (index < labels.length) {
      variantMap[postId] = labels[index];
    } else {
      // If more than 10 posts, use numeric suffix
      variantMap[postId] = labels[index % labels.length] + Math.floor(index / labels.length);
    }
  });

  return variantMap;
}

/**
 * Compute experiment results from metrics
 */
export async function computeExperimentResults(
  experimentId: string,
  supabaseClient?: SupabaseClient
): Promise<ExperimentResults> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Fetch experiment
  const { data: experiment, error: expError } = await supabase
    .from("studio_experiments")
    .select("*")
    .eq("id", experimentId)
    .single();

  if (expError || !experiment) {
    throw new Error("Experiment not found");
  }

  // Fetch all posts in the experiment
  const { data: posts, error: postsError } = await supabase
    .from("studio_social_posts")
    .select(`
      id,
      platform,
      caption,
      experiment_variant_label,
      predicted_score_label,
      predicted_score_numeric,
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
    .eq("experiment_id", experimentId)
    .eq("workspace_id", experiment.workspace_id);

  if (postsError || !posts) {
    throw new Error("Failed to fetch experiment posts");
  }

  // Compute metrics per variant
  const variantMetrics: VariantMetrics[] = [];

  for (const post of posts) {
    if (!post.experiment_variant_label) continue;

    const metricsArray = post.studio_social_post_metrics as any[];
    if (!metricsArray || metricsArray.length === 0) {
      // No metrics yet, create placeholder
      variantMetrics.push({
        variant_label: post.experiment_variant_label,
        post_id: post.id,
        platform: post.platform,
        caption: post.caption,
        impressions: 0,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        engagement: 0,
        engagement_rate: 0,
        predicted_score_label: post.predicted_score_label,
        predicted_score_numeric: post.predicted_score_numeric,
      });
      continue;
    }

    // Get latest metrics
    const latestMetric = metricsArray.sort(
      (a: any, b: any) =>
        new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
    )[0];

    const impressions = latestMetric.impressions || 0;
    const views = latestMetric.views || 0;
    const likes = latestMetric.likes || 0;
    const comments = latestMetric.comments || 0;
    const shares = latestMetric.shares || 0;
    const saves = latestMetric.saves || 0;

    const engagement = likes + comments + shares + saves;
    const denominator = post.platform === "tiktok" ? views : impressions;
    const engagement_rate = denominator > 0 ? (engagement / denominator) * 100 : 0;

    variantMetrics.push({
      variant_label: post.experiment_variant_label,
      post_id: post.id,
      platform: post.platform,
      caption: post.caption,
      impressions,
      views,
      likes,
      comments,
      shares,
      saves,
      engagement,
      engagement_rate: Math.round(engagement_rate * 10) / 10,
      predicted_score_label: post.predicted_score_label,
      predicted_score_numeric: post.predicted_score_numeric,
    });
  }

  // Aggregate totals
  const totalImpressions = variantMetrics.reduce((sum, v) => sum + v.impressions, 0);
  const totalEngagement = variantMetrics.reduce((sum, v) => sum + v.engagement, 0);
  const avgEngagementRate =
    variantMetrics.length > 0
      ? variantMetrics.reduce((sum, v) => sum + v.engagement_rate, 0) / variantMetrics.length
      : 0;

  // Determine winner
  let winnerVariantLabel: string | null = null;
  let winnerReason: string | null = null;

  if (totalImpressions >= MIN_IMPRESSIONS_THRESHOLD && variantMetrics.length >= 2) {
    // Sort by engagement rate (descending)
    const sorted = [...variantMetrics].sort((a, b) => b.engagement_rate - a.engagement_rate);
    const topVariant = sorted[0];
    const secondVariant = sorted[1];

    // Winner if engagement rate is at least 10% higher than second place
    const margin = topVariant.engagement_rate - secondVariant.engagement_rate;
    const marginPercent = secondVariant.engagement_rate > 0
      ? (margin / secondVariant.engagement_rate) * 100
      : 0;

    if (marginPercent >= 10) {
      winnerVariantLabel = topVariant.variant_label;
      winnerReason = `Variant ${topVariant.variant_label} had ${topVariant.engagement_rate.toFixed(1)}% engagement rate vs ${secondVariant.engagement_rate.toFixed(1)}% for Variant ${secondVariant.variant_label} (${marginPercent.toFixed(1)}% higher)`;
    } else if (margin > 0) {
      // Close margin, but still declare winner
      winnerVariantLabel = topVariant.variant_label;
      winnerReason = `Variant ${topVariant.variant_label} had slightly higher engagement (${topVariant.engagement_rate.toFixed(1)}% vs ${secondVariant.engagement_rate.toFixed(1)}%)`;
    } else {
      winnerReason = "No clear winner - variants performed similarly";
    }
  } else if (totalImpressions < MIN_IMPRESSIONS_THRESHOLD) {
    winnerReason = `Not enough data yet (${totalImpressions} impressions, need ${MIN_IMPRESSIONS_THRESHOLD}+)`;
  } else {
    winnerReason = "Need at least 2 variants with data";
  }

  return {
    experiment_id: experimentId,
    variant_metrics: variantMetrics,
    winner_variant_label: winnerVariantLabel,
    winner_reason: winnerReason,
    total_impressions: totalImpressions,
    total_engagement: totalEngagement,
    avg_engagement_rate: Math.round(avgEngagementRate * 10) / 10,
  };
}

/**
 * Generate LLM summary of experiment results
 */
export async function summarizeExperimentResults(
  experimentId: string,
  supabaseClient?: SupabaseClient
): Promise<string> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Fetch experiment
  const { data: experiment } = await supabase
    .from("studio_experiments")
    .select("*")
    .eq("id", experimentId)
    .single();

  if (!experiment) {
    throw new Error("Experiment not found");
  }

  // Compute results
  const results = await computeExperimentResults(experimentId, supabase);

  // Build cache key from results
  const cacheKey = JSON.stringify({
    experimentId,
    variantMetrics: results.variant_metrics.map((v) => ({
      label: v.variant_label,
      engagement_rate: v.engagement_rate,
      impressions: v.impressions,
    })),
    winner: results.winner_variant_label,
  });

  // Try cache first
  const cached = await getCachedLLMResponse(
    `experiment_summary_${experimentId}`,
    "experiment_summary",
    { results: cacheKey },
    experiment.workspace_id,
    supabase
  );

  if (cached) {
    return cached;
  }

  // Build LLM prompt
  const systemPrompt = `You are a social media analytics expert. Summarize A/B test results in a clear, actionable way.

Keep summaries brief (3-4 sentences). Focus on:
1. What was tested
2. Which variant performed best and why
3. Actionable recommendations for future content`;

  const userPrompt = `Summarize this A/B test experiment:

Experiment: ${experiment.name}
Type: ${experiment.type}
${experiment.description ? `Description: ${experiment.description}` : ""}

Results:
${results.variant_metrics
  .map(
    (v) => `
Variant ${v.variant_label}:
- Platform: ${v.platform}
- Caption: ${(v.caption || "").substring(0, 100)}${(v.caption || "").length > 100 ? "..." : ""}
- Impressions: ${v.impressions.toLocaleString()}
- Engagement Rate: ${v.engagement_rate.toFixed(1)}%
- Engagement: ${v.engagement.toLocaleString()} (${v.likes} likes, ${v.comments} comments, ${v.shares} shares, ${v.saves} saves)
${v.predicted_score_label ? `- Predicted Score: ${v.predicted_score_label} (${v.predicted_score_numeric?.toFixed(2)})` : ""}
`
  )
  .join("\n")}

Winner: ${results.winner_variant_label || "No clear winner yet"}
Reason: ${results.winner_reason || "Insufficient data"}

Total Impressions: ${results.total_impressions.toLocaleString()}
Average Engagement Rate: ${results.avg_engagement_rate.toFixed(1)}%

Provide a brief summary (3-4 sentences) with actionable insights.`;

  try {
    const completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.studio.primaryModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const summary = completion.choices[0]?.message?.content || "Unable to generate summary.";

    // Cache the response
    await setCachedLLMResponse(
      `experiment_summary_${experimentId}`,
      summary,
      "experiment_summary",
      { results: cacheKey },
      experiment.workspace_id,
      7 * 24 * 60 * 60, // 7 days TTL
      supabase
    );

    return summary;
  } catch (error) {
    console.error("Error generating experiment summary:", error);
    return "Unable to generate summary at this time.";
  }
}

/**
 * Get experiments for a workspace
 */
export async function getWorkspaceExperiments(
  workspaceId: string,
  options: {
    status?: ExperimentStatus;
    limit?: number;
    supabaseClient?: SupabaseClient;
  } = {}
): Promise<Experiment[]> {
  const supabase = options.supabaseClient || getSupabaseServerClient();

  let query = supabase
    .from("studio_experiments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data: experiments, error } = await query;

  if (error || !experiments) {
    console.error("Error fetching experiments:", error);
    return [];
  }

  return experiments as Experiment[];
}

/**
 * Get a single experiment with details
 */
export async function getExperiment(
  experimentId: string,
  supabaseClient?: SupabaseClient
): Promise<Experiment | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: experiment, error } = await supabase
    .from("studio_experiments")
    .select("*")
    .eq("id", experimentId)
    .single();

  if (error || !experiment) {
    console.error("Error fetching experiment:", error);
    return null;
  }

  return experiment as Experiment;
}

