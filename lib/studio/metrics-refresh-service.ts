/**
 * Studio Metrics Refresh Service
 * 
 * Service for refreshing metrics for existing posts from social media platforms.
 * Handles rate limiting, batching, and error recovery.
 * Uses platform clients for platform-specific API calls.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getSocialAccount, ensureFreshAccessToken, type SocialPlatform } from "./social-account-service";
import { fetchPostMetrics as fetchInstagramMetrics } from "./platform-clients/instagram-client";
import { fetchPostMetrics as fetchFacebookMetrics } from "./platform-clients/facebook-client";
import { fetchPostMetrics as fetchTikTokMetrics } from "./platform-clients/tiktok-client";
import { logInfo, logWarn, logError } from "./logging";
import { TokenExpiredError, RateLimitError, PlatformAPIError } from "./errors";

const REFRESH_WINDOW_DAYS = 30; // Refresh metrics for posts from last 30 days
const BATCH_SIZE = 10; // Process posts in batches to avoid rate limits
const DELAY_BETWEEN_BATCHES_MS = 2000; // 2 seconds between batches
const DELAY_BETWEEN_REQUESTS_MS = 200; // 200ms between individual API requests

export interface RefreshResult {
  platform: SocialPlatform;
  workspaceId: string;
  postsProcessed: number;
  metricsUpdated: number;
  errors: string[];
}

/**
 * Refresh metrics for Instagram posts
 */
