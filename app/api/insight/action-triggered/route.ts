import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/insight/action-triggered
 * 
 * Log when a user triggers an action from an insight
 * This is for analytics purposes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { insightId, actionId, actionType } = body;

    // In production, you might want to log this to a separate analytics table
    // For now, we'll just acknowledge it
    console.log("Insight action triggered:", {
      insightId,
      actionId,
      actionType,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error logging action:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}




