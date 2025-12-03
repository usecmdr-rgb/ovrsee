import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getOAuthRedirectUri } from "@/lib/oauth-helpers";
import { getBaseUrl } from "@/lib/auth/getBaseUrl";

/**
 * Gmail OAuth Callback Endpoint
 * 
 * This endpoint handles the OAuth callback from Google after user authorizes Gmail access.
 * 
 * IMPORTANT: This is SEPARATE from Supabase Google authentication:
 * - Supabase Google login: Uses Supabase's OAuth client (configured in Supabase dashboard)
 * - Gmail OAuth: Uses GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET (configured in Google Cloud Console)
 * 
 * Flow:
 * 1. User clicks "Connect Gmail" → redirected to Google OAuth consent screen
 * 2. User authorizes → Google redirects to /api/gmail/callback?code=...&state=...
 * 3. This endpoint exchanges the code for access/refresh tokens
 * 4. Tokens are stored in gmail_connections table
 * 5. User is redirected back to /sync?gmail_connected=true
 * 
 * The redirect URI used here MUST match exactly what was used in /api/gmail/auth
 * and what's configured in Google Cloud Console.
 * 
 * Setup Requirements:
 * - GMAIL_CLIENT_ID=1077385431224-armgjmsn38f1mj23m5l1q8j274ch80p2.apps.googleusercontent.com
 * - GMAIL_CLIENT_SECRET=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
 * - NEXT_PUBLIC_APP_URL=http://localhost:3000 (or your dev port)
 * - Redirect URI in Google Cloud Console must match: ${getBaseUrl()}/api/gmail/callback
 */

function getGmailClientId(): string {
  const clientId = process.env.GMAIL_CLIENT_ID || "";
  if (!clientId || clientId.includes("your_")) {
    throw new Error("GMAIL_CLIENT_ID is not configured");
  }
  return clientId;
}

function getGmailClientSecret(): string {
  const secret = process.env.GMAIL_CLIENT_SECRET || "";
  if (!secret || secret.includes("your_")) {
    throw new Error("GMAIL_CLIENT_SECRET is not configured");
  }
  return secret;
}

