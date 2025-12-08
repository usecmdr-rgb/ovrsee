/**
 * Studio Posts API
 * 
 * POST /api/studio/posts
 * Create a new post (draft, scheduled, or publish immediately)
 * 
 * GET /api/studio/posts
 * List posts for the workspace
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { publishPost } from "@/lib/studio/publish-service";
import { upsertPostHashtags } from "@/lib/studio/hashtag-service";
import { handleApiError } from "@/lib/studio/api-error-response";

export async function POST(request: NextRequest) {
  let workspaceId: string | undefined;
  let userId: string | undefined;
  
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);
    
    userId = user.id;
    workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const body = await request.json();
    const {
      platform,
      social_account_id,
      asset_id,
      caption,
      scheduled_for,
      publish_now = false,
      media_url,
      media_type = "image",
    } = body;

    // Validation
    if (!platform || !["instagram", "tiktok", "facebook"].includes(platform)) {
      return NextResponse.json(
        { ok: false, error: "Invalid platform" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (!social_account_id) {
      return NextResponse.json(
        { ok: false, error: "social_account_id is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (!asset_id && !media_url) {
      return NextResponse.json(
        { ok: false, error: "Either asset_id or media_url is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Determine status and scheduled_for
    let status: "draft" | "scheduled" | "publishing" = "draft";
    let scheduledFor: string | null = null;

    if (publish_now) {
      status = "publishing";
      scheduledFor = new Date().toISOString();
    } else if (scheduled_for) {
      const scheduledDate = new Date(scheduled_for);
      const now = new Date();

      if (scheduledDate <= now) {
        // If scheduled time is in the past, treat as "publish now"
        status = "publishing";
        scheduledFor = new Date().toISOString();
      } else {
        status = "scheduled";
        scheduledFor = scheduledDate.toISOString();
      }
    }

    // Create the post
    const { data: post, error: postError } = await supabaseClient
      .from("studio_social_posts")
      .insert({
        workspace_id: workspaceId,
        social_account_id,
        asset_id: asset_id || null,
        platform,
        caption: caption || null,
        scheduled_for: scheduledFor,
        status,
        metadata: {
          media_url: media_url || null,
          media_type: media_type,
          created_by: user.id,
        },
        created_by: user.id,
      })
      .select()
      .single();

    if (postError || !post) {
      console.error("Error creating post:", postError);
      return NextResponse.json(
        { ok: false, error: "Failed to create post", details: postError?.message },
        { status: 500, headers: responseHeaders }
      );
    }

    // Parse and store hashtags from caption
    try {
      await upsertPostHashtags(workspaceId, post.id, caption, supabaseClient);
    } catch (hashtagError) {
      // Log but don't fail the post creation
      console.error("Failed to process hashtags:", hashtagError);
    }

    // If publish_now, immediately publish
    if (publish_now || (scheduled_for && new Date(scheduled_for) <= new Date())) {
      try {
        const mediaUrl = media_url || (asset_id ? await getAssetUrl(asset_id, supabaseClient) : null);
        
        if (!mediaUrl) {
          // Update post to failed if no media URL
          await supabaseClient
            .from("studio_social_posts")
            .update({
              status: "failed",
              last_publish_error: "Media URL not found",
            })
            .eq("id", post.id);

          return NextResponse.json(
            { ok: false, error: "Media URL not found" },
            { status: 400, headers: responseHeaders }
          );
        }

        const publishResult = await publishPost({
          postId: post.id,
          workspaceId,
          platform: platform as "instagram" | "tiktok" | "facebook",
          caption: caption || "",
          mediaUrl,
          mediaType: media_type === "video" ? "video" : "image",
          assetId: asset_id || undefined,
        });

        if (publishResult.success) {
          await supabaseClient
            .from("studio_social_posts")
            .update({
              status: "posted",
              platform_post_id: publishResult.platformPostId,
              post_url: publishResult.postUrl,
              published_at: new Date().toISOString(),
              posted_at: new Date().toISOString(),
            })
            .eq("id", post.id);

          return NextResponse.json(
            {
              ok: true,
              data: {
                ...post,
                status: "posted",
                platform_post_id: publishResult.platformPostId,
                post_url: publishResult.postUrl,
                published_at: new Date().toISOString(),
              },
            },
            { headers: responseHeaders }
          );
        } else {
          await supabaseClient
            .from("studio_social_posts")
            .update({
              status: "failed",
              last_publish_error: publishResult.error,
            })
            .eq("id", post.id);

          return NextResponse.json(
            {
              ok: false,
              error: publishResult.error,
              data: post,
            },
            { status: 500, headers: responseHeaders }
          );
        }
      } catch (error: any) {
        await supabaseClient
          .from("studio_social_posts")
          .update({
            status: "failed",
            last_publish_error: error.message || "Unknown error",
          })
          .eq("id", post.id);

        return NextResponse.json(
          {
            ok: false,
            error: error.message || "Failed to publish post",
            data: post,
          },
          { status: 500, headers: responseHeaders }
        );
      }
    }

    return NextResponse.json(
      { ok: true, data: post },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    return await handleApiError(error, {
      workspaceId,
      route: "/api/studio/posts",
      userId,
    });
  }
}

export async function GET(request: NextRequest) {
  let workspaceId: string | undefined;
  let userId: string | undefined;
  
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);
    
    userId = user.id;
    workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");

    let query = supabaseClient
      .from("studio_social_posts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (platform && ["instagram", "tiktok", "facebook"].includes(platform)) {
      query = query.eq("platform", platform);
    }

    if (status && ["draft", "scheduled", "publishing", "posted", "failed"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: posts, error: postsError } = await query;

    if (postsError) {
      console.error("Error fetching posts:", postsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch posts", details: postsError.message },
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json(
      { ok: true, data: { posts: posts || [] } },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    return await handleApiError(error, {
      workspaceId,
      route: "/api/studio/posts",
      userId,
    });
  }
}

/**
 * Helper to get asset URL from asset_id
 */
async function getAssetUrl(
  assetId: string,
  supabase: any
): Promise<string | null> {
  const { data: asset } = await supabase
    .from("studio_assets")
    .select("file_url")
    .eq("id", assetId)
    .single();

  return asset?.file_url || null;
}

