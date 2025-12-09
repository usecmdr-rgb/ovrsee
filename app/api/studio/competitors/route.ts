/**
 * Studio Competitors API
 * 
 * GET /api/studio/competitors
 * List competitors for the workspace
 * 
 * POST /api/studio/competitors
 * Add a new competitor
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import {
  listCompetitors,
  addCompetitor,
  type CompetitorPlatform,
} from "@/lib/studio/competitor-service";

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

    const competitors = await listCompetitors(workspaceId, supabaseClient);

    return NextResponse.json(
      {
        ok: true,
        data: { competitors },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio competitors GET endpoint:", error);
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
  let responseHeaders: Headers | undefined;
  try {
    const authResult = await getAuthenticatedSupabaseFromRequest(request);
    const { supabaseClient, user } = authResult;
    responseHeaders = authResult.responseHeaders;

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const body = await request.json();
    const { platform, handle, label } = body;

    // Validation
    if (!platform || !["instagram", "tiktok", "facebook"].includes(platform)) {
      return NextResponse.json(
        { ok: false, error: "platform must be one of: instagram, tiktok, facebook" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (!handle || typeof handle !== "string") {
      return NextResponse.json(
        { ok: false, error: "handle is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Add competitor
    const competitor = await addCompetitor(
      workspaceId,
      user.id,
      {
        platform: platform as CompetitorPlatform,
        handle,
        label,
      },
      supabaseClient
    );

    return NextResponse.json(
      {
        ok: true,
        data: { competitor },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio competitors POST endpoint:", error);
    
    // Handle unique constraint violation
    if (error.message?.includes("unique_competitor_per_workspace")) {
      return NextResponse.json(
        { ok: false, error: "This competitor is already tracked" },
        { status: 409, headers: responseHeaders }
      );
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

