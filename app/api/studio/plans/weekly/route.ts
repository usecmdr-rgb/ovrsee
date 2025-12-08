/**
 * Studio Weekly Planner API
 * 
 * POST /api/studio/plans/weekly
 * 
 * Generates an autonomous weekly content plan based on:
 * - Brand profile
 * - Recent performance metrics
 * - User preferences (optional)
 * 
 * Creates draft posts scheduled across the week.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getBrandProfile, formatBrandProfileForPrompt } from "@/lib/studio/brand-profile-service";
import { computeMetricsSummary } from "@/lib/studio/metrics-summary-service";
import { getTopHashtagsForSuggestions } from "@/lib/studio/hashtag-analytics-service";
import { getCompetitorSummary } from "@/lib/studio/competitor-service";
import { upsertPostHashtags } from "@/lib/studio/hashtag-service";
import { scoreDraftPost } from "@/lib/studio/scoring-service";
import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";
import type { WeeklyPlan, PlanPreferences, ProposedPost } from "@/lib/studio/weekly-plan-types";
import { startOfWeek, endOfWeek, addWeeks, format, parseISO } from "date-fns";

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
    const {
      week_start, // Optional: ISO date for week start (defaults to next Monday)
      preferences, // Optional: PlanPreferences
      avoid_duplicates = true, // Check for existing posts in same week
    } = body;

    const supabase = getSupabaseServerClient();

    // Determine week range
    let weekStartDate: Date;
    if (week_start) {
      weekStartDate = new Date(week_start);
      // Ensure it's the start of the week (Monday)
      weekStartDate = startOfWeek(weekStartDate, { weekStartsOn: 1 });
    } else {
      // Default to next Monday
      const today = new Date();
      const thisWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
      // If today is Monday or later this week, use next Monday
      if (today >= thisWeekMonday) {
        weekStartDate = addWeeks(thisWeekMonday, 1);
      } else {
        weekStartDate = thisWeekMonday;
      }
    }

    const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });
    const weekStartISO = format(weekStartDate, "yyyy-MM-dd");
            const weekEndISO = format(weekEndDate, "yyyy-MM-dd");

            // Validate campaign if provided
            let campaign: any = null;
            if (campaign_id) {
              const { data: campaignData, error: campaignError } = await supabase
                .from("studio_campaigns")
                .select("*")
                .eq("id", campaign_id)
                .eq("workspace_id", workspaceId)
                .single();

              if (campaignError || !campaignData) {
                return NextResponse.json(
                  { ok: false, error: "Campaign not found" },
                  { status: 404, headers: responseHeaders }
                );
              }

              campaign = campaignData;

              // Validate week falls within campaign dates
              const campaignStart = new Date(campaign.start_date);
              const campaignEnd = new Date(campaign.end_date);
              if (weekStartDate < campaignStart || weekEndDate > campaignEnd) {
                return NextResponse.json(
                  { ok: false, error: "Week must fall within campaign date range" },
                  { status: 400, headers: responseHeaders }
                );
              }
            }

            // Check for existing posts in this week (if avoid_duplicates)
    if (avoid_duplicates) {
      const { data: existingPosts } = await supabase
        .from("studio_social_posts")
        .select("id, scheduled_for")
        .eq("workspace_id", workspaceId)
        .gte("scheduled_for", weekStartDate.toISOString())
        .lte("scheduled_for", weekEndDate.toISOString());

      if (existingPosts && existingPosts.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Posts already exist for this week",
            existing_posts_count: existingPosts.length,
            week_start: weekStartISO,
            week_end: weekEndISO,
          },
          { status: 400, headers: responseHeaders }
        );
      }
    }

    // Get brand profile
    const brandProfile = await getBrandProfile(workspaceId, supabase);
    const brandProfileText = formatBrandProfileForPrompt(brandProfile);

    // Get metrics summary (last 60 days)
    const metricsSummary = await computeMetricsSummary(workspaceId, 60, supabase);

    // Get connected social accounts
    const { data: connectedAccounts } = await supabase
      .from("studio_social_accounts")
      .select("id, platform, handle")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected");

    if (!connectedAccounts || connectedAccounts.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No connected social accounts found. Please connect at least one account.",
        },
        { status: 400, headers: responseHeaders }
      );
    }

    const availablePlatforms = connectedAccounts.map((a) => a.platform);

    // Build LLM prompt
    const systemPrompt = `You are a social media content strategist and planner. Your job is to create a weekly content plan that:
1. Aligns with the brand's identity and voice
2. Learns from past performance data
3. Optimizes for engagement based on historical patterns
4. Provides variety in content types and themes
5. Schedules posts at optimal times based on performance data

You will be given:
- Brand profile (description, audience, voice, tone)
- Performance metrics summary (top posts, engagement rates, best posting times)
- User preferences (if provided)
- Available platforms

Generate a weekly plan with 5-15 posts distributed across the week, with specific suggestions for:
- Platform(s) for each post
- Suggested date and time
- Content idea/title
- Brief description of the content
- Optional starting caption/hook

Return a JSON object matching the WeeklyPlan schema.`;

    const userPrompt = `Create a weekly content plan for the week of ${weekStartISO} to ${weekEndISO}.

Brand Profile:
${brandProfileText || "No brand profile configured. Use general best practices."}

Performance Summary (Last ${metricsSummary.period_days} days):
${JSON.stringify(metricsSummary, null, 2)}

${topHashtags.length > 0 ? `
Top-Performing Hashtags (use 3-5 relevant ones per post):
${topHashtags.map((h, i) => `${i + 1}. #${h.name} (engagement: ${h.engagement_rate}%, used ${h.usage_count} times)`).join("\n")}
` : ""}

Available Platforms: ${availablePlatforms.join(", ")}

${preferencesText ? `${preferencesText}\n` : ""}
${preferences ? `User Preferences:\n${JSON.stringify(preferences, null, 2)}` : ""}

Requirements:
- Generate 5-15 posts for the week
- Distribute posts across available platforms
- Use best posting times from performance data when available
- Vary content types (images, videos, carousels)
- Align with brand voice and target audience
- Include engaging captions/hooks
- Consider posting frequency from performance data

Return JSON with this structure:
{
  "week_start": "${weekStartISO}",
  "week_end": "${weekEndISO}",
  "proposed_posts": [
    {
      "platforms": ["instagram"],
      "suggested_datetime": "2024-01-15T10:00:00Z",
      "idea_title": "Monday Motivation Post",
      "content_brief": "Inspirational quote with brand colors",
      "caption": "Start your week strong! 💪 [brand-specific message]",
      "suggested_media_type": "image",
      "hashtags": ["#motivation", "#monday"]
    }
  ],
  "plan_rationale": "Brief explanation of the plan strategy",
  "total_posts": 7,
  "posts_by_platform": {
    "instagram": 5,
    "tiktok": 2
  }
}`;

    // Call LLM
    const completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.studio.primaryModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8, // Higher temperature for creative content ideas
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content from LLM");
    }

    // Parse LLM response
    let plan: WeeklyPlan;
    try {
      const parsed = JSON.parse(content);
      plan = parsed as WeeklyPlan;
    } catch (error) {
      console.error("Failed to parse LLM response:", error);
      throw new Error("Invalid JSON response from LLM");
    }

    // Validate plan structure
    if (!plan.proposed_posts || !Array.isArray(plan.proposed_posts)) {
      throw new Error("Invalid plan structure: missing proposed_posts array");
    }

    // Create draft posts in database
    const createdPostIds: string[] = [];
    const errors: string[] = [];

    for (const proposedPost of plan.proposed_posts) {
      try {
        // Find social account for the first platform (or use first available)
        const targetPlatform = proposedPost.platforms[0] || availablePlatforms[0];
        const socialAccount = connectedAccounts.find((a) => a.platform === targetPlatform);

        if (!socialAccount) {
          errors.push(`No connected account for platform ${targetPlatform}`);
          continue;
        }

        // Create draft post
        const caption = proposedPost.caption || proposedPost.content_brief;
        const { data: post, error: postError } = await supabase
          .from("studio_social_posts")
          .insert({
            workspace_id: workspaceId,
            social_account_id: socialAccount.id,
            platform: targetPlatform,
            caption: caption,
            scheduled_for: proposedPost.suggested_datetime,
            status: "draft",
            campaign_id: campaign_id || null,
            metadata: {
              idea_title: proposedPost.idea_title,
              content_brief: proposedPost.content_brief,
              suggested_media_type: proposedPost.suggested_media_type || "image",
              hashtags: proposedPost.hashtags || [],
              platforms: proposedPost.platforms,
              generated_by: "weekly_planner",
              plan_week_start: weekStartISO,
              original_caption: caption, // Store original for edit tracking
            },
            created_by: user.id,
          })
          .select("id")
          .single();

        if (postError || !post) {
          errors.push(`Failed to create post "${proposedPost.idea_title}": ${postError?.message || "unknown error"}`);
          continue;
        }

        createdPostIds.push(post.id);

        // Parse and store hashtags from caption
        try {
          await upsertPostHashtags(workspaceId, post.id, post.caption, supabase);
        } catch (hashtagError) {
          // Log but don't fail the post creation
          console.error("Failed to process hashtags:", hashtagError);
        }
      } catch (error: any) {
        errors.push(`Error creating post "${proposedPost.idea_title}": ${error.message}`);
      }
    }

    // Update plan with created post IDs
    const planWithIds = {
      ...plan,
      created_post_ids: createdPostIds,
      errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(
      {
        ok: true,
        data: planWithIds,
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in weekly planner endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

