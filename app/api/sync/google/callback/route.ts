import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  getGoogleUserEmail,
  decodeOAuthState,
} from "@/lib/sync/googleOAuth";
import { upsertGoogleIntegration } from "@/lib/sync/integrations";
import { createErrorResponse } from "@/lib/validation";
import { env } from "@/lib/config/env";

/**
 * GET /api/sync/google/callback
 * 
 * Handles Google OAuth callback
 * Exchanges authorization code for tokens and stores integration
 * 
 * Query params:
 * - code: string (authorization code from Google)
 * - state: string (signed state containing workspaceId, userId, returnTo)
 * 
 * Redirects to returnTo on success, or /sync if not provided
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const stateParam = request.nextUrl.searchParams.get("state");

    if (!code) {
      return createErrorResponse("Missing authorization code", 400);
    }

    if (!stateParam) {
      return createErrorResponse("Missing state parameter", 400);
    }

    // Decode and verify state
    let state;
    try {
      state = decodeOAuthState(stateParam);
    } catch (error: any) {
      return createErrorResponse(
        `Invalid state parameter: ${error.message}`,
        400
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user email from Google
    const email = await getGoogleUserEmail(tokens.accessToken);

    // Store integration
    await upsertGoogleIntegration({
      workspaceId: state.workspaceId,
      userId: state.userId,
      email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scope,
    });

    // Redirect to returnTo or default to /sync
    const returnTo = state.returnTo || "/sync";
    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUrl = returnTo.startsWith("http")
      ? returnTo
      : `${baseUrl}${returnTo}`;

    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error("Error in Google OAuth callback:", error);
    
    // Try to extract returnTo from state for error redirect
    let errorRedirect = "/sync?error=oauth_failed";
    try {
      const stateParam = request.nextUrl.searchParams.get("state");
      if (stateParam) {
        const state = decodeOAuthState(stateParam);
        if (state.returnTo) {
          const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          errorRedirect = `${baseUrl}${state.returnTo}?error=oauth_failed`;
        }
      }
    } catch {
      // Ignore state decode errors for error redirect
    }

    // In production, redirect with error; in dev, show JSON
    if (process.env.NODE_ENV === "production") {
      return NextResponse.redirect(errorRedirect);
    }

    return createErrorResponse(
      error.message || "OAuth callback failed",
      500
    );
  }
}



