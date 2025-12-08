/**
 * Studio Repurposing Service
 * 
 * Service for generating platform-specific content variants from a source post.
 * Uses LLM to adapt content for different platforms while preserving core message.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getBrandProfile, formatBrandProfileForPrompt } from "./brand-profile-service";
import { getTopHashtagsForSuggestions } from "./hashtag-analytics-service";
import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialPlatform } from "./social-account-service";
import { logInfo, logError, logWarn } from "./logging";
import { MissingDataError, LLMOutputError } from "./errors";

export interface PlatformContent {
  caption?: string; // For Instagram, Facebook, LinkedIn
  script?: string; // For TikTok (video script)
  hook: string; // Opening line/hook
  cta: string; // Call-to-action
  hashtags?: string[]; // Hashtag suggestions
  suggested_media_type?: "image" | "video" | "carousel" | "reel" | "story";
  notes?: string; // Platform-specific notes
}

export interface RepurposedPack {
  instagram?: PlatformContent;
  tiktok?: PlatformContent;
  facebook?: PlatformContent;
  x?: PlatformContent; // Twitter/X
  linkedin?: PlatformContent;
}

export interface RepurposingContext {
  source_caption: string;
  source_platform: SocialPlatform;
  source_metrics?: {
    impressions?: number;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    engagement_rate?: number;
  };
  is_high_performing?: boolean;
  brand_profile?: string;
}

/**
 * Generate repurposed content pack for target platforms
 */
