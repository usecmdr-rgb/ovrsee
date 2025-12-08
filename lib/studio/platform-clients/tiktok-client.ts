/**
 * TikTok Platform Client
 * 
 * Provides a clean abstraction for TikTok Content Publishing API operations.
 */

import { getPlatformConfig } from "./config";
import { getPlatformAPI, postPlatformAPI, putPlatformAPI } from "./http-helper";
import type { PublishPostOptions, PublishPostResult, PostMetrics, AccountHealth } from "./types";

const config = getPlatformConfig();

export interface TikTokClientContext {
  workspaceId: string;
  accessToken: string;
  openId: string;
}

/**
 * Publish a post to TikTok
 * 
 * TikTok requires a three-step process:
 * 1. Initialize upload (get upload URL and publish ID)
 * 2. Upload video chunks
 * 3. Publish
 * 
 * Note: TikTok only supports video posts.
 */
export async function publishPost(
  options: PublishPostOptions,
  context: TikTokClientContext
): Promise<PublishPostResult> {
  const { caption, mediaUrl, mediaType, accessToken, workspaceId } = {
    ...options,
    ...context,
  };

  if (mediaType !== "video") {
    return {
      success: false,
      error: "TikTok only supports video posts",
      retryable: false,
    };
  }

  try {
    // Step 1: Initialize upload
    const initResponse = await postPlatformAPI<{
      data?: {
        upload_url?: string;
        publish_id?: string;
      };
    }>(
      "tiktok",
      "/post/publish/video/init/",
      accessToken,
      {
        post_info: {
          title: caption || "Posted via OVRSEE Studio",
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: "FILE_UPLOAD",
        },
      },
      {
        workspaceId,
        baseUrl: config.tiktok.baseUrl,
        apiVersion: config.tiktok.apiVersion,
      }
    );

    if (!initResponse.ok || !initResponse.data?.data?.upload_url || !initResponse.data?.data?.publish_id) {
      return {
        success: false,
        error: initResponse.error || "Failed to initialize TikTok upload",
        retryable: initResponse.status >= 500,
      };
    }

    const { upload_url, publish_id } = initResponse.data.data;

    // Step 2: Upload video
    // Fetch the video file from mediaUrl
    const videoResponse = await fetch(mediaUrl);
    if (!videoResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch video from ${mediaUrl}`,
        retryable: true,
      };
    }

    const videoBlob = await videoResponse.blob();
    
    // Upload to TikTok's upload URL (this is a direct PUT, not via our helper)
    const uploadStartTime = Date.now();
    const uploadResponse = await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
      },
      body: videoBlob,
    });

    const uploadDurationMs = Date.now() - uploadStartTime;

    // Log the upload (manual logging since it's not via our helper)
    const errorText = uploadResponse.ok ? undefined : await uploadResponse.text().catch(() => "Unknown error");
    await import("@/lib/studio/logging").then(({ logPlatformAPICall }) =>
      logPlatformAPICall(
        workspaceId,
        "tiktok",
        "/post/publish/video/upload",
        "PUT",
        uploadResponse.ok,
        uploadResponse.status,
        errorText,
        uploadDurationMs
      )
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      return {
        success: false,
        error: `Failed to upload video to TikTok: ${errorText}`,
        retryable: uploadResponse.status >= 500 || uploadResponse.status === 429,
      };
    }

    // Step 3: Publish
    const publishResponse = await postPlatformAPI<{
      data?: {
        video_id?: string;
      };
    }>(
      "tiktok",
      "/post/publish/video/publish/",
      accessToken,
      {
        publish_id: publish_id,
      },
      {
        workspaceId,
        baseUrl: config.tiktok.baseUrl,
        apiVersion: config.tiktok.apiVersion,
      }
    );

    if (!publishResponse.ok || !publishResponse.data?.data?.video_id) {
      return {
        success: false,
        error: publishResponse.error || "Failed to publish TikTok video",
        retryable: publishResponse.status >= 500,
      };
    }

    const platformPostId = publishResponse.data.data.video_id;

    // TikTok doesn't provide a direct permalink in the response
    // We'll construct it or fetch it separately if needed
    const postUrl = `https://www.tiktok.com/@username/video/${platformPostId}`;

    return {
      success: true,
      platformPostId,
      postUrl,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error publishing to TikTok",
      retryable: error.retryable !== false,
    };
  }
}

/**
 * Fetch metrics for a TikTok post
 */
export async function fetchPostMetrics(
  platformPostId: string,
  context: TikTokClientContext
): Promise<PostMetrics> {
  const { accessToken, workspaceId } = context;

  try {
    // TikTok Research API endpoint for video metrics
    const response = await postPlatformAPI<{
      data?: {
        videos?: Array<{
          video_id: string;
          view_count?: number;
          like_count?: number;
          comment_count?: number;
          share_count?: number;
          play_count?: number;
        }>;
      };
    }>(
      "tiktok",
      "/research/video/query/",
      accessToken,
      {
        query: {
          and: [
            {
              operation: "IN",
              field_name: "video_id",
              field_values: [platformPostId],
            },
          ],
        },
        fields: [
          "view_count",
          "like_count",
          "comment_count",
          "share_count",
          "play_count",
        ],
      },
      {
        workspaceId,
        baseUrl: config.tiktok.baseUrl,
        apiVersion: config.tiktok.apiVersion,
      }
    );

    if (!response.ok || !response.data?.data?.videos || response.data.data.videos.length === 0) {
      // Metrics might not be available, return empty metrics
      return {};
    }

    const video = response.data.data.videos[0];
    return {
      views: video.view_count || video.play_count,
      likes: video.like_count,
      comments: video.comment_count,
      shares: video.share_count,
      metadata: video,
    };
  } catch (error: any) {
    // If metrics are not available, return empty metrics
    if (error.statusCode === 400 || error.statusCode === 403) {
      return {};
    }
    throw error;
  }
}

/**
 * Check TikTok account health
 * Makes a lightweight API call to verify token and permissions
 */
export async function checkAccountHealth(
  context: TikTokClientContext
): Promise<AccountHealth> {
  const { accessToken, workspaceId } = context;

  try {
    const response = await getPlatformAPI<{
      data?: {
        user?: {
          open_id: string;
          display_name?: string;
          username?: string;
        };
      };
    }>(
      "tiktok",
      "/user/info/",
      accessToken,
      {
        workspaceId,
        baseUrl: config.tiktok.baseUrl,
        apiVersion: config.tiktok.apiVersion,
      },
      { fields: "open_id,display_name,username" }
    );

    if (!response.ok || !response.data?.data?.user) {
      return {
        healthy: false,
        error: response.error || "Failed to verify TikTok account",
      };
    }

    const user = response.data.data.user;
    return {
      healthy: true,
      accountId: user.open_id,
      accountName: user.username || user.display_name,
    };
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message || "Unknown error checking TikTok account health",
    };
  }
}

