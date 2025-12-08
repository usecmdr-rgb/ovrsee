/**
 * Studio Publish Job Handler
 * 
 * POST /api/studio/publish/[postId]
 * 
 * Publishes a single post to its target platform.
 * Handles retries, error tracking, and status updates.
 * 
 * This endpoint is called by the scheduler cron job.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { publishPost } from "@/lib/studio/publish-service";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000; // 5 seconds base delay

export async function POST(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  const postId = params.postId;

  if (!postId) {
    return NextResponse.json(
      { ok: false, error: "Post ID is required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();

  try {
    // Fetch the post
    const { data: post, error: postError } = await supabase
      .from("studio_social_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { ok: false, error: "Post not found" },
        { status: 404 }
      );
    }

    // Check if already published (idempotency)
    if (post.status === "posted" && post.platform_post_id) {
      return NextResponse.json({
        ok: true,
        message: "Post already published",
        platformPostId: post.platform_post_id,
      });
    }

    // Check if post is in a valid state for publishing
    if (post.status !== "scheduled" && post.status !== "failed") {
      return NextResponse.json(
        {
          ok: false,
          error: `Post is in invalid state for publishing: ${post.status}`,
        },
        { status: 400 }
      );
    }

    // Check if scheduled_for time has passed (with 1 minute buffer)
    if (post.scheduled_for) {
      const scheduledTime = new Date(post.scheduled_for);
      const now = new Date();
      const bufferMs = 60 * 1000; // 1 minute buffer

      if (scheduledTime.getTime() > now.getTime() + bufferMs) {
        return NextResponse.json({
          ok: false,
          error: "Post is not yet ready to publish",
          scheduledFor: post.scheduled_for,
        });
      }
    }

    // Update status to "publishing"
    const { error: updateError } = await supabase
      .from("studio_social_posts")
      .update({
        status: "publishing",
        last_publish_attempt_at: new Date().toISOString(),
        last_publish_error: null,
      })
      .eq("id", postId);

    if (updateError) {
      console.error("Error updating post status:", updateError);
      return NextResponse.json(
        { ok: false, error: "Failed to update post status" },
        { status: 500 }
      );
    }

    // Get media URL from asset or metadata
    let mediaUrl: string | null = null;
    let mediaType: "image" | "video" = "image";

    if (post.asset_id) {
      // Fetch asset to get media URL
      const { data: asset } = await supabase
        .from("studio_assets")
        .select("file_url, file_type")
        .eq("id", post.asset_id)
        .single();

      if (asset) {
        mediaUrl = asset.file_url;
        mediaType = asset.file_type === "video" ? "video" : "image";
      }
    }

    // Fallback to metadata if asset not found
    if (!mediaUrl && post.metadata) {
      mediaUrl = post.metadata.media_url || post.metadata.file_url;
      mediaType = post.metadata.media_type === "video" ? "video" : "image";
    }

    if (!mediaUrl) {
      await supabase
        .from("studio_social_posts")
        .update({
          status: "failed",
          last_publish_error: "Media URL not found",
        })
        .eq("id", postId);

      return NextResponse.json(
        { ok: false, error: "Media URL not found" },
        { status: 400 }
      );
    }

    // Publish the post
    const publishResult = await publishPost({
      postId: post.id,
      workspaceId: post.workspace_id,
      platform: post.platform as "instagram" | "tiktok" | "facebook",
      caption: post.caption || "",
      mediaUrl,
      mediaType,
      assetId: post.asset_id || undefined,
    });

    // Update post based on result
    if (publishResult.success) {
      await supabase
        .from("studio_social_posts")
        .update({
          status: "posted",
          platform_post_id: publishResult.platformPostId,
          post_url: publishResult.postUrl,
          published_at: new Date().toISOString(),
          posted_at: new Date().toISOString(),
          last_publish_error: null,
        })
        .eq("id", postId);

      return NextResponse.json({
        ok: true,
        message: "Post published successfully",
        platformPostId: publishResult.platformPostId,
        postUrl: publishResult.postUrl,
      });
    } else {
      // Check if we should retry
      const retryCount = (post.metadata?.retry_count as number) || 0;
      const shouldRetry =
        publishResult.retryable &&
        retryCount < MAX_RETRY_ATTEMPTS;

      if (shouldRetry) {
        // Reset to scheduled for retry (with exponential backoff)
        const retryDelay = RETRY_DELAY_MS * Math.pow(2, retryCount);
        const retryAt = new Date(Date.now() + retryDelay);

        await supabase
          .from("studio_social_posts")
          .update({
            status: "scheduled",
            scheduled_for: retryAt.toISOString(),
            last_publish_error: publishResult.error,
            metadata: {
              ...post.metadata,
              retry_count: retryCount + 1,
            },
          })
          .eq("id", postId);

        return NextResponse.json({
          ok: false,
          error: publishResult.error,
          retryable: true,
          retryAt: retryAt.toISOString(),
          retryCount: retryCount + 1,
        });
      } else {
        // Mark as failed
        await supabase
          .from("studio_social_posts")
          .update({
            status: "failed",
            last_publish_error: publishResult.error,
          })
          .eq("id", postId);

        return NextResponse.json(
          {
            ok: false,
            error: publishResult.error,
            retryable: false,
          },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error("Error publishing post:", error);

    // Mark post as failed
    await supabase
      .from("studio_social_posts")
      .update({
        status: "failed",
        last_publish_error: error.message || "Unknown error",
      })
      .eq("id", postId);

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

