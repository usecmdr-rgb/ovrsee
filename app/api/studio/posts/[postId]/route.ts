/**
 * Studio Post Detail API
 * 
 * GET /api/studio/posts/[postId]
 * Get a single post with its metrics and repurposed variants
 * 
 * PATCH /api/studio/posts/[postId]
 * Update a post (primarily for rescheduling via drag-and-drop)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { upsertPostHashtags } from "@/lib/studio/hashtag-service";
import { captureEditEvent } from "@/lib/studio/personalization-event-helper";
import { handleApiError } from "@/lib/studio/api-error-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
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

    const { postId } = await params;

    // Fetch post with latest metrics
    const { data: post, error: postError } = await supabaseClient
      .from("studio_social_posts")
      .select(`
        *,
        studio_social_post_metrics (
          impressions,
          views,
          likes,
          comments,
          shares,
          saves,
          captured_at
        )
      `)
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { ok: false, error: "Post not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Get latest metrics
    const metricsArray = post.studio_social_post_metrics as any[];
    const latestMetrics = metricsArray && metricsArray.length > 0
      ? metricsArray.sort((a, b) => 
          new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
        )[0]
      : null;

    // Get repurposed variants (posts that were repurposed from this one)
    const { data: repurposedVariants } = await supabaseClient
      .from("studio_social_posts")
      .select("id, platform, caption, status, scheduled_for")
      .eq("repurposed_from_post_id", postId)
      .eq("workspace_id", workspaceId);

    // Get other posts in the same content group (if this is a repurposed post)
    let contentGroup: any[] = [];
    if (post.content_group_id) {
      const { data: groupPosts } = await supabaseClient
        .from("studio_social_posts")
        .select("id, platform, caption, status, scheduled_for, repurposed_from_post_id")
        .eq("content_group_id", post.content_group_id)
        .eq("workspace_id", workspaceId);
      
      contentGroup = groupPosts || [];
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...post,
          metrics: latestMetrics || {
            impressions: 0,
            views: 0,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
          },
          repurposed_variants: repurposedVariants || [],
          content_group: contentGroup,
          // Include scoring data
          predicted_score_label: post.predicted_score_label,
          predicted_score_numeric: post.predicted_score_numeric,
          predicted_score_explanation: post.predicted_score_explanation,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    return await handleApiError(error, {
      workspaceId,
      route: "/api/studio/posts/[postId]",
      postId: (await params).postId,
      userId,
    });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
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

    const { postId } = await params;
    const body = await request.json();
    const { scheduled_for, status } = body;

    // Verify post belongs to workspace
    const { data: existingPost, error: fetchError } = await supabaseClient
      .from("studio_social_posts")
      .select("id, workspace_id, status, caption")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (fetchError || !existingPost) {
      return NextResponse.json(
        { ok: false, error: "Post not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Build update object
    const updates: any = {};
    let captionUpdated = false;

    if (scheduled_for !== undefined) {
      const scheduledDate = new Date(scheduled_for);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { ok: false, error: "Invalid scheduled_for date format" },
          { status: 400, headers: responseHeaders }
        );
      }

      updates.scheduled_for = scheduledDate.toISOString();

      // Update status based on scheduled_for
      const now = new Date();
      if (scheduledDate <= now) {
        // If scheduled time is in the past, set to draft or keep current status
        if (existingPost.status === "scheduled") {
          updates.status = "draft";
        }
      } else {
        // If scheduled for future, set to scheduled
        if (existingPost.status === "draft" || existingPost.status === "failed") {
          updates.status = "scheduled";
        }
      }
    }

    if (status && ["draft", "scheduled", "publishing", "posted", "failed"].includes(status)) {
      updates.status = status;
    }

    if (body.caption !== undefined) {
      updates.caption = body.caption;
      captionUpdated = true;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid fields to update" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Update the post
    const { data: updatedPost, error: updateError } = await supabaseClient
      .from("studio_social_posts")
      .update(updates)
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (updateError || !updatedPost) {
      console.error("Error updating post:", updateError);
      return NextResponse.json(
        { ok: false, error: "Failed to update post", details: updateError?.message },
        { status: 500, headers: responseHeaders }
      );
    }

    // If caption was updated, parse and store hashtags
    if (captionUpdated) {
      try {
        await upsertPostHashtags(workspaceId, postId, updatedPost.caption, supabaseClient);
        
        // Capture edit event for personalization
        captureEditEvent(
          workspaceId,
          postId,
          existingPost.caption,
          updatedPost.caption,
          {
            userId: user.id,
            supabaseClient,
          }
        ).catch((error) => {
          console.error("Failed to capture edit event:", error);
          // Don't fail the update if event capture fails
        });
      } catch (hashtagError) {
        // Log but don't fail the update
        console.error("Failed to process hashtags:", hashtagError);
      }
    }

    return NextResponse.json(
      { ok: true, data: updatedPost },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    return await handleApiError(error, {
      workspaceId,
      route: "/api/studio/posts/[postId]",
      postId: (await params).postId,
      userId,
    });
  }
}
