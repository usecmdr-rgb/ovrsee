/**
 * Studio Publishing Service
 * 
 * Handles publishing posts to Instagram, TikTok, and Facebook.
 * Uses platform clients for platform-specific API calls.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getSocialAccount, ensureFreshAccessToken, type SocialPlatform } from "./social-account-service";
import { logInfo, logError } from "./logging";
import { TokenExpiredError, PlatformAPIError, RateLimitError } from "./errors";
import { publishPost as publishInstagram } from "./platform-clients/instagram-client";
import { publishPost as publishFacebook } from "./platform-clients/facebook-client";
import { publishPost as publishTikTok } from "./platform-clients/tiktok-client";

export interface PublishPostData {
  postId: string;
  workspaceId: string;
  platform: SocialPlatform;
  caption: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  assetId?: string;
}

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  postUrl?: string;
  error?: string;
  retryable?: boolean; // true if error is transient and retry should be attempted
}

/**
 * Publish a post to the specified platform
 */
export async function publishPost(
  data: PublishPostData
): Promise<PublishResult> {
  const startTime = Date.now();
  const supabase = getSupabaseServerClient();
  
  await logInfo("publish_start", {
    workspace_id: data.workspaceId,
    post_id: data.postId,
    platform: data.platform,
    media_type: data.mediaType,
  });

  try {
    // Get social account
    const account = await getSocialAccount(data.workspaceId, data.platform, {
      includeCredentials: false,
      supabaseClient: supabase,
    });

    if (!account || account.status !== "connected") {
      return {
        success: false,
        error: `${data.platform} account not connected`,
        retryable: false,
      };
    }

    // Ensure fresh access token
    const accessToken = await ensureFreshAccessToken(account, supabase);

    // Get external account ID
    if (!account.external_account_id) {
      return {
        success: false,
        error: `${data.platform} account ID not found`,
        retryable: false,
      };
    }

    // Call appropriate platform client
    let result: PublishResult;

    switch (data.platform) {
      case "instagram":
        result = await publishInstagram(
          {
            caption: data.caption,
            mediaUrl: data.mediaUrl,
            mediaType: data.mediaType,
            workspaceId: data.workspaceId,
            externalAccountId: account.external_account_id,
          },
          {
            workspaceId: data.workspaceId,
            accessToken,
            igBusinessId: account.external_account_id,
          }
        );
        break;

      case "facebook":
        result = await publishFacebook(
          {
            caption: data.caption,
            mediaUrl: data.mediaUrl,
            mediaType: data.mediaType,
            workspaceId: data.workspaceId,
            externalAccountId: account.external_account_id,
          },
          {
            workspaceId: data.workspaceId,
            accessToken,
            pageId: account.external_account_id,
          }
        );
        break;

      case "tiktok":
        result = await publishTikTok(
          {
            caption: data.caption,
            mediaUrl: data.mediaUrl,
            mediaType: data.mediaType,
            workspaceId: data.workspaceId,
            externalAccountId: account.external_account_id,
          },
          {
            workspaceId: data.workspaceId,
            accessToken,
            openId: account.external_account_id,
          }
        );
        break;

      default:
        result = {
          success: false,
          error: `Unsupported platform: ${data.platform}`,
          retryable: false,
        };
    }

    const durationMs = Date.now() - startTime;

    if (result.success) {
      await logInfo("publish_success", {
        workspace_id: data.workspaceId,
        post_id: data.postId,
        platform: data.platform,
        platform_post_id: result.platformPostId,
        duration_ms: durationMs,
      });
    } else {
      await logError("publish_failed", {
        workspace_id: data.workspaceId,
        post_id: data.postId,
        platform: data.platform,
        error: result.error,
        retryable: result.retryable,
        duration_ms: durationMs,
      });
    }

    return result;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    
    // Handle typed errors
    if (error instanceof TokenExpiredError) {
      await logError("publish_token_expired", {
        workspace_id: data.workspaceId,
        post_id: data.postId,
        platform: data.platform,
        error: error.message,
        duration_ms: durationMs,
      });

      return {
        success: false,
        error: `Token expired for ${data.platform}. Please reconnect your account.`,
        retryable: false,
      };
    }

    if (error instanceof RateLimitError) {
      await logError("publish_rate_limited", {
        workspace_id: data.workspaceId,
        post_id: data.postId,
        platform: data.platform,
        error: error.message,
        retry_after: error.retryAfter,
        duration_ms: durationMs,
      });

      return {
        success: false,
        error: `Rate limit exceeded for ${data.platform}. Please try again later.`,
        retryable: true,
      };
    }

    if (error instanceof PlatformAPIError) {
      await logError("publish_platform_error", {
        workspace_id: data.workspaceId,
        post_id: data.postId,
        platform: data.platform,
        error: error.message,
        status_code: error.statusCode,
        retryable: error.retryable,
        duration_ms: durationMs,
      });

      return {
        success: false,
        error: error.message || `Failed to publish to ${data.platform}`,
        retryable: error.retryable,
      };
    }

    // Generic error
    await logError("publish_error", {
      workspace_id: data.workspaceId,
      post_id: data.postId,
      platform: data.platform,
      error: error.message,
      duration_ms: durationMs,
    });

    return {
      success: false,
      error: error.message || "Unknown error publishing post",
      retryable: true,
    };
  }
}

// Platform-specific publishing logic has been moved to platform clients:
// - lib/studio/platform-clients/instagram-client.ts
// - lib/studio/platform-clients/facebook-client.ts
// - lib/studio/platform-clients/tiktok-client.ts
