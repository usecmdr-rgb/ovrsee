/**
 * Studio Hashtag Suggestions API
 * 
 * POST /api/studio/hashtags/suggest
 * 
 * Returns AI-powered hashtag suggestions based on content brief and analytics
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getTopHashtagsForSuggestions } from "@/lib/studio/hashtag-analytics-service";
import { getBrandProfile, formatBrandProfileForPrompt } from "@/lib/studio/brand-profile-service";
import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";

export async function POST(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const body = await request.json();
    const { content_brief, platform, count = 10 } = body;

    if (!content_brief || typeof content_brief !== "string") {
      return NextResponse.json(
        { ok: false, error: "content_brief is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    const supabase = getSupabaseServerClient();

    // Get top-performing hashtags
    const topHashtags = await getTopHashtagsForSuggestions(workspaceId, 15, 30, supabase);

    // Get brand profile
    const brandProfile = await getBrandProfile(workspaceId, supabase);
    const brandProfileText = formatBrandProfileForPrompt(brandProfile);

    // Build LLM prompt
    const systemPrompt = `You are a social media hashtag strategist. Your job is to suggest relevant, effective hashtags for social media posts based on:
1. The content brief provided
2. Top-performing hashtags from the brand's history
3. Platform-specific best practices
4. Brand voice and target audience

Return a JSON array of hashtag strings (without # symbol).`;

    const userPrompt = `Suggest ${count} hashtags for this content:

Content Brief: ${content_brief}
Platform: ${platform || "instagram"}

${topHashtags.length > 0 ? `
Top-Performing Hashtags (from brand history):
${topHashtags.map((h, i) => `${i + 1}. #${h.name} (engagement: ${h.engagement_rate}%, used ${h.usage_count} times)`).join("\n")}

Guidance:
- Include 3-5 of the top-performing hashtags if they're relevant to this content
- Add 5-7 new, relevant hashtags that match the content brief
- Mix high-performing known tags with exploratory ones
` : ""}

${brandProfileText ? `
Brand Profile:
${brandProfileText}
` : ""}

Platform Guidelines:
- Instagram: 5-10 hashtags, mix of broad and niche
- TikTok: 3-5 hashtags, trending and niche
- Facebook: 1-3 hashtags, broad and relevant

Return JSON array: ["hashtag1", "hashtag2", ...]`;

    // Call LLM
    const completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.studio.primaryModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content from LLM");
    }

    // Parse response
    let suggestedHashtags: string[] = [];
    try {
      const parsed = JSON.parse(content);
      // Handle both { "hashtags": [...] } and { "suggestions": [...] } formats
      suggestedHashtags = parsed.hashtags || parsed.suggestions || parsed || [];
      
      // Ensure it's an array
      if (!Array.isArray(suggestedHashtags)) {
        suggestedHashtags = [];
      }

      // Normalize (remove # if present, lowercase)
      suggestedHashtags = suggestedHashtags
        .map((tag: string) => {
          if (typeof tag !== "string") return null;
          return tag.replace(/^#/, "").toLowerCase().trim();
        })
        .filter((tag: string | null): tag is string => !!tag && tag.length > 0)
        .slice(0, count);
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      // Fallback: return top hashtags if available
      suggestedHashtags = topHashtags.slice(0, count).map((h) => h.name);
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          suggested_hashtags: suggestedHashtags,
          top_performing_hashtags: topHashtags,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in hashtag suggestions endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

