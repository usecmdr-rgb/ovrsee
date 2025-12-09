/**
 * Studio Campaign Detail API
 * 
 * GET /api/studio/campaigns/[id]
 * Get campaign details with associated posts
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: campaignId } = await params;

    // Get campaign
    const { data: campaign, error: campaignError } = await supabaseClient
      .from("studio_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { ok: false, error: "Campaign not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Get associated posts
    const { data: posts, error: postsError } = await supabaseClient
      .from("studio_social_posts")
      .select(`
        id,
        platform,
        caption,
        status,
        scheduled_for,
        published_at,
        predicted_score_label
      `)
      .eq("campaign_id", campaignId)
      .eq("workspace_id", workspaceId)
      .order("scheduled_for", { ascending: true, nullsFirst: true });

    if (postsError) {
      console.error("Error fetching campaign posts:", postsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch campaign posts" },
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          campaign,
          posts: posts || [],
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio campaign detail endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