export async function generateRepurposedPack(
  workspaceId: string,
  sourcePostId: string,
  targetPlatforms: SocialPlatform[],
  supabaseClient?: SupabaseClient
): Promise<RepurposedPack> {
  const supabase = supabaseClient || getSupabaseServerClient();
  const startTime = Date.now();

  await logInfo("repurpose_start", {
    workspace_id: workspaceId,
    source_post_id: sourcePostId,
    target_platforms: targetPlatforms,
  });

  // Fetch source post
  const { data: sourcePost, error: postError } = await supabase
    .from("studio_social_posts")
    .select(`
      id,
      platform,
      caption,
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
    .eq("id", sourcePostId)
    .eq("workspace_id", workspaceId)
    .single();

  if (postError || !sourcePost) {
    await logError("repurpose_source_not_found", {
      workspace_id: workspaceId,
      source_post_id: sourcePostId,
      error: postError?.message,
    });
    throw new MissingDataError("Source post", {
      workspaceId,
      resourceId: sourcePostId,
    });
  }

  // Get latest metrics
  const metricsArray = sourcePost.studio_social_post_metrics as any[];
  const latestMetrics = metricsArray && metricsArray.length > 0
    ? metricsArray.sort((a, b) => 
        new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      )[0]
    : null;

  // Calculate engagement rate if metrics available
  let engagementRate: number | undefined;
  let isHighPerforming = false;
  
  if (latestMetrics) {
    const engagement = (latestMetrics.likes || 0) + (latestMetrics.comments || 0) + 
                      (latestMetrics.shares || 0) + (latestMetrics.saves || 0);
    const denominator = sourcePost.platform === "tiktok"
      ? (latestMetrics.views || 0)
      : (latestMetrics.impressions || 0);
    
    if (denominator > 0) {
      engagementRate = (engagement / denominator) * 100;
      // Consider high performing if engagement rate > 3%
      isHighPerforming = engagementRate > 3;
    }
  }

  // Get brand profile
  const brandProfile = await getBrandProfile(workspaceId, supabase);
  const brandProfileText = formatBrandProfileForPrompt(brandProfile);

  // Get user preferences
  const { summarizeWorkspacePreferences, formatPreferencesForPrompt } = await import("./personalization-service");
  const preferences = await summarizeWorkspacePreferences(workspaceId, supabase);
  const preferencesText = formatPreferencesForPrompt(preferences);

  // Get top-performing hashtags
  const topHashtags = await getTopHashtagsForSuggestions(workspaceId, 15, 30, supabase);

  // Build context
  const context: RepurposingContext = {
    source_caption: sourcePost.caption || "",
    source_platform: sourcePost.platform as SocialPlatform,
    source_metrics: latestMetrics ? {
      impressions: latestMetrics.impressions,
      views: latestMetrics.views,
      likes: latestMetrics.likes,
      comments: latestMetrics.comments,
      shares: latestMetrics.shares,
      saves: latestMetrics.saves,
      engagement_rate: engagementRate,
    } : undefined,
    is_high_performing: isHighPerforming,
    brand_profile: brandProfileText || undefined,
  };

  // Build LLM prompt
  const systemPrompt = `You are a social media content repurposing specialist. Your job is to adapt content from one platform to others while:
1. Preserving the core message and value
2. Optimizing for each platform's format and audience
3. Maintaining brand voice and tone
4. Adapting length and style to platform best practices

Platform-specific guidelines:
- Instagram: Visual-first, caption up to 2,200 chars, use hashtags (5-10), engaging hooks
- TikTok: Video-first, short captions (100-150 chars), trending hooks, clear CTA
- Facebook: Conversational, longer captions (up to 5,000 chars), community-focused
- X (Twitter): Concise (280 chars), punchy hooks, thread-friendly
- LinkedIn: Professional, value-focused, longer form (up to 3,000 chars), industry insights

Return a JSON object with platform-specific content for each requested platform.`;

  const userPrompt = `Repurpose this content for the following platforms: ${targetPlatforms.join(", ")}.

Source Post:
Platform: ${context.source_platform}
Caption: ${context.source_caption}

${context.is_high_performing && context.source_metrics ? `
⚠️ HIGH-PERFORMING POST: This post has an engagement rate of ${context.engagement_rate?.toFixed(1)}%.
Preserve the core message and key elements that made it successful.
` : ""}

        ${context.brand_profile ? `
        Brand Profile:
        ${context.brand_profile}
        ` : ""}

        ${preferencesText ? `
        User Preferences:
        ${preferencesText}
        Adapt repurposed content to match these preferences when possible.
        ` : ""}

${topHashtags.length > 0 ? `
Top-Performing Hashtags (consider using 3-5 relevant ones):
${topHashtags.map((h, i) => `${i + 1}. #${h.name} (engagement: ${h.engagement_rate}%, used ${h.usage_count} times)`).join("\n")}
` : ""}

${context.source_metrics ? `
Performance Metrics:
- Likes: ${context.source_metrics.likes || 0}
- Comments: ${context.source_metrics.comments || 0}
- Shares: ${context.source_metrics.shares || 0}
- Engagement Rate: ${context.engagement_rate?.toFixed(1) || "N/A"}%
` : ""}

For each platform, generate:
- hook: Engaging opening line (first 1-2 sentences)
- caption/script: Full platform-optimized content
- cta: Clear call-to-action
- hashtags: 5-10 relevant hashtags
- suggested_media_type: Best format for this platform
- notes: Any platform-specific considerations

Return JSON in this format:
{
  "instagram": {
    "caption": "Full Instagram caption...",
    "hook": "Opening hook...",
    "cta": "Call to action...",
    "hashtags": ["#tag1", "#tag2"],
    "suggested_media_type": "image",
    "notes": "Instagram-specific notes"
  },
  "tiktok": {
    "script": "Video script for TikTok...",
    "hook": "Hook for first 3 seconds...",
    "cta": "CTA...",
    "hashtags": ["#trending", "#fyp"],
    "suggested_media_type": "video",
    "notes": "TikTok-specific notes"
  }
  // ... other platforms
}`;

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
      response_format: { type: "json_object" },
      temperature: 0.7, // Balanced creativity and consistency
    });
  } catch (error: any) {
    await logError("repurpose_llm_error", {
      workspace_id: workspaceId,
      source_post_id: sourcePostId,
      target_platforms: targetPlatforms,
      error: error.message,
    });
    throw new LLMOutputError("Failed to generate repurposed content", {
      workspaceId,
      metadata: { sourcePostId, targetPlatforms },
      cause: error,
    });
  }

  const llmDurationMs = Date.now() - llmStartTime;
  await logInfo("repurpose_llm_call", {
    workspace_id: workspaceId,
    source_post_id: sourcePostId,
    target_platforms: targetPlatforms,
    duration_ms: llmDurationMs,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    await logError("repurpose_no_llm_content", {
      workspace_id: workspaceId,
      source_post_id: sourcePostId,
    });
    throw new LLMOutputError("No content returned from LLM", {
      workspaceId,
      metadata: { sourcePostId },
    });
  }

  // Parse response
  let pack: RepurposedPack;
  try {
    const parsed = JSON.parse(content);
    pack = parsed as RepurposedPack;
  } catch (error: any) {
    await logError("repurpose_parse_error", {
      workspace_id: workspaceId,
      source_post_id: sourcePostId,
      raw_output: content.substring(0, 500), // Log first 500 chars
      error: error.message,
    });
    throw new LLMOutputError("Invalid JSON response from LLM", {
      workspaceId,
      rawOutput: content,
      expectedFormat: "JSON object with platform keys",
      metadata: { sourcePostId },
      cause: error,
    });
  }

  const durationMs = Date.now() - startTime;
  await logInfo("repurpose_success", {
    workspace_id: workspaceId,
    source_post_id: sourcePostId,
    target_platforms: targetPlatforms,
    platforms_generated: Object.keys(pack).length,
    duration_ms: durationMs,
  });

  // Validate that we have content for requested platforms
  for (const platform of targetPlatforms) {
    if (!pack[platform as keyof RepurposedPack]) {
      console.warn(`No content generated for platform: ${platform}`);
    }
  }

  return pack;
}