export async function GET(request: NextRequest) {
  try {
    // Validate client ID and secret are configured
    let GMAIL_CLIENT_ID: string;
    let GMAIL_CLIENT_SECRET: string;
    
    try {
      GMAIL_CLIENT_ID = getGmailClientId();
      GMAIL_CLIENT_SECRET = getGmailClientSecret();
    } catch (error: any) {
      console.error("[Gmail OAuth Callback] Configuration error:", error.message);
      const baseUrl = getBaseUrl();
      return NextResponse.redirect(
        new URL(`/sync?error=oauth_not_configured&details=${encodeURIComponent(error.message)}`, baseUrl)
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // User ID
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const baseUrl = getBaseUrl();

    // Handle OAuth errors from Google
    if (error) {
      console.error("[Gmail OAuth Callback] OAuth error from Google:", error, errorDescription);
      
      // Map common errors to user-friendly messages
      let userMessage = error;
      if (error === "access_denied") {
        userMessage = "Gmail connection was cancelled. Please try again if you want to connect Gmail.";
      } else if (error === "invalid_client") {
        userMessage = "Gmail OAuth client configuration error. Please check that GMAIL_CLIENT_ID and redirect URI match Google Cloud Console settings.";
      }
      
      return NextResponse.redirect(
        new URL(
          `/sync?error=${encodeURIComponent(userMessage)}&details=${encodeURIComponent(errorDescription || "")}`,
          baseUrl
        )
      );
    }

    if (!code || !state) {
      console.error("[Gmail OAuth Callback] Missing code or state parameter");
      return NextResponse.redirect(
        new URL("/sync?error=missing_code&details=OAuth callback missing required parameters", baseUrl)
      );
    }

    // Get redirect URI using shared helper to ensure it matches the auth request exactly
    // This MUST match what was used in /api/gmail/auth and what's in Google Cloud Console
    const cleanRedirectUri = getOAuthRedirectUri(
      { url: request.url, headers: request.headers },
      "/api/gmail/callback",
      "GMAIL_REDIRECT_URI"
    );
    
    console.log("[Gmail OAuth Callback] Exchanging code for tokens");
    console.log("  - Redirect URI:", cleanRedirectUri);
    console.log("  - User ID (state):", state.substring(0, 8) + "...");

    // Exchange authorization code for access and refresh tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        redirect_uri: cleanRedirectUri, // Must match exactly what was used in auth request
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[Gmail OAuth Callback] Token exchange failed:", errorData);
      
      let errorMessage = "token_exchange_failed";
      let errorDetails = "";
      
      try {
        const errorJson = JSON.parse(errorData);
        errorMessage = errorJson.error || errorMessage;
        errorDetails = errorJson.error_description || "";
        
        // Log detailed error for debugging (but don't expose secrets)
        console.error("[Gmail OAuth Callback] Token exchange error details:", {
          error: errorJson.error,
          error_description: errorJson.error_description,
          redirect_uri_used: cleanRedirectUri,
          client_id_length: GMAIL_CLIENT_ID.length,
        });
      } catch {
        // If not JSON, use the text (truncated)
        errorMessage = errorData.substring(0, 100);
      }
      
      // Provide helpful error message based on error type
      if (errorMessage.includes("invalid_client")) {
        errorMessage = "Gmail OAuth client configuration error. The Client ID or redirect URI doesn't match Google Cloud Console settings.";
        errorDetails = "Please verify that GMAIL_CLIENT_ID and the redirect URI in your code match what's configured in Google Cloud Console.";
      } else if (errorMessage.includes("invalid_grant")) {
        errorMessage = "Gmail OAuth authorization code expired or already used. Please try connecting Gmail again.";
      }
      
      return NextResponse.redirect(
        new URL(
          `/sync?error=${encodeURIComponent(errorMessage)}&details=${encodeURIComponent(errorDetails)}`,
          baseUrl
        )
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!access_token) {
      console.error("[Gmail OAuth Callback] No access token in response");
      return NextResponse.redirect(
        new URL("/sync?error=no_access_token&details=Google did not return an access token", baseUrl)
      );
    }

    console.log("[Gmail OAuth Callback] Tokens received successfully");
    console.log("  - Has access token:", !!access_token);
    console.log("  - Has refresh token:", !!refresh_token);
    console.log("  - Expires in:", expires_in, "seconds");

    // Store tokens in Supabase
    const supabase = getSupabaseServerClient();
    
    try {
      const expiresAt = expires_in 
        ? new Date(Date.now() + (expires_in * 1000)).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(); // Default to 1 hour if not provided
      
      const { error: dbError } = await supabase
        .from("gmail_connections")
        .upsert({
          user_id: state,
          access_token,
          refresh_token, // Important: store refresh token for token renewal
          expires_at: expiresAt,
          sync_status: "idle",
          sync_error: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (dbError) {
        console.error("[Gmail OAuth Callback] Error storing tokens in database:", dbError);
        // Continue anyway - tokens are valid, user can still use Gmail
        // The connection will work but won't persist across server restarts
      } else {
        console.log("[Gmail OAuth Callback] Tokens stored successfully for user:", state.substring(0, 8) + "...");
        // Note: Initial sync will be triggered automatically on next page load
        // or user can trigger it manually from the UI
      }
    } catch (error) {
      console.error("[Gmail OAuth Callback] Exception storing Gmail tokens:", error);
      // Continue anyway - OAuth was successful, tokens are valid
    }

    // Redirect back to sync page with success
    // Use getBaseUrl() for consistent environment-aware redirect
    return NextResponse.redirect(
      new URL("/sync?gmail_connected=true", baseUrl)
    );
  } catch (error: any) {
    console.error("[Gmail OAuth Callback] Unexpected error:", error);
    const baseUrl = getBaseUrl();
    return NextResponse.redirect(
      new URL(
        `/sync?error=callback_error&details=${encodeURIComponent(error.message || "Unexpected error during OAuth callback")}`,
        baseUrl
      )
    );
  }
}

