import { NextRequest, NextResponse } from "next/server";
import { getUserSessionFromToken } from "@/lib/auth/session";

/**
 * GET /api/auth/session
 * Get current user session data (requires authentication)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Authorization token required" },
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

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    console.error("Session error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get session" },
      { status: 500 }
    );
  }
}

