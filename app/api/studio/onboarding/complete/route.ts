/**
 * Studio Onboarding Complete Step API
 * 
 * POST /api/studio/onboarding/complete - Mark a step as completed
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { completeOnboardingStep } from "@/lib/studio/onboarding-service";

export async function POST(request: NextRequest) {
  try {
    const { supabaseClient, user } = await getAuthenticatedSupabaseFromRequest(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json({ ok: false, error: "Workspace not found" }, { status: 404 });
    }

    const { step, skipped } = await request.json();
    
    if (!step || !["connect_accounts", "brand_profile", "first_plan", "review"].includes(step)) {
      return NextResponse.json({ ok: false, error: "Invalid step" }, { status: 400 });
    }

    await completeOnboardingStep(workspaceId, step, { skipped: skipped === true }, supabaseClient);

    return NextResponse.json({
      ok: true,
      message: "Step marked as completed",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to complete step" },
      { status: 500 }
    );
  }
}

