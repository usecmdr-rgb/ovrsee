import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { runSequenceFollowUpsJob } from "@/lib/sync/jobs/sequenceFollowUpsJob";
import { isAutoSequenceFollowUpsEnabled } from "@/lib/sync/featureFlags";

/**
 * POST /api/sync/jobs/sequence-follow-ups
 * Trigger the sequence follow-ups job for the current user
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

    const result = await runSequenceFollowUpsJob(userId);

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error: any) {
    console.error("[Sequence Follow-ups Job] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run sequence follow-ups job" },
      { status: 500 }
    );
  }
}


