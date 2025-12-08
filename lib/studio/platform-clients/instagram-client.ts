/**
 * Instagram Platform Client
 * 
 * Provides a clean abstraction for Instagram Business API operations.
 * Uses Facebook Graph API (Instagram is part of Facebook's platform).
 */

import { getPlatformConfig } from "./config";
import { getPlatformAPI, postPlatformAPI, callPlatformAPI } from "./http-helper";
import type { PublishPostOptions, PublishPostResult, PostMetrics, AccountHealth } from "./types";
import { MissingDataError } from "@/lib/studio/errors";

const config = getPlatformConfig();

export interface InstagramClientContext {
  workspaceId: string;
  accessToken: string;
  igBusinessId: string;
}

/**
 * Publish a post to Instagram
 * 
 * Instagram requires a two-step process:
 * 1. Create a media container
 * 2. Publish the container
 * 
 * For videos, we also need to poll for processing completion.
 */
export async function publishPost(
  options: PublishPostOptions,
  context: InstagramClientContext
): Promise<PublishPostResult> {
  const { caption, mediaUrl, mediaType, igBusinessId, accessToken, workspaceId } = {
    ...options,
    ...context,
  };

  try {
    // Step 1: Create media container
    const containerParams: Record<string, string> = {
      caption: caption || "",
    };

    if (mediaType === "image") {
      containerParams.image_url = mediaUrl;
    } else {
      containerParams.media_type = "REELS";
      containerParams.video_url = mediaUrl;
    }

    // Instagram container creation uses POST with query params, not JSON body
    const containerResponse = await callPlatformAPI<{ id: string }>(
      "instagram",
      {
        method: "POST",
        path: `/${igBusinessId}/media`,
        accessToken,
        params: containerParams,
      },
      {
        workspaceId,
        baseUrl: config.instagram.baseUrl,
        apiVersion: config.instagram.apiVersion,
      }
    );

    if (!containerResponse.ok || !containerResponse.data?.id) {
      return {
        success: false,
        error: containerResponse.error || "Failed to create Instagram media container",
        retryable: containerResponse.status >= 500,
      };
    }

    const containerId = containerResponse.data.id;

    // Step 2: For videos, poll for processing completion
    if (mediaType === "video") {
      let status = "IN_PROGRESS";
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max wait

      while (status === "IN_PROGRESS" && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

        const statusResponse = await getPlatformAPI<{ status_code: string }>(
          "instagram",
          `/${containerId}`,
          accessToken,
          {
            workspaceId,
            baseUrl: config.instagram.baseUrl,
            apiVersion: config.instagram.apiVersion,
          },
          { fields: "status_code" }
        );

        if (statusResponse.ok && statusResponse.data) {
          status = statusResponse.data.status_code;
        }

        attempts++;
      }

      if (status !== "FINISHED") {
        return {
          success: false,
          error: `Instagram video processing timeout or failed. Status: ${status}`,
          retryable: true,
        };
      }
    }

    // Step 3: Publish the container (uses query params, not JSON body)
    const publishResponse = await callPlatformAPI<{ id: string }>(
      "instagram",
      {
        method: "POST",
        path: `/${igBusinessId}/media_publish`,
        accessToken,
        params: { creation_id: containerId },
      },
      {
        workspaceId,
        baseUrl: config.instagram.baseUrl,
        apiVersion: config.instagram.apiVersion,
      }
    );

    if (!publishResponse.ok || !publishResponse.data?.id) {
      return {
        success: false,
        error: publishResponse.error || "Failed to publish Instagram post",
        retryable: publishResponse.status >= 500,
      };
    }

    const platformPostId = publishResponse.data.id;

    // Step 4: Get permalink
    let postUrl: string | undefined;
    try {
      const permalinkResponse = await getPlatformAPI<{ permalink: string }>(
        "instagram",
        `/${platformPostId}`,
        accessToken,
        {
          workspaceId,
          baseUrl: config.instagram.baseUrl,
          apiVersion: config.instagram.apiVersion,
        },
        { fields: "permalink" }
      );

      if (permalinkResponse.ok && permalinkResponse.data) {
        postUrl = permalinkResponse.data.permalink;
      }
    } catch (error) {
      // Permalink fetch failure is not critical
      console.warn("Failed to fetch Instagram permalink:", error);
    }

    return {
      success: true,
      platformPostId,
      postUrl,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error publishing to Instagram",
      retryable: error.retryable !== false,
    };
  }
}

/**
 * Fetch metrics for an Instagram post
 */
export async function fetchPostMetrics(
  platformPostId: string,
  context: InstagramClientContext
): Promise<PostMetrics> {
  const { accessToken, workspaceId } = context;

  try {
    const response = await getPlatformAPI<{
      data?: Array<{
        name: string;
        values?: Array<{ value: number }>;
      }>;
    }>(
      "instagram",
      `/${platformPostId}/insights`,
      accessToken,
      {
        workspaceId,
        baseUrl: config.instagram.baseUrl,
        apiVersion: config.instagram.apiVersion,
      },
      {
        metric: "impressions,reach,engagement,likes,saves,comments,shares",
      }
    );

    if (!response.ok || !response.data?.data) {
      // Some media might not have insights available (400), return empty metrics
      return {};
    }

    const metrics: PostMetrics = {};

    for (const metric of response.data.data) {
      const value = metric.values?.[0]?.value ?? 0;
      switch (metric.name) {
        case "impressions":
          metrics.impressions = value;
          break;
        case "reach":
          metrics.reach = value;
          break;
        case "engagement":
          metrics.engagement = value;
          break;
        case "likes":
          metrics.likes = value;
          break;
        case "saves":
          metrics.saves = value;
          break;
        case "comments":
          metrics.comments = value;
          break;
        case "shares":
          metrics.shares = value;
          break;
      }
    }

    return metrics;
  } catch (error: any) {
    // If it's a 400 (insights not available), return empty metrics
    if (error.statusCode === 400) {
      return {};
    }
    throw error;
  }
}

/**
 * Check Instagram account health
 * Makes a lightweight API call to verify token and permissions
 */
export async function checkAccountHealth(
  context: InstagramClientContext
): Promise<AccountHealth> {
  const { accessToken, igBusinessId, workspaceId } = context;

  try {
    const response = await getPlatformAPI<{
      id: string;
      username?: string;
      name?: string;
    }>(
      "instagram",
      `/${igBusinessId}`,
      accessToken,
      {
        workspaceId,
        baseUrl: config.instagram.baseUrl,
        apiVersion: config.instagram.apiVersion,
      },
      { fields: "id,username,name" }
    );

    if (!response.ok) {
      return {
        healthy: false,
        error: response.error || "Failed to verify Instagram account",
      };
    }

    return {
      healthy: true,
      accountId: response.data?.id,
      accountName: response.data?.username || response.data?.name,
    };
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message || "Unknown error checking Instagram account health",
    };
  }
}

