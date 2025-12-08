/**
 * Studio Campaigns API
 * 
 * GET /api/studio/campaigns
 * List campaigns for the workspace
 * 
 * POST /api/studio/campaigns
 * Create a new campaign
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

    const { data: campaigns, error } = await supabaseClient
      .from("studio_campaigns")
      .select(`
        *,
        studio_social_posts!inner(count)
      `)
      .eq("workspace_id", workspaceId)
      .order("start_date", { ascending: false });

    if (error) {
      console.error("Error fetching campaigns:", error);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch campaigns" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Get post counts per campaign
    const campaignsWithCounts = await Promise.all(
      (campaigns || []).map(async (campaign: any) => {
        const { count } = await supabaseClient
          .from("studio_social_posts")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaign.id);

        return {
          ...campaign,
          post_count: count || 0,
        };
      })
    );

    return NextResponse.json(
      {
        ok: true,
        data: { campaigns: campaignsWithCounts },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio campaigns GET endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, description, objective, start_date, end_date } = body;

    // Validation
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { ok: false, error: "name is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (!start_date || !end_date) {
      return NextResponse.json(
        { ok: false, error: "start_date and end_date are required" },
        { status: 400, headers: responseHeaders }
      );
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Invalid date format" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (endDate < startDate) {
      return NextResponse.json(
        { ok: false, error: "end_date must be after start_date" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("studio_campaigns")
      .insert({
        workspace_id: workspaceId,
        name,
        description: description || null,
        objective: objective || null,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        created_by: user.id,
      })
      .select()
      .single();

    if (campaignError || !campaign) {
      console.error("Error creating campaign:", campaignError);
      return NextResponse.json(
        { ok: false, error: "Failed to create campaign", details: campaignError?.message },
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: { campaign },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio campaigns POST endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

