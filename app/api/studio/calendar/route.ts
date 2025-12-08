/**
 * Studio Calendar API
 * 
 * GET /api/studio/calendar
 * 
 * Returns posts for a given time range, formatted for calendar display
 * 
 * Query params:
 * - from: ISO date string (start of range)
 * - to: ISO date string (end of range)
 * - platform: optional filter by platform (instagram, tiktok, facebook)
 * - status: optional filter by status (draft, scheduled, posted, failed)
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

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");

    // Validate date range
    if (!fromParam || !toParam) {
      return NextResponse.json(
        { ok: false, error: "from and to date parameters are required" },
        { status: 400, headers: responseHeaders }
      );
    }

    const fromDate = new Date(fromParam);
    const toDate = new Date(toParam);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Invalid date format. Use ISO 8601 format." },
        { status: 400, headers: responseHeaders }
      );
    }

    // Limit range to prevent excessive queries (max 3 months)
    const maxRangeMs = 90 * 24 * 60 * 60 * 1000; // 90 days
    if (toDate.getTime() - fromDate.getTime() > maxRangeMs) {
      return NextResponse.json(
        { ok: false, error: "Date range cannot exceed 90 days" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Build query
    let query = supabaseClient
      .from("studio_social_posts")
      .select(`
        id,
        platform,
        caption,
        status,
        scheduled_for,
        published_at,
        posted_at,
        created_at,
        predicted_score_label,
        predicted_score_numeric,
        experiment_id,
        experiment_variant_label,
        social_account_id,
        studio_social_accounts (
          handle,
          platform
        )
      `)
      .eq("workspace_id", workspaceId)
      .or(
        // Include posts that:
        // 1. Have scheduled_for in range
        // 2. Have published_at/posted_at in range (for posted posts)
        // 3. Are drafts with created_at in range
        `scheduled_for.gte.${fromParam},scheduled_for.lte.${toParam},published_at.gte.${fromParam},published_at.lte.${toParam},posted_at.gte.${fromParam},posted_at.lte.${toParam},and(status.eq.draft,created_at.gte.${fromParam},created_at.lte.${toParam})`
      )
      .order("scheduled_for", { ascending: true, nullsFirst: true })
      .order("published_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    // Apply filters
    if (platform && ["instagram", "tiktok", "facebook"].includes(platform)) {
      query = query.eq("platform", platform);
    }

    if (status && ["draft", "scheduled", "publishing", "posted", "failed"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data: posts, error: postsError } = await query;

    if (postsError) {
      console.error("Error fetching calendar posts:", postsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch posts", details: postsError.message },
        { status: 500, headers: responseHeaders }
      );
    }

    // Format posts for calendar display
    const formattedPosts = (posts || []).map((post) => {
      // Determine display date (prefer scheduled_for, then published_at, then created_at)
      const displayDate = post.scheduled_for || post.published_at || post.posted_at || post.created_at;
      
      // Generate title/summary from caption
      const title = post.caption
        ? post.caption.length > 50
          ? post.caption.substring(0, 50) + "..."
          : post.caption
        : `Untitled ${post.platform} post`;

      return {
        id: post.id,
        title,
        platform: post.platform,
        status: post.status,
        scheduled_for: post.scheduled_for,
        published_at: post.published_at,
        posted_at: post.posted_at,
        display_date: displayDate,
        account_handle: post.studio_social_accounts?.handle || null,
        predicted_score_label: post.predicted_score_label,
        predicted_score_numeric: post.predicted_score_numeric,
        experiment_id: post.experiment_id,
        experiment_variant_label: post.experiment_variant_label,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          posts: formattedPosts,
          range: {
            from: fromParam,
            to: toParam,
          },
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio calendar endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

