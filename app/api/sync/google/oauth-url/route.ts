import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getGoogleAuthUrl } from "@/lib/sync/googleOAuth";
import { getOrCreateWorkspace } from "@/lib/sync/integrations";
import { createErrorResponse } from "@/lib/validation";

/**
 * GET /api/sync/google/oauth-url
 * 
 * Generates Google OAuth authorization URL for Gmail and Calendar integration
 * 
 * Query params:
 * - returnTo?: string (optional redirect path after OAuth)
 * 
 * Returns:
 * - url: string (OAuth authorization URL)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    // Get or create workspace
    const workspace = await getOrCreateWorkspace(userId);

    // Get optional returnTo from query params
    const returnTo = request.nextUrl.searchParams.get("returnTo") || undefined;

    // Generate OAuth URL
    const authUrl = getGoogleAuthUrl({
      workspaceId: workspace.id,
      userId,
      returnTo,
    });

    return NextResponse.json({
      url: authUrl,
    });
  } catch (error: any) {
    console.error("Error generating Google OAuth URL:", error);
    return createErrorResponse(
      error.message || "Failed to generate OAuth URL",
      error.message?.includes("not configured") ? 500 : 500
    );
  }
}



