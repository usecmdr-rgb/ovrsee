/**
 * Facebook Platform Client
 * 
 * Provides a clean abstraction for Facebook Graph API operations.
 */

import { getPlatformConfig } from "./config";
import { getPlatformAPI, callPlatformAPI } from "./http-helper";
import type { PublishPostOptions, PublishPostResult, PostMetrics, AccountHealth } from "./types";

const config = getPlatformConfig();

export interface FacebookClientContext {
  workspaceId: string;
  accessToken: string;
  pageId: string;
}

/**
 * Publish a post to Facebook
 * 
 * Facebook supports both photos and videos via simple POST endpoints.
 */
export async function publishPost(
  options: PublishPostOptions,
  context: FacebookClientContext
): Promise<PublishPostResult> {
  const { caption, mediaUrl, mediaType, pageId, accessToken, workspaceId } = {
    ...options,
    ...context,
  };

  try {
    const params: Record<string, string> = {
      message: caption || "",
    };

    let endpoint: string;
    if (mediaType === "image") {
      endpoint = `/${pageId}/photos`;
      params.url = mediaUrl;
    } else {
      endpoint = `/${pageId}/videos`;
      params.file_url = mediaUrl;
    }

    // Facebook uses POST with query params, not JSON body
    const response = await callPlatformAPI<{ id?: string; post_id?: string }>(
      "facebook",
      {
        method: "POST",
        path: endpoint,
        accessToken,
        params,
      },
      {
        workspaceId,
        baseUrl: config.facebook.baseUrl,
        apiVersion: config.facebook.apiVersion,
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: response.error || "Failed to publish to Facebook",
        retryable: response.status >= 500,
      };
    }

    const platformPostId = response.data?.id || response.data?.post_id;
    if (!platformPostId) {
      return {
        success: false,
        error: "Facebook did not return a post ID",
        retryable: false,
      };
    }

    // Construct post URL
    const postUrl = `https://www.facebook.com/${pageId}/posts/${platformPostId}`;

    return {
      success: true,
      platformPostId,
      postUrl,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error publishing to Facebook",
      retryable: error.retryable !== false,
    };
  }
}

/**
 * Fetch metrics for a Facebook post
 * 
 * Note: Facebook metrics require specific permissions and may not be available
 * for all post types. This is a placeholder implementation.
 */
export async function fetchPostMetrics(
  platformPostId: string,
  context: FacebookClientContext
): Promise<PostMetrics> {
  const { accessToken, workspaceId, pageId } = context;

  try {
    // Facebook insights endpoint
    const response = await getPlatformAPI<{
      data?: Array<{
        name: string;
        values?: Array<{ value: number }>;
      }>;
    }>(
      "facebook",
      `/${platformPostId}/insights`,
      accessToken,
      {
        workspaceId,
        baseUrl: config.facebook.baseUrl,
        apiVersion: config.facebook.apiVersion,
      },
      {
        metric: "post_impressions,post_reach,post_engaged_users,post_reactions_like_total,post_reactions_love_total,post_reactions_wow_total,post_reactions_haha_total,post_reactions_sorry_total,post_reactions_anger_total",
      }
    );

    if (!response.ok || !response.data?.data) {
      // Metrics might not be available, return empty metrics
      return {};
    }

    const metrics: PostMetrics = {};

    for (const metric of response.data.data) {
      const value = metric.values?.[0]?.value ?? 0;
      switch (metric.name) {
        case "post_impressions":
          metrics.impressions = value;
          break;
        case "post_reach":
          metrics.reach = value;
          break;
        case "post_engaged_users":
          metrics.engagement = value;
          break;
        case "post_reactions_like_total":
          metrics.likes = (metrics.likes || 0) + value;
          break;
        // Other reaction types could be aggregated
      }
    }

    return metrics;
  } catch (error: any) {
    // If metrics are not available, return empty metrics
    if (error.statusCode === 400 || error.statusCode === 403) {
      return {};
    }
    throw error;
  }
}

/**
 * Check Facebook account health
 * Makes a lightweight API call to verify token and permissions
 */
export async function checkAccountHealth(
  context: FacebookClientContext
): Promise<AccountHealth> {
  const { accessToken, pageId, workspaceId } = context;

  try {
    const response = await getPlatformAPI<{
      id: string;
      name?: string;
    }>(
      "facebook",
      `/${pageId}`,
      accessToken,
      {
        workspaceId,
        baseUrl: config.facebook.baseUrl,
        apiVersion: config.facebook.apiVersion,
      },
      { fields: "id,name" }
    );

    if (!response.ok) {
      return {
        healthy: false,
        error: response.error || "Failed to verify Facebook account",
      };
    }

    return {
      healthy: true,
      accountId: response.data?.id,
      accountName: response.data?.name,
    };
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message || "Unknown error checking Facebook account health",
    };
  }
}

