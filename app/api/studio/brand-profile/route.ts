/**
 * Studio Brand Profile API
 * 
 * GET /api/studio/brand-profile
 * Get the current workspace's brand profile
 * 
 * POST /api/studio/brand-profile
 * Create or update the workspace's brand profile
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import {
  getBrandProfile,
  upsertBrandProfile,
  formatBrandProfileForPrompt,
} from "@/lib/studio/brand-profile-service";

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

    const profile = await getBrandProfile(workspaceId, supabaseClient);

    return NextResponse.json(
      {
        ok: true,
        data: profile,
        // Include formatted version for debugging/preview
        formatted: profile ? formatBrandProfileForPrompt(profile) : null,
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error fetching brand profile:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
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
    const {
      brand_description,
      target_audience,
      voice_tone,
      brand_attributes,
    } = body;

    // Validate voice_tone structure if provided
    if (voice_tone && typeof voice_tone !== "object") {
      return NextResponse.json(
        { ok: false, error: "voice_tone must be an object" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Validate brand_attributes structure if provided
    if (brand_attributes && typeof brand_attributes !== "object") {
      return NextResponse.json(
        { ok: false, error: "brand_attributes must be an object" },
        { status: 400, headers: responseHeaders }
      );
    }

    const profile = await upsertBrandProfile(
      workspaceId,
      {
        brand_description: brand_description ?? null,
        target_audience: target_audience ?? null,
        voice_tone: voice_tone || {},
        brand_attributes: brand_attributes || {},
        updated_by: user.id,
      },
      supabaseClient
    );

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Failed to save brand profile" },
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: profile,
        formatted: formatBrandProfileForPrompt(profile),
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error saving brand profile:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

