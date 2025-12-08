import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { runAutoFollowUpDraftJob } from "@/lib/sync/jobs/autoFollowUpDraftJob";
import { isAutoSequenceFollowUpsEnabled } from "@/lib/sync/featureFlags";

/**
 * POST /api/sync/jobs/auto-follow-ups
 * Trigger the auto follow-up draft generation job for the current user
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    if (!isAutoSequenceFollowUpsEnabled()) {
      return NextResponse.json(
        { error: "Auto follow-up sequences are disabled" },
        { status: 403 }
      );
    }

    const result = await runAutoFollowUpDraftJob(userId);

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error: any) {
    console.error("[Auto Follow-ups Job] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run auto follow-up job" },
      { status: 500 }
    );
  }
}


