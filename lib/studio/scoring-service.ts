/**
 * Studio Draft Scoring Service
 * 
 * Scores draft posts with expected performance predictions (low/medium/high)
 * and provides explanatory reasoning.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrandProfile, formatBrandProfileForPrompt } from "./brand-profile-service";
import { computeMetricsSummary } from "./metrics-summary-service";
import { getTopHashtagsForSuggestions } from "./hashtag-analytics-service";
import { parseHashtags } from "./hashtag-service";
import { summarizeWorkspacePreferences } from "./personalization-service";
import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";
import { logInfo, logError } from "./logging";
import { LLMOutputError } from "./errors";

export type ScoreLabel = "low" | "medium" | "high";

export interface DraftFeatures {
  platform: string;
  caption_length: number;
  hashtag_count: number;
  hashtag_names: string[];
  media_type?: string;
  scheduled_for?: string;
  scheduled_day_of_week?: string;
  scheduled_hour?: number;
  repurposed_from_post_id?: string;
  content_group_id?: string;
  emoji_count: number;
}

export interface ScoreResult {
  score_label: ScoreLabel;
  score_numeric: number;
  reasoning_features: {
    timing_alignment?: number;
    hashtag_performance?: number;
    content_characteristics?: number;
    lineage_boost?: number;
  };
}

export interface ScoreExplanation {
  explanation: string;
  score_label: ScoreLabel;
  score_numeric: number;
}

/**
 * Extract features from a draft post for scoring
 */
export async function extractDraftFeatures(
  postId: string,
  supabaseClient?: SupabaseClient
): Promise<DraftFeatures | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: post, error } = await supabase
    .from("studio_social_posts")
    .select(`
      id,
      platform,
      caption,
      scheduled_for,
      repurposed_from_post_id,
      content_group_id,
      metadata,
      studio_post_hashtags (
        studio_hashtags (
          name
        )
      )
    `)
    .eq("id", postId)
    .single();

  if (error || !post) {
    return null;
  }

  const caption = post.caption || "";
  const hashtagNames = (post.studio_post_hashtags as any[])
    ?.map((ph: any) => ph.studio_hashtags?.name)
    .filter(Boolean) || [];

  // Parse hashtags from caption if not in DB yet
  const parsedHashtags = parseHashtags(caption);
  const allHashtags = Array.from(new Set([...hashtagNames, ...parsedHashtags]));

  // Count emojis (basic regex)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const emojiCount = (caption.match(emojiRegex) || []).length;

  let scheduledDayOfWeek: string | undefined;
  let scheduledHour: number | undefined;

  if (post.scheduled_for) {
    const scheduledDate = new Date(post.scheduled_for);
    scheduledDayOfWeek = scheduledDate.toLocaleDateString("en-US", { weekday: "long" });
    scheduledHour = scheduledDate.getHours();
  }

  return {
    platform: post.platform,
    caption_length: caption.length,
    hashtag_count: allHashtags.length,
    hashtag_names: allHashtags,
    media_type: post.metadata?.media_type || "image",
    scheduled_for: post.scheduled_for || undefined,
    scheduled_day_of_week: scheduledDayOfWeek,
    scheduled_hour: scheduledHour,
    repurposed_from_post_id: post.repurposed_from_post_id || undefined,
    content_group_id: post.content_group_id || undefined,
    emoji_count: emojiCount,
  };
}

/**
 * Score a draft post using heuristic rules
 */
