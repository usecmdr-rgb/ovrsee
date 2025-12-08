import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { generateFollowUpsJob } from "@/lib/sync/jobs/generateFollowUpsJob";
import { isFollowUpSuggestionsEnabled } from "@/lib/sync/featureFlags";

/**
 * POST /api/sync/jobs/generate-follow-ups
 * Trigger follow-up suggestions generation job
 */
export async function POST(request: NextRequest) {
  try {
    if (!isFollowUpSuggestionsEnabled()) {
      return NextResponse.json(
        { error: "Follow-up suggestions are disabled" },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServerClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken || accessToken === "dev-token") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = userResult.user.id;

    // Run the job for this user
    const result = await generateFollowUpsJob(userId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("[GenerateFollowUps] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate follow-ups" },
      { status: 500 }
    );
  }
}


