/**
 * Studio Repurpose API
 * 
 * POST /api/studio/repurpose
 * 
 * Repurposes a source post to target platforms, creating draft posts
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { generateRepurposedPack } from "@/lib/studio/repurposing-service";
import { upsertPostHashtags } from "@/lib/studio/hashtag-service";
import type { SocialPlatform } from "@/lib/studio/social-account-service";

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
    const { source_post_id, target_platforms, scheduled_for } = body;

    // Validation
    if (!source_post_id) {
      return NextResponse.json(
        { ok: false, error: "source_post_id is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (!target_platforms || !Array.isArray(target_platforms) || target_platforms.length === 0) {
      return NextResponse.json(
        { ok: false, error: "target_platforms array is required and must not be empty" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Validate platforms
    const validPlatforms: SocialPlatform[] = ["instagram", "tiktok", "facebook"];
    const invalidPlatforms = target_platforms.filter(
      (p: string) => !validPlatforms.includes(p as SocialPlatform)
    );

    if (invalidPlatforms.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Invalid platforms: ${invalidPlatforms.join(", ")}` },
        { status: 400, headers: responseHeaders }
      );
    }

    const supabase = getSupabaseServerClient();

    // Verify source post exists and belongs to workspace
    const { data: sourcePost, error: sourceError } = await supabase
      .from("studio_social_posts")
      .select("id, platform, caption, content_group_id")
      .eq("id", source_post_id)
      .eq("workspace_id", workspaceId)
      .single();

    if (sourceError || !sourcePost) {
      return NextResponse.json(
        { ok: false, error: "Source post not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Don't repurpose to the same platform
    const filteredPlatforms = target_platforms.filter(
      (p: SocialPlatform) => p !== sourcePost.platform
    );

    if (filteredPlatforms.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Cannot repurpose to the same platform as source" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Generate repurposed content pack
    const repurposedPack = await generateRepurposedPack(
      workspaceId,
      source_post_id,
      filteredPlatforms,
      supabase
    );

    // Get or create content_group_id
    let contentGroupId = sourcePost.content_group_id;
    if (!contentGroupId) {
      // Use source post ID as content group ID
      contentGroupId = source_post_id;
      // Update source post to have content_group_id
      await supabase
        .from("studio_social_posts")
        .update({ content_group_id: contentGroupId })
        .eq("id", source_post_id);
    }

    // Get connected social accounts for target platforms
    const { data: connectedAccounts } = await supabase
      .from("studio_social_accounts")
      .select("id, platform")
      .eq("workspace_id", workspaceId)
      .eq("status", "connected")
      .in("platform", filteredPlatforms);

    if (!connectedAccounts || connectedAccounts.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No connected accounts found for target platforms" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Create draft posts for each platform
    const createdPosts: Array<{
      id: string;
      platform: SocialPlatform;
      caption: string;
    }> = [];
    const errors: string[] = [];

    for (const platform of filteredPlatforms) {
      const platformContent = repurposedPack[platform as keyof typeof repurposedPack];
      if (!platformContent) {
        errors.push(`No content generated for ${platform}`);
        continue;
      }

      // Find social account for this platform
      const socialAccount = connectedAccounts.find((a) => a.platform === platform);
      if (!socialAccount) {
        errors.push(`No connected account for ${platform}`);
        continue;
      }

      // Determine caption/script
      const caption = platformContent.caption || platformContent.script || platformContent.hook;

      // Create draft post
      const { data: post, error: postError } = await supabase
        .from("studio_social_posts")
        .insert({
          workspace_id: workspaceId,
          social_account_id: socialAccount.id,
          platform: platform,
          caption: caption,
          repurposed_from_post_id: source_post_id,
          content_group_id: contentGroupId,
          status: "draft",
          scheduled_for: scheduled_for || null,
          metadata: {
            hook: platformContent.hook,
            cta: platformContent.cta,
            hashtags: platformContent.hashtags || [],
            suggested_media_type: platformContent.suggested_media_type || "image",
            notes: platformContent.notes,
            repurposed_from: source_post_id,
            source_platform: sourcePost.platform,
          },
          created_by: user.id,
        })
        .select("id, platform, caption")
        .single();

      if (postError || !post) {
        errors.push(`Failed to create ${platform} post: ${postError?.message || "unknown error"}`);
        continue;
      }

      createdPosts.push({
        id: post.id,
        platform: post.platform as SocialPlatform,
        caption: post.caption || "",
      });
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          source_post_id,
          content_group_id: contentGroupId,
          created_posts: createdPosts,
          repurposed_pack: repurposedPack,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in repurpose endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