export async function scoreDraft(
  workspaceId: string,
  features: DraftFeatures,
  supabaseClient?: SupabaseClient
): Promise<ScoreResult> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Get historical context
  const metricsSummary = await computeMetricsSummary(workspaceId, 60, supabase);
  const topHashtags = await getTopHashtagsForSuggestions(workspaceId, 20, 30, supabase);

  // Start with base score
  let scoreNumeric = 0.5;

  const reasoningFeatures: ScoreResult["reasoning_features"] = {};

  // 1. Timing Alignment
  const platformSummary = metricsSummary.platforms.find((p) => p.platform === features.platform);
  if (platformSummary && features.scheduled_for) {
    const bestDay = platformSummary.best_day_of_week;
    const bestTime = platformSummary.best_time_window;

    let timingScore = 0;
    if (bestDay && features.scheduled_day_of_week === bestDay.day) {
      timingScore += 0.1;
    }
    if (bestTime && features.scheduled_hour !== undefined) {
      const [startHour, endHour] = bestTime.hour_range.split("-").map(Number);
      if (features.scheduled_hour >= startHour && features.scheduled_hour < endHour) {
        timingScore += 0.1;
      }
    }
    if (timingScore > 0) {
      scoreNumeric += 0.15;
      reasoningFeatures.timing_alignment = timingScore;
    } else {
      // Penalize if scheduled at worst times (opposite of best)
      scoreNumeric -= 0.1;
    }
  }

  // 2. Hashtag Performance
  if (features.hashtag_names.length > 0 && topHashtags.length > 0) {
    const topHashtagNames = new Set(topHashtags.map((h) => h.name));
    const usedTopHashtags = features.hashtag_names.filter((name) =>
      topHashtagNames.has(name)
    );

    if (usedTopHashtags.length >= 3) {
      scoreNumeric += 0.1;
      reasoningFeatures.hashtag_performance = usedTopHashtags.length / features.hashtag_names.length;
    } else if (usedTopHashtags.length === 0 && features.hashtag_names.length > 0) {
      scoreNumeric -= 0.1;
    }
  }

  // 3. Content Characteristics
  let contentScore = 0;

  // Optimal caption length by platform
  const optimalLengths: Record<string, { min: number; max: number }> = {
    instagram: { min: 100, max: 300 },
    tiktok: { min: 50, max: 200 },
    facebook: { min: 100, max: 500 },
  };

  const optimal = optimalLengths[features.platform] || { min: 50, max: 300 };
  
  // Adjust optimal range based on user preferences
  let adjustedMin = optimal.min;
  let adjustedMax = optimal.max;
  if (preferences.prefers_short_captions && preferences.avg_caption_length_reduction) {
    // User tends to shorten, so reward shorter captions more
    adjustedMax = Math.max(optimal.min, optimal.max - (optimal.max * preferences.avg_caption_length_reduction / 100));
  }
  
  if (
    features.caption_length >= adjustedMin &&
    features.caption_length <= adjustedMax
  ) {
    contentScore += 0.1;
  } else if (features.caption_length < 50 || features.caption_length > 500) {
    contentScore -= 0.1;
  }

  // Optimal hashtag count by platform
  const optimalHashtagCounts: Record<string, { min: number; max: number }> = {
    instagram: { min: 5, max: 10 },
    tiktok: { min: 3, max: 5 },
    facebook: { min: 3, max: 8 },
  };

  const optimalHashtags = optimalHashtagCounts[features.platform] || { min: 3, max: 10 };
  
  // Adjust based on user preferences
  let adjustedHashtagMin = optimalHashtags.min;
  let adjustedHashtagMax = optimalHashtags.max;
  if (preferences.prefers_fewer_hashtags && preferences.avg_hashtag_reduction) {
    adjustedHashtagMax = Math.max(optimalHashtags.min, optimalHashtags.max - preferences.avg_hashtag_reduction);
  } else if (preferences.prefers_more_hashtags) {
    adjustedHashtagMax = optimalHashtags.max + 3; // Allow more hashtags
  }
  
  if (
    features.hashtag_count >= adjustedHashtagMin &&
    features.hashtag_count <= adjustedHashtagMax
  ) {
    contentScore += 0.1;
  } else if (features.hashtag_count > 15 || features.hashtag_count < 3) {
    contentScore -= 0.1;
  }

  if (contentScore !== 0) {
    scoreNumeric += contentScore;
    reasoningFeatures.content_characteristics = contentScore;
  }

  // 4. Lineage Boost (if repurposed from high-performing post)
  if (features.repurposed_from_post_id) {
    const { data: sourcePost } = await supabase
      .from("studio_social_posts")
      .select(`
        id,
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
      .eq("id", features.repurposed_from_post_id)
      .single();

    if (sourcePost) {
      const metricsArray = sourcePost.studio_social_post_metrics as any[];
      if (metricsArray && metricsArray.length > 0) {
        const latestMetric = metricsArray.sort(
          (a: any, b: any) =>
            new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        )[0];

        const engagement =
          (latestMetric.likes || 0) +
          (latestMetric.comments || 0) +
          (latestMetric.shares || 0) +
          (latestMetric.saves || 0);
        const denominator =
          features.platform === "tiktok"
            ? latestMetric.views || 0
            : latestMetric.impressions || 0;

        if (denominator > 0) {
          const engagementRate = (engagement / denominator) * 100;
          if (engagementRate > 3) {
            // High-performing source
            scoreNumeric += 0.2;
            reasoningFeatures.lineage_boost = engagementRate;
          }
        }
      }
    }
  }

  // Clamp score to [0, 1]
  scoreNumeric = Math.max(0, Math.min(1, scoreNumeric));

  // Map to label
  let scoreLabel: ScoreLabel;
  if (scoreNumeric < 0.4) {
    scoreLabel = "low";
  } else if (scoreNumeric >= 0.4 && scoreNumeric < 0.7) {
    scoreLabel = "medium";
  } else {
    scoreLabel = "high";
  }

  return {
    score_label: scoreLabel,
    score_numeric: scoreNumeric,
    reasoning_features: reasoningFeatures,
  };
}

/**
 * Generate LLM explanation for a draft score
 */
export async function explainDraftScore(
  workspaceId: string,
  postId: string,
  features: DraftFeatures,
  score: ScoreResult,
  supabaseClient?: SupabaseClient
): Promise<ScoreExplanation> {
  const supabase = supabaseClient || getSupabaseServerClient();
  const startTime = Date.now();

  await logInfo("scoring_explanation_start", {
    workspace_id: workspaceId,
    post_id: postId,
    score_label: score.score_label,
  });

  // Get post details
  const { data: post } = await supabase
    .from("studio_social_posts")
    .select("caption, scheduled_for, platform")
    .eq("id", postId)
    .single();

  if (!post) {
    return "Unable to generate explanation: post not found.";
  }

  // Get brand profile
  const brandProfile = await getBrandProfile(workspaceId, supabase);
  const brandProfileText = formatBrandProfileForPrompt(brandProfile);

  // Get metrics summary for context
  const metricsSummary = await computeMetricsSummary(workspaceId, 60, supabase);
  const platformSummary = metricsSummary.platforms.find((p) => p.platform === features.platform);

  // Build explanation prompt
  const systemPrompt = `You are a social media performance analyst. Explain why a draft post is predicted to perform at a specific level in a clear, actionable way.

Keep explanations brief (2-3 sentences) and specific. Focus on what can be improved if the score is low/medium, or what's working well if high.`;

  const userPrompt = `Explain why this draft post is predicted to perform at a ${score.score_label} level.

Draft Post:
- Platform: ${features.platform}
- Caption: ${post.caption || "(no caption)"}
- Scheduled: ${post.scheduled_for ? new Date(post.scheduled_for).toLocaleString() : "Not scheduled"}
- Hashtags: ${features.hashtag_count} (${features.hashtag_names.slice(0, 5).join(", ")}${features.hashtag_names.length > 5 ? "..." : ""})

Performance Factors:
- Timing Alignment: ${score.reasoning_features.timing_alignment ? "Good" : "Could be better"}
- Hashtag Performance: ${score.reasoning_features.hashtag_performance ? `${Math.round(score.reasoning_features.hashtag_performance * 100)}% top hashtags` : "No top hashtags used"}
- Content Characteristics: Caption length ${features.caption_length} chars, ${features.hashtag_count} hashtags
${score.reasoning_features.lineage_boost ? `- Lineage: Repurposed from high-performing post (${score.reasoning_features.lineage_boost.toFixed(1)}% engagement)` : ""}

${platformSummary ? `
Historical Context:
- Best posting day: ${platformSummary.best_day_of_week?.day || "N/A"}
- Best time window: ${platformSummary.best_time_window?.hour_range || "N/A"}
- Average engagement: ${platformSummary.avg_engagement_rate.toFixed(1)}%
` : ""}

${brandProfileText ? `
Brand Context:
${brandProfileText}
` : ""}

Provide a brief, actionable explanation (2-3 sentences).`;

  try {
    const completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.studio.primaryModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content || "Unable to generate explanation.";
  } catch (error) {
    console.error("Error generating score explanation:", error);
    return "Unable to generate explanation at this time.";
  }
}

/**
 * Score a draft post and optionally generate explanation
 */
export async function scoreDraftPost(
  workspaceId: string,
  postId: string,
  options: {
    generateExplanation?: boolean;
    supabaseClient?: SupabaseClient;
  } = {}
): Promise<{
  score: ScoreResult;
  explanation?: string;
}> {
  const supabase = options.supabaseClient || getSupabaseServerClient();

  // Extract features
  const features = await extractDraftFeatures(postId, supabase);
  if (!features) {
    throw new Error("Post not found or unable to extract features");
  }

  // Score the draft
  const score = await scoreDraft(workspaceId, features, supabase);

  // Optionally generate explanation
  let explanation: string | undefined;
  if (options.generateExplanation) {
    explanation = await explainDraftScore(workspaceId, postId, features, score, supabase);
  }

  // Update post with score
  await supabase
    .from("studio_social_posts")
    .update({
      predicted_score_label: score.score_label,
      predicted_score_numeric: score.score_numeric,
      predicted_score_explanation: explanation || null,
      predicted_score_updated_at: new Date().toISOString(),
    })
    .eq("id", postId);

  return {
    score,
    explanation,
  };
}

