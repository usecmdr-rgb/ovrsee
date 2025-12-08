/**
 * Instagram Refresh API
 * 
 * POST /api/studio/social/instagram/refresh
 * 
 * Fetches recent Instagram media + insights and stores them in studio_social_posts
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import {
  getInstagramBusinessId,
  fetchInstagramMediaWithInsights,
} from "@/lib/social/instagram";
import {
  getSocialAccountCredentials,
  updateSocialAccountLastSync,
  isTokenExpired,
} from "@/lib/studio/social-account-service";

const MAX_POSTS_TO_SYNC = 25;

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

    // Get workspace-scoped Instagram account with credentials
    const credentials = await getSocialAccountCredentials(
      workspaceId,
      "instagram",
      supabaseAdmin
    );

    if (!credentials) {
      return NextResponse.json(
        { error: "instagram_not_connected" },
        { status: 400 }
      );
    }

    // Check token expiry
    if (isTokenExpired(credentials.expires_at)) {
      return NextResponse.json(
        { error: "token_expired" },
        { status: 401 }
      );
    }

    // Get account to find external_account_id (IG business ID)
    const { data: account } = await supabaseAdmin
      .from("studio_social_accounts")
      .select("external_account_id, metadata")
      .eq("workspace_id", workspaceId)
      .eq("platform", "instagram")
      .single();

    if (!account || !account.external_account_id) {
      return NextResponse.json(
        { error: "instagram_not_connected" },
        { status: 400 }
      );
    }

    const igBusinessId = account.external_account_id;

    // Fetch media with insights
    const mediaWithInsights = await fetchInstagramMediaWithInsights(
      credentials.access_token,
      igBusinessId,
      MAX_POSTS_TO_SYNC
    );

    // Get social_account_id for this workspace/platform
    const { data: socialAccount } = await supabaseAdmin
      .from("studio_social_accounts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("platform", "instagram")
      .single();

    if (!socialAccount) {
      return NextResponse.json(
        { error: "instagram_not_connected" },
        { status: 400 }
      );
    }

    // Upsert each post into studio_social_posts (workspace-scoped)
    let syncedCount = 0;
    const errors: string[] = [];

    for (const item of mediaWithInsights) {
      try {
        const postedAt = item.timestamp ? new Date(item.timestamp).toISOString() : null;

        // Upsert post
        const { data: post, error: postError } = await supabaseAdmin
          .from("studio_social_posts")
          .upsert(
            {
              workspace_id: workspaceId,
              social_account_id: socialAccount.id,
              platform: "instagram",
              external_post_id: item.id,
              caption: item.caption || null,
              posted_at: postedAt,
              metadata: {
                media_url: item.media_url,
                media_type: item.media_type,
                permalink: item.permalink,
              },
            },
            {
              onConflict: "workspace_id,platform,external_post_id",
            }
          )
          .select()
          .single();

        if (postError || !post) {
          errors.push(`Failed to sync post ${item.id}: ${postError?.message || "unknown error"}`);
          continue;
        }

        // Upsert metrics
        if (item.insights && Object.keys(item.insights).length > 0) {
          const capturedAt = postedAt || new Date().toISOString();
          const { error: metricError } = await supabaseAdmin
            .from("studio_social_post_metrics")
            .upsert(
              {
                social_post_id: post.id,
                captured_at: capturedAt,
                impressions: item.insights.impressions || 0,
                views: 0, // Instagram doesn't have views
                likes: item.insights.likes || 0,
                comments: item.insights.comments || 0,
                shares: item.insights.shares || 0,
                saves: item.insights.saves || 0,
                metadata: item.insights,
              },
              {
                onConflict: "social_post_id,captured_at",
              }
            );

          if (metricError) {
            console.warn(`Failed to sync metrics for ${item.id}:`, metricError);
          }
        }

        syncedCount++;
      } catch (err: any) {
        errors.push(`Error processing ${item.id}: ${err.message}`);
      }
    }

    // Update last_sync_at
    await updateSocialAccountLastSync(workspaceId, "instagram", supabaseAdmin);

    return NextResponse.json({
      ok: true,
      count: syncedCount,
      provider: "instagram",
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Error in Instagram refresh endpoint:", error);

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

