import { NextRequest, NextResponse } from "next/server";
import { getUserSessionFromToken } from "@/lib/auth/session";
import { getTrialStatus, hasActiveAccess } from "@/lib/subscription/trial";

/**
 * GET /api/subscription/trial-status
 * Get trial status information for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authorization required" },
        { status: 401 }
      );
    }

    const session = await getUserSessionFromToken(accessToken);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const trialStatus = await getTrialStatus(userId);
    const hasAccess = await hasActiveAccess(userId);

    return NextResponse.json({
      success: true,
      trial: trialStatus,
      hasAccess,
      subscription: {
        tier: session.tier,
        status: session.status,
        isTrialExpired: session.isTrialExpired,
      },
    });
  } catch (error: any) {
    console.error("Trial status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get trial status" },
      { status: 500 }
    );
  }
}

