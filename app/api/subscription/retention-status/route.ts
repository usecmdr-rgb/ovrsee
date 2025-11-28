import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getDataRetentionStatus } from "@/lib/subscription/data-retention";
import { isTrialExpired } from "@/lib/trial-eligibility";
import { createErrorResponse } from "@/lib/validation";

/**
 * GET /api/subscription/retention-status
 * 
 * Get data retention status for the authenticated user.
 * 
 * Returns:
 * - isTrialExpired: Whether user's trial has expired
 * - isInRetentionWindow: Whether user is in retention window
 * - daysRemaining: Days remaining in retention window
 * - isDataCleared: Whether user's data has been cleared
 * - retentionReason: Why retention window was set
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    // Get retention status
    const retentionStatus = await getDataRetentionStatus(userId);

    // Check if trial is expired
    const trialExpired = await isTrialExpired(userId);

    return NextResponse.json({
      isTrialExpired: trialExpired,
      isInRetentionWindow: retentionStatus.hasRetentionWindow && !retentionStatus.isExpired,
      daysRemaining: retentionStatus.daysRemaining,
      isDataCleared: retentionStatus.isDataCleared,
      retentionReason: retentionStatus.reason,
    });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }

    return createErrorResponse(
      "Failed to fetch retention status",
      500,
      error
    );
  }
}










