/**
 * Studio Ask API
 * 
 * POST /api/studio/ask
 * 
 * LLM-powered Studio agent for branding and content questions
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIdFromAuth, getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getMemoryFacts } from "@/lib/insight/memory";
import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";
import { generateStudioInsights } from "@/lib/studioInsights";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getBrandProfile, formatBrandProfileForPrompt } from "@/lib/studio/brand-profile-service";
import { getTopHashtagsForSuggestions } from "@/lib/studio/hashtag-analytics-service";
import type { SocialSummary } from "@/lib/social/summary";

export async function POST(request: NextRequest) {
  try {
    const { supabaseClient, user } = await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const supabase = getSupabaseServerClient();

    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Get brand profile (primary source of brand identity)
    const brandProfile = await getBrandProfile(workspaceId, supabase);
    const brandProfileText = formatBrandProfileForPrompt(brandProfile);

    // Get memory facts for additional brand information (fallback/legacy)
    const memoryFacts = await getMemoryFacts(workspaceId, 0.5);

    // Extract brand context from memory (for backwards compatibility)
    const brandContext: any = {};
    memoryFacts.forEach((fact) => {
      if (fact.key.includes("brand") || fact.key.includes("tone") || fact.key.includes("style")) {
        brandContext[fact.key] = fact.value;
      }
    });

    // Fetch recent studio assets (workspace-scoped)
    let recentAssets: any[] = [];
    try {
      const { data: assets } = await supabase
        .from("studio_assets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (assets) {
        recentAssets = assets;
      }
    } catch (e) {
      // Table might not exist
    }

    // Fetch social media summary if available (workspace-scoped)
    // Reuse logic from /api/studio/social/summary but inline to avoid HTTP call
    let socialSummary: SocialSummary | null = null;
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 90);

      const { data: posts } = await supabase
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

      if (posts && posts.length > 0) {
        // Quick aggregation (simplified version of summary endpoint logic)
        const instagramPosts = posts.filter((p) => p.platform === "instagram");
        const tiktokPosts = posts.filter((p) => p.platform === "tiktok");

        socialSummary = {};

        if (instagramPosts.length > 0) {
          const totals = { posts: instagramPosts.length, likes: 0, comments: 0, reach: 0, impressions: 0, saves: 0, shares: 0 };
          const topPosts: Array<{
            provider_media_id: string;
            caption_excerpt: string;
            metrics: Record<string, any>;
            taken_at: string;
            media_type?: string;
          }> = [];

          for (const post of instagramPosts.slice(0, 10)) {
            const metrics = Array.isArray(post.studio_social_post_metrics) && post.studio_social_post_metrics.length > 0
              ? post.studio_social_post_metrics[0]
              : null;
            totals.likes += metrics?.likes || 0;
            totals.comments += metrics?.comments || 0;
            totals.impressions += metrics?.impressions || 0;
            totals.saves += metrics?.saves || 0;
            totals.shares += metrics?.shares || 0;
            topPosts.push({
              provider_media_id: post.external_post_id,
              caption_excerpt: (post.caption || "").substring(0, 150),
              metrics: metrics || {},
              taken_at: post.posted_at || "",
            });
          }

          socialSummary.instagram = { totals, top_posts: topPosts, by_media_type: {} };
        }

        if (tiktokPosts.length > 0) {
          const totals = { posts: tiktokPosts.length, views: 0, likes: 0, comments: 0, shares: 0 };
          const topPosts: Array<{
            provider_media_id: string;
            caption_excerpt: string;
            metrics: Record<string, any>;
            taken_at: string;
            media_type?: string;
          }> = [];

          for (const post of tiktokPosts.slice(0, 10)) {
            const metrics = Array.isArray(post.studio_social_post_metrics) && post.studio_social_post_metrics.length > 0
              ? post.studio_social_post_metrics[0]
              : null;
            totals.views += metrics?.views || 0;
            totals.likes += metrics?.likes || 0;
            totals.comments += metrics?.comments || 0;
            totals.shares += metrics?.shares || 0;
            topPosts.push({
              provider_media_id: post.external_post_id,
              caption_excerpt: (post.caption || "").substring(0, 150),
              metrics: metrics || {},
              taken_at: post.posted_at || "",
            });
          }

          socialSummary.tiktok = { totals, top_posts: topPosts, by_media_type: {} };
        }

        // Only include if there's actual data
        if (
          (!socialSummary.instagram || Object.keys(socialSummary.instagram).length === 0) &&
          (!socialSummary.tiktok || Object.keys(socialSummary.tiktok).length === 0)
        ) {
          socialSummary = null;
        }
      }
    } catch (e) {
      // Social summary fetch failed, continue without it
      console.warn("Failed to fetch social summary:", e);
    }

    // Check if question is about social media performance
    const isSocialMediaQuestion =
      question.toLowerCase().includes("social") ||
      question.toLowerCase().includes("instagram") ||
      question.toLowerCase().includes("tiktok") ||
      question.toLowerCase().includes("facebook") ||
      question.toLowerCase().includes("engagement") ||
      question.toLowerCase().includes("performance") ||
      question.toLowerCase().includes("metrics") ||
      question.toLowerCase().includes("what works") ||
      question.toLowerCase().includes("what doesn't");

    // If it's a social media question and we have summary, use specialized helper
    if (isSocialMediaQuestion && socialSummary) {
      try {
        const insights = await generateStudioInsights(question, socialSummary);
        return NextResponse.json({
          ok: true,
          data: {
            answer: insights,
            suggestedAssets: [],
          },
        });
      } catch (error: any) {
        console.error("Error generating social insights:", error);
        // Fall through to regular flow
      }
    }

    // Build context
    const context = {
      brandProfile: brandProfileText,
      brandFacts: brandContext, // Legacy memory facts (for backwards compatibility)
      recentAssets: recentAssets.slice(0, 5).map((a) => ({
        name: a.name || a.filename,
        type: a.type,
        createdAt: a.created_at,
      })),
      ...(socialSummary && { socialMediaPerformance: socialSummary }),
    };

    // Generate answer using LLM
    const systemPrompt = `You are the Studio Agent, a branding and content intelligence coach. You help users understand their brand identity, maintain consistent tone and style, create effective content, and optimize their visual assets.

CRITICAL - BRAND PROFILE ADHERENCE:
You MUST strictly adhere to the Brand Profile provided below. All content suggestions, tone recommendations, and creative guidance MUST align with:
- The brand description and identity
- The target audience characteristics
- The voice and tone guidelines (style, formality, personality traits)
- Brand attributes (keywords, values, mission, tagline)

If no brand profile is configured, you may use general best practices, but always encourage the user to set up their brand profile for more personalized recommendations.

You have access to:
- Brand Profile (primary source - see below)
- Brand facts from memory (legacy/fallback)
- Recent content assets
${socialSummary ? "- Social media performance data (Instagram, TikTok)" : ""}

Brand Profile:
${brandProfileText}

Be creative, insightful, and brand-focused. When suggesting actions, format them as JSON with type and label. When suggesting assets, include relevant details.
${socialSummary ? "If social media performance data is available, use it to inform your recommendations about what content types and strategies are working." : ""}`;

    const userPrompt = `User question: ${question}

Context:
${JSON.stringify(context, null, 2)}

Provide a helpful answer and suggest 2-3 actionable next steps or content ideas. Return JSON with:
- answer: string
- suggestedAssets: array of {type: string, label: string, description?: string, tone?: string}`;

    const completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.studio.primaryModel, // Use gpt-4o for vision-capable branding/content tasks
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8, // Higher temperature for creative content
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content from LLM");
    }

    const parsed = JSON.parse(content);

    return NextResponse.json({
      ok: true,
      data: {
        answer: parsed.answer || "I couldn't generate an answer.",
        suggestedAssets: parsed.suggestedAssets || [],
      },
    });
  } catch (error: any) {
    console.error("Error in studio ask endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

