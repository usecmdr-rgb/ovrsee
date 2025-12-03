/**
 * Studio Analytics Trends API
 * 
 * GET /api/studio/analytics/trends?from=&to=
 * 
 * Returns time series data aggregated by day for charting
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";

export async function GET(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Default to last 30 days if not provided
    const to = toParam ? new Date(toParam) : new Date();
    const from = fromParam
      ? new Date(fromParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get all posts for this workspace
    const { data: posts, error: postsError } = await supabaseClient
      .from("studio_social_posts")
      .select("id")
      .eq("workspace_id", workspaceId);

    if (postsError) {
      console.error("Error fetching posts for trends:", postsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch posts", details: postsError.message },
        { status: 500, headers: responseHeaders }
      );
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          data: {
            dates: [],
            views: [],
            likes: [],
            comments: [],
            shares: [],
          },
        },
        { headers: responseHeaders }
      );
    }

    const postIds = posts.map((p) => p.id);

    // Get all metrics within date range
    const { data: metrics, error: metricsError } = await supabaseClient
      .from("studio_social_post_metrics")
      .select("*")
      .in("social_post_id", postIds)
      .gte("captured_at", from.toISOString())
      .lte("captured_at", to.toISOString())
      .order("captured_at", { ascending: true });

    if (metricsError) {
      console.error("Error fetching metrics for trends:", metricsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch metrics", details: metricsError.message },
        { status: 500, headers: responseHeaders }
      );
    }

    // Aggregate metrics by day
    const dailyData = new Map<
      string,
      { views: number; likes: number; comments: number; shares: number }
    >();

    // Group metrics by date (YYYY-MM-DD)
    const metricsByDate = new Map<string, typeof metrics>();
    (metrics || []).forEach((metric) => {
      const date = new Date(metric.captured_at).toISOString().split("T")[0];
      if (!metricsByDate.has(date)) {
        metricsByDate.set(date, []);
      }
      metricsByDate.get(date)!.push(metric);
    });

    // For each date, get the latest metric per post and sum
    for (const [date, dateMetrics] of metricsByDate.entries()) {
      // Group by post_id and get latest
      const latestByPost = new Map<string, typeof dateMetrics[0]>();
      dateMetrics.forEach((metric) => {
        const existing = latestByPost.get(metric.social_post_id);
        if (
          !existing ||
          new Date(metric.captured_at) > new Date(existing.captured_at)
        ) {
          latestByPost.set(metric.social_post_id, metric);
        }
      });

      // Sum the latest metrics
      let views = 0;
      let likes = 0;
      let comments = 0;
      let shares = 0;

      latestByPost.forEach((metric) => {
        views += metric.views || 0;
        likes += metric.likes || 0;
        comments += metric.comments || 0;
        shares += metric.shares || 0;
      });

      dailyData.set(date, { views, likes, comments, shares });
    }

    // Generate date range and fill in missing days with 0
    const dates: string[] = [];
    const views: number[] = [];
    const likes: number[] = [];
    const comments: number[] = [];
    const shares: number[] = [];

    const currentDate = new Date(from);
    while (currentDate <= to) {
      const dateStr = currentDate.toISOString().split("T")[0];
      dates.push(dateStr);
      const dayData = dailyData.get(dateStr) || {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      };
      views.push(dayData.views);
      likes.push(dayData.likes);
      comments.push(dayData.comments);
      shares.push(dayData.shares);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          dates,
          views,
          likes,
          comments,
          shares,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio analytics trends endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
