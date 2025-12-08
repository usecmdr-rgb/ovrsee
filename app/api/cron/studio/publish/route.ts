/**
 * Studio Publishing Scheduler Cron Job
 * 
 * GET /api/cron/studio/publish
 * 
 * This endpoint runs periodically (e.g., every minute) to find scheduled posts
 * that are ready to publish and enqueue them for publishing.
 * 
 * Should be triggered by:
 * - Vercel Cron (configured in vercel.json)
 * - Supabase cron
 * - External scheduler
 * 
 * Query params:
 * - secret: Secret key to prevent unauthorized access
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { logInfo, logError, logWarn } from "@/lib/studio/logging";

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    await logInfo("cron_publish_start", {});

    // Verify cron secret (if configured)
    const searchParams = request.nextUrl.searchParams;
    const providedSecret = searchParams.get("secret");

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      await logWarn("cron_publish_unauthorized", {});
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();
    const now = new Date();
    const bufferMinutes = 1; // Allow posts scheduled up to 1 minute in the past
    const cutoffTime = new Date(now.getTime() - bufferMinutes * 60 * 1000);

    // Find posts that are:
    // 1. Status = 'scheduled'
    // 2. scheduled_for <= now (with buffer)
    // 3. Not already in 'publishing' state
    const { data: scheduledPosts, error: postsError } = await supabase
      .from("studio_social_posts")
      .select("id, workspace_id, platform, scheduled_for, status")
      .eq("status", "scheduled")
      .lte("scheduled_for", cutoffTime.toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(50); // Process up to 50 posts per run

    if (postsError) {
      await logError("cron_publish_fetch_error", {
        error: postsError.message,
      });
      return NextResponse.json(
        { error: "Failed to fetch scheduled posts", details: postsError.message },
        { status: 500 }
      );
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      await logInfo("cron_publish_no_posts", {});
      return NextResponse.json({
        ok: true,
        message: "No scheduled posts ready to publish",
        processed: 0,
      });
    }

    // Also check for posts stuck in 'publishing' state (older than 10 minutes)
    // These might have failed mid-publish and need to be retried
    const stuckCutoff = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago
    const { data: stuckPosts, error: stuckError } = await supabase
      .from("studio_social_posts")
      .select("id, workspace_id, platform, scheduled_for, status, last_publish_attempt_at")
      .eq("status", "publishing")
      .lte("last_publish_attempt_at", stuckCutoff.toISOString())
      .limit(20);

    const allPostsToProcess = [
      ...scheduledPosts,
      ...(stuckPosts || []),
    ];

    // Process each post by calling the publish endpoint
    const results = await Promise.allSettled(
      allPostsToProcess.map(async (post) => {
        try {
          // Call the publish endpoint internally
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "http://localhost:3001";

          const publishUrl = `${baseUrl}/api/studio/publish/${post.id}`;
          const response = await fetch(publishUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Include cron secret in header for internal calls
              "X-Cron-Secret": CRON_SECRET || "",
            },
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || "Publish failed");
          }

          return {
            postId: post.id,
            success: true,
            platformPostId: result.platformPostId,
          };
        } catch (error: any) {
          await logError("cron_publish_post_error", {
            workspace_id: post.workspace_id,
            post_id: post.id,
            platform: post.platform,
            error: error.message,
          });
          return {
            postId: post.id,
            success: false,
            error: error.message,
          };
        }
      })
    );

    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success)
    ).length;

    // Log failures
    for (const result of results) {
      if (result.status === "rejected") {
        await logError("cron_publish_post_rejected", {
          error: result.reason?.message || String(result.reason),
        });
      } else if (!result.value.success) {
        await logWarn("cron_publish_post_failed", {
          post_id: result.value.postId,
          error: result.value.error,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    await logInfo("cron_publish_complete", {
      successful,
      failed,
      total: allPostsToProcess.length,
      duration_ms: durationMs,
    });

    return NextResponse.json({
      ok: true,
      message: `Processed ${successful} posts successfully, ${failed} failed`,
      processed: successful,
      failed,
      total: allPostsToProcess.length,
      posts: allPostsToProcess.map((p) => ({
        id: p.id,
        platform: p.platform,
        scheduledFor: p.scheduled_for,
      })),
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    await logError("cron_publish_exception", {
      error: error.message,
      stack: error.stack,
      duration_ms: durationMs,
    });
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// Also support POST for webhook-style triggers
export async function POST(request: NextRequest) {
  return GET(request);
}