async function refreshInstagramMetrics(
  workspaceId: string,
  posts: Array<{ id: string; external_post_id: string }>
): Promise<{ updated: number; errors: string[] }> {
  const supabase = getSupabaseServerClient();
  
  await logInfo("metrics_refresh_start", {
    workspace_id: workspaceId,
    platform: "instagram",
    post_count: posts.length,
  });
  
  // Get account and ensure fresh token
  const account = await getSocialAccount(workspaceId, "instagram", {
    includeCredentials: false,
    supabaseClient: supabase,
  });

  if (!account || account.status !== "connected" || !account.external_account_id) {
    await logError("metrics_refresh_no_account", {
      workspace_id: workspaceId,
      platform: "instagram",
    });
    return { updated: 0, errors: ["Instagram account not connected"] };
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshAccessToken(account, supabase);
  } catch (error: any) {
    await logError("metrics_refresh_token_error", {
      workspace_id: workspaceId,
      platform: "instagram",
      error: error.message,
    });
    return { updated: 0, errors: [`Token error: ${error.message}`] };
  }

  let updated = 0;
  const errors: string[] = [];

  // Process in batches
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);

    for (const post of batch) {
      try {
        // Fetch metrics using platform client
        const metrics = await fetchInstagramMetrics(
          post.external_post_id,
          {
            workspaceId,
            accessToken,
            igBusinessId: account.external_account_id,
          }
        );

        if (Object.keys(metrics).length > 0) {
          // Insert new metrics record with current timestamp
          const { error: metricError } = await supabase
            .from("studio_social_post_metrics")
            .upsert(
              {
                social_post_id: post.id,
                captured_at: new Date().toISOString(),
                impressions: metrics.impressions || 0,
                views: 0, // Instagram doesn't have views
                likes: metrics.likes || 0,
                comments: metrics.comments || 0,
                shares: metrics.shares || 0,
                saves: metrics.saves || 0,
                metadata: metrics.metadata || metrics,
              },
              {
                onConflict: "social_post_id,captured_at",
              }
            );

          if (metricError) {
            errors.push(`Post ${post.id}: ${metricError.message}`);
          } else {
            updated++;
          }
        }

        // Rate limiting delay
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
      } catch (error: any) {
        if (error instanceof TokenExpiredError) {
          await logWarn("metrics_refresh_token_expired_during_refresh", {
            workspace_id: workspaceId,
            platform: "instagram",
            post_id: post.id,
          });
          errors.push("Instagram token expired during refresh");
          return { updated, errors };
        }
        if (error instanceof RateLimitError) {
          await logWarn("metrics_refresh_rate_limited", {
            workspace_id: workspaceId,
            platform: "instagram",
            post_id: post.id,
            retry_after: error.retryAfter,
          });
          errors.push(`Rate limited: ${error.message}`);
          // Continue with other posts
          continue;
        }
        await logError("metrics_refresh_post_error", {
          workspace_id: workspaceId,
          platform: "instagram",
          post_id: post.id,
          error: error.message,
        });
        errors.push(`Post ${post.id}: ${error.message || "Unknown error"}`);
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < posts.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  await logInfo("metrics_refresh_complete", {
    workspace_id: workspaceId,
    platform: "instagram",
    updated,
    errors_count: errors.length,
  });

  return { updated, errors };
}

/**
 * Refresh metrics for TikTok posts
 */
async function refreshTikTokMetrics(
  workspaceId: string,
  posts: Array<{ id: string; external_post_id: string }>
): Promise<{ updated: number; errors: string[] }> {
  const supabase = getSupabaseServerClient();
  
  await logInfo("metrics_refresh_start", {
    workspace_id: workspaceId,
    platform: "tiktok",
    post_count: posts.length,
  });

  // Get account and ensure fresh token
  const account = await getSocialAccount(workspaceId, "tiktok", {
    includeCredentials: false,
    supabaseClient: supabase,
  });

  if (!account || account.status !== "connected" || !account.external_account_id) {
    await logError("metrics_refresh_no_account", {
      workspace_id: workspaceId,
      platform: "tiktok",
    });
    return { updated: 0, errors: ["TikTok account not connected"] };
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshAccessToken(account, supabase);
  } catch (error: any) {
    await logError("metrics_refresh_token_error", {
      workspace_id: workspaceId,
      platform: "tiktok",
      error: error.message,
    });
    return { updated: 0, errors: [`Token error: ${error.message}`] };
  }

  let updated = 0;
  const errors: string[] = [];

  // Process in batches
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);

    for (const post of batch) {
      try {
        // Fetch metrics using platform client (one at a time for now)
        const metrics = await fetchTikTokMetrics(
          post.external_post_id,
          {
            workspaceId,
            accessToken,
            openId: account.external_account_id,
          }
        );

        if (Object.keys(metrics).length > 0) {
          const { error: metricError } = await supabase
            .from("studio_social_post_metrics")
            .upsert(
              {
                social_post_id: post.id,
                captured_at: new Date().toISOString(),
                impressions: 0, // TikTok doesn't have impressions
                views: metrics.views || 0,
                likes: metrics.likes || 0,
                comments: metrics.comments || 0,
                shares: metrics.shares || 0,
                saves: 0, // TikTok doesn't have saves
                metadata: metrics.metadata || metrics,
              },
              {
                onConflict: "social_post_id,captured_at",
              }
            );

          if (metricError) {
            errors.push(`Post ${post.id}: ${metricError.message}`);
          } else {
            updated++;
          }
        }

        // Rate limiting delay
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
      } catch (error: any) {
        if (error instanceof TokenExpiredError) {
          await logWarn("metrics_refresh_token_expired_during_refresh", {
            workspace_id: workspaceId,
            platform: "tiktok",
            post_id: post.id,
          });
          errors.push("TikTok token expired during refresh");
          return { updated, errors };
        }
        if (error instanceof RateLimitError) {
          await logWarn("metrics_refresh_rate_limited", {
            workspace_id: workspaceId,
            platform: "tiktok",
            post_id: post.id,
            retry_after: error.retryAfter,
          });
          errors.push(`Rate limited: ${error.message}`);
          continue;
        }
        await logError("metrics_refresh_post_error", {
          workspace_id: workspaceId,
          platform: "tiktok",
          post_id: post.id,
          error: error.message,
        });
        errors.push(`Post ${post.id}: ${error.message || "Unknown error"}`);
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < posts.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  await logInfo("metrics_refresh_complete", {
    workspace_id: workspaceId,
    platform: "tiktok",
    updated,
    errors_count: errors.length,
  });

  return { updated, errors };
}

/**
 * Refresh metrics for Facebook posts
 */
async function refreshFacebookMetrics(
  workspaceId: string,
  posts: Array<{ id: string; external_post_id: string }>
): Promise<{ updated: number; errors: string[] }> {
  const supabase = getSupabaseServerClient();
  
  await logInfo("metrics_refresh_start", {
    workspace_id: workspaceId,
    platform: "facebook",
    post_count: posts.length,
  });

  // Get account and ensure fresh token
  const account = await getSocialAccount(workspaceId, "facebook", {
    includeCredentials: false,
    supabaseClient: supabase,
  });

  if (!account || account.status !== "connected" || !account.external_account_id) {
    await logError("metrics_refresh_no_account", {
      workspace_id: workspaceId,
      platform: "facebook",
    });
    return { updated: 0, errors: ["Facebook account not connected"] };
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshAccessToken(account, supabase);
  } catch (error: any) {
    await logError("metrics_refresh_token_error", {
      workspace_id: workspaceId,
      platform: "facebook",
      error: error.message,
    });
    return { updated: 0, errors: [`Token error: ${error.message}`] };
  }

  let updated = 0;
  const errors: string[] = [];

  // Process in batches
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);

    for (const post of batch) {
      try {
        // Fetch metrics using platform client
        const metrics = await fetchFacebookMetrics(
          post.external_post_id,
          {
            workspaceId,
            accessToken,
            pageId: account.external_account_id,
          }
        );

        if (Object.keys(metrics).length > 0) {
          const { error: metricError } = await supabase
            .from("studio_social_post_metrics")
            .upsert(
              {
                social_post_id: post.id,
                captured_at: new Date().toISOString(),
                impressions: metrics.impressions || 0,
                views: 0, // Facebook doesn't have views in the same way
                likes: metrics.likes || 0,
                comments: metrics.comments || 0,
                shares: metrics.shares || 0,
                saves: 0,
                metadata: metrics.metadata || metrics,
              },
              {
                onConflict: "social_post_id,captured_at",
              }
            );

          if (metricError) {
            errors.push(`Post ${post.id}: ${metricError.message}`);
          } else {
            updated++;
          }
        }

        // Rate limiting delay
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
      } catch (error: any) {
        if (error instanceof TokenExpiredError) {
          await logWarn("metrics_refresh_token_expired_during_refresh", {
            workspace_id: workspaceId,
            platform: "facebook",
            post_id: post.id,
          });
          errors.push("Facebook token expired during refresh");
          return { updated, errors };
        }
        if (error instanceof RateLimitError) {
          await logWarn("metrics_refresh_rate_limited", {
            workspace_id: workspaceId,
            platform: "facebook",
            post_id: post.id,
            retry_after: error.retryAfter,
          });
          errors.push(`Rate limited: ${error.message}`);
          continue;
        }
        await logError("metrics_refresh_post_error", {
          workspace_id: workspaceId,
          platform: "facebook",
          post_id: post.id,
          error: error.message,
        });
        errors.push(`Post ${post.id}: ${error.message || "Unknown error"}`);
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < posts.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  await logInfo("metrics_refresh_complete", {
    workspace_id: workspaceId,
    platform: "facebook",
    updated,
    errors_count: errors.length,
  });

  return { updated, errors };
}

/**
 * Refresh metrics for all recent posts in a workspace
 */
export async function refreshWorkspaceMetrics(
  workspaceId: string
): Promise<RefreshResult[]> {
  const supabase = getSupabaseServerClient();
  const results: RefreshResult[] = [];

  // Calculate date threshold
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - REFRESH_WINDOW_DAYS);

  // Get all connected social accounts for this workspace
  const { data: accounts } = await supabase
    .from("studio_social_accounts")
    .select("id, platform, status")
    .eq("workspace_id", workspaceId)
    .eq("status", "connected");

  if (!accounts || accounts.length === 0) {
    return results;
  }

  // Process each platform
  for (const account of accounts) {
    const platform = account.platform as SocialPlatform;

    // Get recent posts for this platform
    const { data: posts } = await supabase
      .from("studio_social_posts")
      .select("id, external_post_id")
      .eq("workspace_id", workspaceId)
      .eq("platform", platform)
      .eq("social_account_id", account.id)
      .gte("posted_at", thresholdDate.toISOString())
      .not("external_post_id", "is", null)
      .order("posted_at", { ascending: false });

    if (!posts || posts.length === 0) {
      continue;
    }

    // Refresh metrics based on platform
    let updated = 0;
    let errors: string[] = [];

    if (platform === "instagram") {
      const result = await refreshInstagramMetrics(workspaceId, posts);
      updated = result.updated;
      errors = result.errors;
    } else if (platform === "tiktok") {
      const result = await refreshTikTokMetrics(workspaceId, posts);
      updated = result.updated;
      errors = result.errors;
    } else if (platform === "facebook") {
      const result = await refreshFacebookMetrics(workspaceId, posts);
      updated = result.updated;
      errors = result.errors;
    }

    results.push({
      platform,
      workspaceId,
      postsProcessed: posts.length,
      metricsUpdated: updated,
      errors,
    });
  }

  return results;
}

/**
 * Refresh metrics for all workspaces with connected accounts
 */
export async function refreshAllWorkspacesMetrics(): Promise<RefreshResult[]> {
  const supabase = getSupabaseServerClient();
  const allResults: RefreshResult[] = [];

  // Get all workspaces with connected social accounts
  const { data: workspaces } = await supabase
    .from("studio_social_accounts")
    .select("workspace_id")
    .eq("status", "connected")
    .not("workspace_id", "is", null);

  if (!workspaces || workspaces.length === 0) {
    return allResults;
  }

  // Get unique workspace IDs
  const uniqueWorkspaceIds = [...new Set(workspaces.map((w) => w.workspace_id))];

  // Process each workspace
  for (const workspaceId of uniqueWorkspaceIds) {
    try {
      const results = await refreshWorkspaceMetrics(workspaceId);
      allResults.push(...results);
    } catch (error: any) {
      console.error(`Error refreshing metrics for workspace ${workspaceId}:`, error);
      allResults.push({
        platform: "unknown" as SocialPlatform,
        workspaceId,
        postsProcessed: 0,
        metricsUpdated: 0,
        errors: [error.message || "Unknown error"],
      });
    }
  }

  return allResults;
}

