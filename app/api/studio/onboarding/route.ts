/**
 * Studio Onboarding API
 * 
 * GET /api/studio/onboarding - Get onboarding state
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getOnboardingState, isOnboardingRequired } from "@/lib/studio/onboarding-service";

export async function GET(request: NextRequest) {
  try {
    const { supabaseClient, user } = await getAuthenticatedSupabaseFromRequest(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: "Workspace not found" }, { status: 404 });
    }

    const state = await getOnboardingState(workspaceId, supabaseClient);
    const required = await isOnboardingRequired(workspaceId, supabaseClient);

    return NextResponse.json({
      ok: true,
      data: {
        ...(state || {
          workspace_id: workspaceId,
          completed_steps: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        is_required: required,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to get onboarding state" },
      { status: 500 }
    );
  }
}

