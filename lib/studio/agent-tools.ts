/**
 * Studio Agent Tools
 * 
 * Tool functions that the Studio Agent can call to perform operations.
 * These wrap existing API endpoints and services.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialPlatform } from "./social-account-service";
import { logInfo, logError } from "./logging";
import { InvalidInputError, MissingDataError } from "./errors";

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Create a draft post
 */
export async function createDraftPost(
  workspaceId: string,
  userId: string,
  args: {
    platform: SocialPlatform;
    caption: string;
    scheduled_for?: string;
    asset_id?: string;
    media_url?: string;
    media_type?: "image" | "video";
  },
  supabaseClient?: SupabaseClient
): Promise<ToolResult> {
  const supabase = supabaseClient || getSupabaseServerClient();
  const startTime = Date.now();

  try {
    await logInfo("tool_call_start", {
      workspace_id: workspaceId,
      user_id: userId,
      tool: "createDraftPost",
      args,
    });
    // Get social account for platform
    const { data: socialAccount, error: accountError } = await supabase
      .from("studio_social_accounts")
      .select("id, platform")
      .eq("workspace_id", workspaceId)
      .eq("platform", args.platform)
      .eq("status", "connected")
      .limit(1)
      .single();

    if (accountError || !socialAccount) {
      const result = {
        success: false,
        message: `No connected ${args.platform} account found. Please connect an account first.`,
        error: "NO_ACCOUNT",
      };
      await logToolCall(workspaceId, userId, "createDraftPost", args, result, Date.now() - startTime, supabase);
      return result;
    }

    // Validate scheduled_for if provided
    if (args.scheduled_for) {
      const scheduledDate = new Date(args.scheduled_for);
      const now = new Date();
      const maxFuture = new Date();
      maxFuture.setMonth(maxFuture.getMonth() + 3); // Max 3 months in future

      if (scheduledDate < now) {
        const result = {
          success: false,
          message: "Cannot schedule posts in the past",
          error: "INVALID_DATE",
        };
        await logToolCall(workspaceId, userId, "createDraftPost", args, result, Date.now() - startTime, supabase);
        return result;
      }

      if (scheduledDate > maxFuture) {
        const result = {
          success: false,
          message: "Cannot schedule posts more than 3 months in advance",
          error: "INVALID_DATE",
        };
        await logToolCall(workspaceId, userId, "createDraftPost", args, result, Date.now() - startTime, supabase);
        return result;
      }
    }

    // Create post
    const { data: post, error: postError } = await supabase
      .from("studio_social_posts")
      .insert({
        workspace_id: workspaceId,
        social_account_id: socialAccount.id,
        platform: args.platform,
        caption: args.caption,
        scheduled_for: args.scheduled_for || null,
        status: args.scheduled_for ? "scheduled" : "draft",
        asset_id: args.asset_id || null,
        metadata: {
          media_url: args.media_url || null,
          media_type: args.media_type || "image",
          created_by: userId,
        },
        created_by: userId,
      })
      .select("id, platform, caption, scheduled_for, status")
      .single();

    if (postError || !post) {
      const result = {
        success: false,
        message: `Failed to create post: ${postError?.message || "unknown error"}`,
        error: postError?.message,
      };
      await logToolCall(workspaceId, userId, "createDraftPost", args, result, Date.now() - startTime, supabase);
      return result;
    }

    // Parse and store hashtags
    const { upsertPostHashtags } = await import("./hashtag-service");
    try {
      await upsertPostHashtags(workspaceId, post.id, args.caption, supabase);
    } catch (hashtagError) {
      // Log but don't fail
      console.error("Failed to process hashtags:", hashtagError);
    }

    // Score the draft post (async, don't block)
    const { scoreDraftPost } = await import("./scoring-service");
    scoreDraftPost(workspaceId, post.id, {
      generateExplanation: false,
      supabaseClient: supabase,
    }).catch((scoreError) => {
      console.error(`Failed to score post ${post.id}:`, scoreError);
    });

    return {
      success: true,
      message: `Created ${args.scheduled_for ? "scheduled" : "draft"} post for ${args.platform}`,
      data: {
        post_id: post.id,
        platform: post.platform,
        status: post.status,
        scheduled_for: post.scheduled_for,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error creating post: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Schedule or reschedule a post
 */
export async function schedulePost(
  workspaceId: string,
  args: {
    post_id: string;
    scheduled_for: string;
  },
  supabaseClient?: SupabaseClient
): Promise<ToolResult> {
  const supabase = supabaseClient || getSupabaseServerClient();

  try {
    // Validate scheduled_for
    const scheduledDate = new Date(args.scheduled_for);
    const now = new Date();
    const maxFuture = new Date();
    maxFuture.setMonth(maxFuture.getMonth() + 3);

    if (scheduledDate < now) {
      return {
        success: false,
        message: "Cannot schedule posts in the past",
        error: "INVALID_DATE",
      };
    }

    if (scheduledDate > maxFuture) {
      return {
        success: false,
        message: "Cannot schedule posts more than 3 months in advance",
        error: "INVALID_DATE",
      };
    }

    // Verify post belongs to workspace
    const { data: existingPost, error: fetchError } = await supabase
      .from("studio_social_posts")
      .select("id, status")
      .eq("id", args.post_id)
      .eq("workspace_id", workspaceId)
      .single();

    if (fetchError || !existingPost) {
      return {
        success: false,
        message: "Post not found",
        error: "NOT_FOUND",
      };
    }

    // Update post
    const { data: updatedPost, error: updateError } = await supabase
      .from("studio_social_posts")
      .update({
        scheduled_for: scheduledDate.toISOString(),
        status: "scheduled",
      })
      .eq("id", args.post_id)
      .eq("workspace_id", workspaceId)
      .select("id, scheduled_for, status")
      .single();

    if (updateError || !updatedPost) {
      return {
        success: false,
        message: `Failed to schedule post: ${updateError?.message || "unknown error"}`,
        error: updateError?.message,
      };
    }

    return {
      success: true,
      message: `Post scheduled for ${scheduledDate.toLocaleString()}`,
      data: {
        post_id: updatedPost.id,
        scheduled_for: updatedPost.scheduled_for,
        status: updatedPost.status,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error scheduling post: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Move a post on the calendar (reschedule)
 */
export async function movePostOnCalendar(
  workspaceId: string,
  args: {
    post_id: string;
    new_date: string; // ISO date
  },
  supabaseClient?: SupabaseClient
): Promise<ToolResult> {
  const supabase = supabaseClient || getSupabaseServerClient();

  try {
    // Parse new_date and set to noon
    const newDate = new Date(args.new_date);
    newDate.setHours(12, 0, 0, 0);

    // Validate date range
    const now = new Date();
    const maxFuture = new Date();
    maxFuture.setMonth(maxFuture.getMonth() + 3);

    if (newDate < now) {
      return {
        success: false,
        message: "Cannot move posts to the past",
        error: "INVALID_DATE",
      };
    }

    if (newDate > maxFuture) {
      return {
        success: false,
        message: "Cannot schedule posts more than 3 months in advance",
        error: "INVALID_DATE",
      };
    }

    // Verify post belongs to workspace
    const { data: existingPost } = await supabase
      .from("studio_social_posts")
      .select("id, platform, caption")
      .eq("id", args.post_id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!existingPost) {
      return {
        success: false,
        message: "Post not found",
        error: "NOT_FOUND",
      };
    }

    // Update post
    const { data: updatedPost, error: updateError } = await supabase
      .from("studio_social_posts")
      .update({
        scheduled_for: newDate.toISOString(),
        status: "scheduled",
      })
      .eq("id", args.post_id)
      .eq("workspace_id", workspaceId)
      .select("id, scheduled_for, status")
      .single();

    if (updateError || !updatedPost) {
      return {
        success: false,
        message: `Failed to move post: ${updateError?.message || "unknown error"}`,
        error: updateError?.message,
      };
    }

    return {
      success: true,
      message: `Moved post to ${newDate.toLocaleDateString()}`,
      data: {
        post_id: updatedPost.id,
        scheduled_for: updatedPost.scheduled_for,
        status: updatedPost.status,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error moving post: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Repurpose a post to other platforms
 */
export async function repurposePost(
  workspaceId: string,
  userId: string,
  args: {
    source_post_id: string;
    target_platforms: SocialPlatform[];
    scheduled_for?: string;
  },
  supabaseClient?: SupabaseClient
): Promise<ToolResult> {
  const supabase = supabaseClient || getSupabaseServerClient();

  try {
    // Validate target platforms
    if (!args.target_platforms || args.target_platforms.length === 0) {
      return {
        success: false,
        message: "At least one target platform is required",
        error: "INVALID_INPUT",
      };
    }

    // Verify source post exists and belongs to workspace
    const { data: sourcePost } = await supabase
      .from("studio_social_posts")
      .select("id, platform, content_group_id")
      .eq("id", args.source_post_id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!sourcePost) {
      return {
        success: false,
        message: "Source post not found",
        error: "NOT_FOUND",
      };
    }

    // Filter out source platform
    const filteredPlatforms = args.target_platforms.filter((p) => p !== sourcePost.platform);
    if (filteredPlatforms.length === 0) {
      return {
        success: false,
        message: "Cannot repurpose to the same platform as source",
        error: "INVALID_INPUT",
      };
    }

    // Call repurposing service
    const { generateRepurposedPack } = await import("./repurposing-service");
    const repurposedPack = await generateRepurposedPack(
      workspaceId,
      args.source_post_id,
      filteredPlatforms,
      supabase
    );

    // Get content group ID
    let contentGroupId = sourcePost.content_group_id;
    if (!contentGroupId) {
      contentGroupId = args.source_post_id;
      await supabase
        .from("studio_social_posts")
        .update({ content_group_id: contentGroupId })
        .eq("id", args.source_post_id);
    }

    // Get connected accounts
    const { data: connectedAccounts } = await supabase
      .from("studio_social_accounts")
      .select("id, platform")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected")
      .in("platform", filteredPlatforms);

    if (!connectedAccounts || connectedAccounts.length === 0) {
      return {
        success: false,
        message: "No connected accounts found for target platforms",
        error: "NO_ACCOUNTS",
      };
    }

    // Create draft posts
    const createdPosts: Array<{ id: string; platform: SocialPlatform }> = [];
    const errors: string[] = [];

    for (const platform of filteredPlatforms) {
      const platformContent = repurposedPack[platform as keyof typeof repurposedPack];
      if (!platformContent) {
        errors.push(`No content generated for ${platform}`);
        continue;
      }

      const socialAccount = connectedAccounts.find((a) => a.platform === platform);
      if (!socialAccount) {
        errors.push(`No connected account for ${platform}`);
        continue;
      }

      const caption = platformContent.caption || platformContent.script || platformContent.hook;

      const { data: post, error: postError } = await supabase
        .from("studio_social_posts")
        .insert({
          workspace_id: workspaceId,
          social_account_id: socialAccount.id,
          platform: platform,
          caption: caption,
          repurposed_from_post_id: args.source_post_id,
          content_group_id: contentGroupId,
          status: "draft",
          scheduled_for: args.scheduled_for || null,
          metadata: {
            hook: platformContent.hook,
            cta: platformContent.cta,
            hashtags: platformContent.hashtags || [],
            repurposed_from: args.source_post_id,
          },
          created_by: userId,
        })
        .select("id, platform")
        .single();

      if (postError || !post) {
        errors.push(`Failed to create ${platform} post: ${postError?.message || "unknown error"}`);
        continue;
      }

      createdPosts.push({
        id: post.id,
        platform: post.platform as SocialPlatform,
      });

      // Parse hashtags
      const { upsertPostHashtags } = await import("./hashtag-service");
      try {
        await upsertPostHashtags(workspaceId, post.id, caption, supabase);
      } catch (hashtagError) {
        console.error("Failed to process hashtags:", hashtagError);
      }
    }

    if (createdPosts.length === 0) {
      return {
        success: false,
        message: `Failed to create any repurposed posts. Errors: ${errors.join(", ")}`,
        error: "CREATION_FAILED",
      };
    }

    return {
      success: true,
      message: `Repurposed post to ${createdPosts.length} platform(s): ${createdPosts.map((p) => p.platform).join(", ")}`,
      data: {
        created_posts: createdPosts,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error repurposing post: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Generate a weekly plan
 */
export async function generateWeeklyPlan(
  workspaceId: string,
  userId: string,
  args: {
    week_start?: string; // ISO date
    preferences?: {
      desired_cadence?: { instagram?: number; tiktok?: number; facebook?: number };
      preferred_days?: string[];
      preferred_times?: string[];
    };
  },
  supabaseClient?: SupabaseClient
): Promise<ToolResult> {
  const supabase = supabaseClient || getSupabaseServerClient();

  try {
    // Check for connected accounts
    const { data: connectedAccounts } = await supabase
      .from("studio_social_accounts")
      .select("id, platform")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected");

    if (!connectedAccounts || connectedAccounts.length === 0) {
      return {
        success: false,
        message: "No connected social accounts found. Please connect at least one account first.",
        error: "NO_ACCOUNTS",
      };
    }

    // Call weekly planner service
    const { generateWeeklyReport } = await import("./report-service");
    // Actually, we need to call the weekly planner endpoint logic
    // Let's import the service functions directly
    const { getBrandProfile, formatBrandProfileForPrompt } = await import("./brand-profile-service");
    const { computeMetricsSummary } = await import("./metrics-summary-service");
    const { getTopHashtagsForSuggestions } = await import("./hashtag-analytics-service");
    const { upsertPostHashtags } = await import("./hashtag-service");
    const { openai } = await import("@/lib/openai");
    const { AGENT_CONFIG } = await import("@/lib/agents/config");
    const { startOfWeek, endOfWeek, addWeeks, format } = await import("date-fns");

    // Determine week range
    let weekStartDate: Date;
    if (args.week_start) {
      weekStartDate = new Date(args.week_start);
      weekStartDate = startOfWeek(weekStartDate, { weekStartsOn: 1 });
    } else {
      const today = new Date();
      const thisWeekMonday = startOfWeek(today, { weekStartsOn: 1 });
      weekStartDate = today >= thisWeekMonday ? addWeeks(thisWeekMonday, 1) : thisWeekMonday;
    }

    const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 1 });
    const weekStartISO = format(weekStartDate, "yyyy-MM-dd");
    const weekEndISO = format(weekEndDate, "yyyy-MM-dd");

    // Check for existing posts (avoid duplicates)
    const { data: existingPosts } = await supabase
      .from("studio_social_posts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .gte("scheduled_for", weekStartDate.toISOString())
      .lte("scheduled_for", weekEndDate.toISOString());

    if (existingPosts && existingPosts.length > 0) {
      return {
        success: false,
        message: `Posts already exist for the week of ${weekStartISO}. Use avoid_duplicates=false to override.`,
        error: "DUPLICATE_WEEK",
      };
    }

    // Get context
    const brandProfile = await getBrandProfile(workspaceId, supabase);
    const brandProfileText = formatBrandProfileForPrompt(brandProfile);
    const metricsSummary = await computeMetricsSummary(workspaceId, 60, supabase);
    const topHashtags = await getTopHashtagsForSuggestions(workspaceId, 15, 30, supabase);

    const availablePlatforms = connectedAccounts.map((a) => a.platform);

    // Build LLM prompt (reuse logic from weekly planner)
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

${args.preferences ? `User Preferences:\n${JSON.stringify(args.preferences, null, 2)}` : ""}

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
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        message: "Failed to generate plan: No response from AI",
        error: "LLM_ERROR",
      };
    }

    // Parse plan
    const plan = JSON.parse(content);
    if (!plan.proposed_posts || !Array.isArray(plan.proposed_posts)) {
      return {
        success: false,
        message: "Invalid plan structure from AI",
        error: "INVALID_RESPONSE",
      };
    }

    // Create draft posts
    const createdPostIds: string[] = [];
    const errors: string[] = [];

    for (const proposedPost of plan.proposed_posts) {
      try {
        const targetPlatform = proposedPost.platforms[0] || availablePlatforms[0];
        const socialAccount = connectedAccounts.find((a) => a.platform === targetPlatform);

        if (!socialAccount) {
          errors.push(`No connected account for platform ${targetPlatform}`);
          continue;
        }

        const { data: post, error: postError } = await supabase
          .from("studio_social_posts")
          .insert({
            workspace_id: workspaceId,
            social_account_id: socialAccount.id,
            platform: targetPlatform,
            caption: proposedPost.caption || proposedPost.content_brief,
            scheduled_for: proposedPost.suggested_datetime,
            status: "draft",
            metadata: {
              idea_title: proposedPost.idea_title,
              content_brief: proposedPost.content_brief,
              suggested_media_type: proposedPost.suggested_media_type || "image",
              hashtags: proposedPost.hashtags || [],
              platforms: proposedPost.platforms,
              generated_by: "weekly_planner",
              plan_week_start: weekStartISO,
            },
            created_by: userId,
          })
          .select("id")
          .single();

        if (postError || !post) {
          errors.push(`Failed to create post "${proposedPost.idea_title}": ${postError?.message || "unknown error"}`);
          continue;
        }

        createdPostIds.push(post.id);

        // Parse hashtags
        try {
          await upsertPostHashtags(workspaceId, post.id, post.caption, supabase);
        } catch (hashtagError) {
          console.error("Failed to process hashtags:", hashtagError);
        }
      } catch (error: any) {
        errors.push(`Error creating post "${proposedPost.idea_title}": ${error.message}`);
      }
    }

    if (createdPostIds.length === 0) {
      return {
        success: false,
        message: `Failed to create any posts. Errors: ${errors.join(", ")}`,
        error: "CREATION_FAILED",
      };
    }

    return {
      success: true,
      message: `Generated weekly plan with ${createdPostIds.length} draft posts for ${weekStartISO} - ${weekEndISO}`,
      data: {
        week_start: weekStartISO,
        week_end: weekEndISO,
        created_post_ids: createdPostIds,
        total_posts: createdPostIds.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error generating weekly plan: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Create an A/B test experiment
 */
export async function createExperiment(
  workspaceId: string,
  userId: string,
  args: {
    name: string;
    type: "caption" | "hook" | "time" | "hashtags" | "media" | "other";
    description?: string;
    post_ids?: string[];
    base_post_id?: string;
    variant_specs?: Array<{ caption?: string; hook?: string }>;
  },
  supabaseClient?: SupabaseClient
): Promise<ToolResult> {
  const supabase = supabaseClient || getSupabaseServerClient();

  try {
    let postIds: string[] = [];

    // Option 1: If base_post_id + variant_specs, create variant posts
    if (args.base_post_id && args.variant_specs && args.variant_specs.length > 0) {
      // Verify base post exists and belongs to workspace
      const { data: basePost, error: baseError } = await supabase
        .from("studio_social_posts")
        .select("id, platform, caption, social_account_id, workspace_id")
        .eq("id", args.base_post_id)
        .eq("workspace_id", workspaceId)
        .single();

      if (baseError || !basePost) {
        return {
          success: false,
          message: "Base post not found",
          error: "NOT_FOUND",
        };
      }

      // Create variant posts
      const createdPostIds: string[] = [];
      for (const variantSpec of args.variant_specs) {
        // Extract hook from original caption if needed
        const originalCaption = basePost.caption || "";
        let newCaption = originalCaption;

        if (variantSpec.hook) {
          // Replace first line (hook) with new hook
          const lines = originalCaption.split("\n");
          if (lines.length > 1) {
            newCaption = variantSpec.hook + "\n" + lines.slice(1).join("\n");
          } else {
            newCaption = variantSpec.hook;
          }
        } else if (variantSpec.caption) {
          newCaption = variantSpec.caption;
        }

        // Create variant post
        const { data: variantPost, error: variantError } = await supabase
          .from("studio_social_posts")
          .insert({
            workspace_id: workspaceId,
            social_account_id: basePost.social_account_id,
            platform: basePost.platform,
            caption: newCaption,
            status: "draft",
            metadata: {
              created_by: userId,
              experiment_variant: true,
              base_post_id: args.base_post_id,
            },
            created_by: userId,
          })
          .select("id")
          .single();

        if (variantError || !variantPost) {
          return {
            success: false,
            message: `Failed to create variant post: ${variantError?.message || "unknown error"}`,
            error: variantError?.message,
          };
        }

        createdPostIds.push(variantPost.id);

        // Parse hashtags
        const { upsertPostHashtags } = await import("./hashtag-service");
        try {
          await upsertPostHashtags(workspaceId, variantPost.id, newCaption, supabase);
        } catch (hashtagError) {
          console.error("Failed to process hashtags:", hashtagError);
        }
      }

      // Include base post in experiment
      postIds = [args.base_post_id, ...createdPostIds];
    } else if (args.post_ids && args.post_ids.length >= 2) {
      // Option 2: Use provided post IDs directly
      postIds = args.post_ids;
    } else {
      return {
        success: false,
        message: "Either base_post_id + variant_specs or post_ids array (min 2) is required",
        error: "INVALID_INPUT",
      };
    }

    // Create experiment
    const { createExperiment: createExperimentService } = await import("./experiment-service");
    const experiment = await createExperimentService(
      workspaceId,
      userId,
      {
        name: args.name,
        type: args.type,
        description: args.description,
        post_ids: postIds,
      },
      supabase
    );

    return {
      success: true,
      message: `Created experiment "${experiment.name}" with ${postIds.length} variants`,
      data: {
        experiment_id: experiment.id,
        experiment_name: experiment.name,
        variant_count: postIds.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Error creating experiment: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Log tool call for auditing
 */
export async function logToolCall(
  workspaceId: string,
  userId: string,
  toolName: string,
  args: any,
  result: ToolResult,
  durationOrSupabase: number | SupabaseClient,
  supabaseClient?: SupabaseClient
): Promise<void> {
  // Handle both call patterns: with duration, or without
  let duration = 0;
  let client: SupabaseClient | undefined;
  
  if (typeof durationOrSupabase === 'number') {
    duration = durationOrSupabase;
    client = supabaseClient;
  } else {
    client = durationOrSupabase;
  }
  
  const supabase = client || getSupabaseServerClient();

  try {
    // Store in a tool_calls table or log to console
    // For now, just log to console
    console.log(`[Studio Agent Tool Call]`, {
      workspace_id: workspaceId,
      user_id: userId,
      tool: toolName,
      args,
      success: result.success,
      timestamp: new Date().toISOString(),
    });

    // TODO: Create a tool_calls table for proper auditing
    // await supabase.from("studio_agent_tool_calls").insert({
    //   workspace_id: workspaceId,
    //   user_id: userId,
    //   tool_name: toolName,
    //   args: args,
    //   success: result.success,
    //   error: result.error,
    // });
  } catch (error) {
    // Don't fail if logging fails
    console.error("Failed to log tool call:", error);
  }
}

