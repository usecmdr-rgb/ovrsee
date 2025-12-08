/**
 * TikTok Refresh API
 * 
 * POST /api/studio/social/tiktok/refresh
 * 
 * Fetches recent TikTok videos + metrics and stores them in studio_social_posts
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import {
  fetchTikTokVideosWithMetrics,
} from "@/lib/social/tiktok";
import {
  getSocialAccountCredentials,
  updateSocialAccountLastSync,
  isTokenExpired,
} from "@/lib/studio/social-account-service";

const MAX_VIDEOS_TO_SYNC = 20;

export async function POST(_req: NextRequest) {
  try {
    const { supabaseClient, user } = await getAuthenticatedSupabaseFromRequest(_req);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspace_not_found" },
        { status: 404 }
      );
    }

    const supabaseAdmin = getSupabaseServerClient();

    // Get workspace-scoped TikTok account with credentials
    const credentials = await getSocialAccountCredentials(
      workspaceId,
      "tiktok",
      supabaseAdmin
    );

    if (!credentials) {
      return NextResponse.json(
        { error: "tiktok_not_connected" },
        { status: 400 }
      );
    }

    // Check token expiry
    if (isTokenExpired(credentials.expires_at)) {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }

    // Get account to find external_account_id (TikTok open_id)
    const { data: account } = await supabaseAdmin
      .from("studio_social_accounts")
      .select("external_account_id")
      .eq("workspace_id", workspaceId)
      .eq("platform", "tiktok")
      .single();

    if (!account || !account.external_account_id) {
      return NextResponse.json(
        { error: "tiktok_not_connected" },
        { status: 400 }
      );
    }

    // Fetch videos with metrics
    const videosWithMetrics = await fetchTikTokVideosWithMetrics(
      credentials.access_token,
      account.external_account_id,
      MAX_VIDEOS_TO_SYNC
    );

    // Get social_account_id for this workspace/platform
    const { data: socialAccount } = await supabaseAdmin
      .from("studio_social_accounts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("platform", "tiktok")
      .single();

    if (!socialAccount) {
      return NextResponse.json(
        { error: "tiktok_not_connected" },
        { status: 400 }
      );
    }

    // Upsert each video into studio_social_posts (workspace-scoped)
    let syncedCount = 0;
    const errors: string[] = [];

    for (const video of videosWithMetrics) {
      try {
        const postedAt = video.create_time
          ? new Date(video.create_time * 1000).toISOString()
          : null;

        // Upsert post
        const { data: post, error: postError } = await supabaseAdmin
          .from("studio_social_posts")
          .upsert(
            {
              workspace_id: workspaceId,
              social_account_id: socialAccount.id,
              platform: "tiktok",
              external_post_id: video.video_id,
              caption: video.title || null,
              posted_at: postedAt,
              metadata: {
                video_url: video.video_url,
                cover_image_url: video.cover_image_url,
                share_url: video.share_url,
                duration: video.duration,
              },
            },
            {
              onConflict: "workspace_id,platform,external_post_id",
            }
          )
          .select()
          .single();

        if (postError || !post) {
          errors.push(`Failed to sync video ${video.video_id}: ${postError?.message || "unknown error"}`);
          continue;
        }

        // Upsert metrics
        if (video.metrics && Object.keys(video.metrics).length > 0) {
          const capturedAt = postedAt || new Date().toISOString();
          const { error: metricError } = await supabaseAdmin
            .from("studio_social_post_metrics")
            .upsert(
              {
                social_post_id: post.id,
                captured_at: capturedAt,
                impressions: 0, // TikTok doesn't have impressions
                views: video.metrics.views || video.metrics.play_count || 0,
                likes: video.metrics.likes || video.metrics.like_count || 0,
                comments: video.metrics.comments || video.metrics.comment_count || 0,
                shares: video.metrics.shares || video.metrics.share_count || 0,
                saves: 0, // TikTok doesn't have saves
                metadata: video.metrics,
              },
              {
                onConflict: "social_post_id,captured_at",
              }
            );

          if (metricError) {
            console.warn(`Failed to sync metrics for ${video.video_id}:`, metricError);
          }
        }

        syncedCount++;
      } catch (err: any) {
        errors.push(`Error processing ${video.video_id}: ${err.message}`);
      }
    }

    // Update last_sync_at
    await updateSocialAccountLastSync(workspaceId, "tiktok", supabaseAdmin);

    return NextResponse.json({
      ok: true,
      count: syncedCount,
      provider: "tiktok",
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Error in TikTok refresh endpoint:", error);

    if (error.message === "TOKEN_EXPIRED") {
      return NextResponse.json({ error: "token_expired" }, { status: 401 });
    }

    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

