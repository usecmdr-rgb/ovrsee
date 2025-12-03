import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-helpers";

/**
 * GET /api/auth/debug
 *
 * Safe diagnostic endpoint to inspect current auth state from the server's perspective.
 * Returns minimal information about the authenticated user (if any).
 *
 * This endpoint is intended for development and support debugging and does not
 * expose any sensitive tokens or secrets.
 */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({
        authenticated: false,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
      },
    });
  } catch (error: any) {
    console.error("Auth debug error:", error);
    return NextResponse.json(
      {
        authenticated: false,
        error: "Failed to inspect auth state",
      },
      { status: 500 }
    );
  }
}














