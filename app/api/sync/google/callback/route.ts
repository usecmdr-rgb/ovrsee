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
    console.log("[OAuth Callback] Exchanging authorization code for tokens...");
    const tokens = await exchangeCodeForTokens(code);
    
    console.log("[OAuth Callback] Tokens received:", {
      hasAccessToken: !!tokens.accessToken,
      accessTokenType: typeof tokens.accessToken,
      accessTokenLength: tokens.accessToken?.length,
      accessTokenPreview: tokens.accessToken ? tokens.accessToken.substring(0, 20) + "..." : "NULL",
      hasIdToken: !!tokens.idToken,
      idTokenLength: tokens.idToken?.length,
      hasRefreshToken: !!tokens.refreshToken,
      scopes: tokens.scope,
    });

    // Validate access token before using it
    if (!tokens.accessToken || tokens.accessToken.trim() === "") {
      console.error("[OAuth Callback] Access token is missing or empty!");
      throw new Error("Access token is missing from token exchange response");
    }

    // Get user email from Google (try ID token first, fallback to userinfo API)
    console.log("[OAuth Callback] Getting user email...");
    const email = await getGoogleUserEmail(tokens.accessToken, tokens.idToken);
    console.log("[OAuth Callback] User email retrieved:", email);

    // Store integration (preserve existing refresh token if new one is not provided)
    await upsertGoogleIntegration({
      workspaceId: state.workspaceId,
      userId: state.userId,
      email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken, // May be null if Google didn't return one
      expiresAt: tokens.expiresAt,
      scopes: tokens.scope,
      preserveRefreshToken: true, // Preserve existing refresh token if new one is null
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



