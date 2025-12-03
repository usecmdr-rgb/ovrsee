import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getOAuthRedirectUri } from "@/lib/oauth-helpers";

/**
 * Gmail OAuth Authorization Endpoint
 * 
 * This endpoint generates the Google OAuth authorization URL for Gmail integration.
 * 
 * IMPORTANT: This is SEPARATE from Supabase Google authentication:
 * - Supabase Google login: Uses Supabase's OAuth client (configured in Supabase dashboard)
 * - Gmail OAuth: Uses GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET (configured in Google Cloud Console)
 * 
 * These are two different OAuth clients and should NOT be mixed.
 * 
 * Google Cloud Console Setup Checklist:
 * 
 * 1. Go to https://console.cloud.google.com/apis/credentials
 * 2. Create or select OAuth 2.0 Client ID
 * 3. Application type: "Web application"
 * 4. Enable Gmail API in the project:
 *    - Go to APIs & Services → Library
 *    - Search for "Gmail API"
 *    - Click "Enable"
 * 5. Add authorized redirect URIs (EXACT match required, no trailing slashes):
 *    - Development: http://localhost:3000/api/gmail/callback
 *    - Production: https://ovrsee.ai/api/gmail/callback
 * 6. Copy Client ID and Client Secret from the OAuth client
 * 7. Set in .env.local:
 *    - GMAIL_CLIENT_ID=1077385431224-armgjmsn38f1mj23m5l1q8j274ch80p2.apps.googleusercontent.com
 *    - GMAIL_CLIENT_SECRET=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
 *    - NEXT_PUBLIC_APP_URL=http://localhost:3000
 * 8. Restart dev server after updating env vars (env vars only load on server start)
 * 
 * IMPORTANT: The redirect URI in Google Cloud Console MUST match exactly what this code generates.
 * The code uses getBaseUrl() to construct: ${getBaseUrl()}/api/gmail/callback
 * Verify the redirect URI by visiting /api/gmail/check-config
 * 
 * Scopes requested:
 * - https://www.googleapis.com/auth/gmail.readonly (read emails)
 * - https://www.googleapis.com/auth/gmail.modify (modify emails, send, etc.)
 */

// Gmail OAuth configuration - validate at module load time
function getGmailClientId(): string {
  const clientId = process.env.GMAIL_CLIENT_ID || "";
  
  // Fail loudly if missing or placeholder
  if (!clientId || clientId === "your_gmail_client_id_here" || clientId.includes("your_")) {
    throw new Error(
      "GMAIL_CLIENT_ID is not configured. " +
      "Please set GMAIL_CLIENT_ID in your .env.local file with a valid Client ID from Google Cloud Console. " +
      "See app/api/gmail/auth/route.ts for setup instructions."
    );
  }
  
  // Validate format (should be 50+ characters, ends with .apps.googleusercontent.com)
  if (clientId.length < 20) {
    throw new Error(
      `GMAIL_CLIENT_ID appears invalid (too short: ${clientId.length} chars). ` +
      "Expected format: <numbers>-<string>.apps.googleusercontent.com"
    );
  }
  
  return clientId;
}

function getGmailClientSecret(): string {
  const secret = process.env.GMAIL_CLIENT_SECRET || "";
  
  // Fail loudly if missing or placeholder
  if (!secret || secret === "your_gmail_client_secret_here" || secret.includes("your_")) {
    throw new Error(
      "GMAIL_CLIENT_SECRET is not configured. " +
      "Please set GMAIL_CLIENT_SECRET in your .env.local file with a valid Client Secret from Google Cloud Console. " +
      "See app/api/gmail/auth/route.ts for setup instructions."
    );
  }
  
  // Validate format (should be 20+ characters)
  if (secret.length < 20) {
    throw new Error(
      `GMAIL_CLIENT_SECRET appears invalid (too short: ${secret.length} chars). ` +
      "Please check your .env.local file."
    );
  }
  
  return secret;
}

export async function GET(request: NextRequest) {
  try {
    // Validate and get client ID (throws if invalid)
    let GMAIL_CLIENT_ID: string;
    try {
      GMAIL_CLIENT_ID = getGmailClientId();
    } catch (error: any) {
      console.error("[Gmail OAuth] Configuration error:", error.message);
      return NextResponse.json(
        { 
          error: "Gmail OAuth is not configured",
          details: error.message,
          setupRequired: true
        },
        { status: 500 }
      );
    }
    
    // Log client ID info for debugging (not the full value)
    console.log("[Gmail OAuth] Client ID configured:", GMAIL_CLIENT_ID.substring(0, 20) + "...");
    console.log("[Gmail OAuth] Client ID length:", GMAIL_CLIENT_ID.length);
    console.log("[Gmail OAuth] Client ID format valid:", GMAIL_CLIENT_ID.includes(".apps.googleusercontent.com"));

    const supabase = getSupabaseServerClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();
    const userIdHeader = request.headers.get("x-user-id");

    // Get userId - require authentication
    let userId: string;
    
    if (!accessToken || accessToken === "dev-token") {
      return NextResponse.json(
        { error: "Unauthorized", details: "Please log in to connect Gmail." },
        { status: 401 }
      );
    }

    if (userIdHeader) {
      // Verify the user ID matches the authenticated user
      const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
      if (userError || !userResult?.user) {
        return NextResponse.json(
          { error: "Unauthorized", details: "Invalid authentication token." },
          { status: 401 }
        );
      }
      // Use userId from header if it matches authenticated user
      if (userIdHeader === userResult.user.id) {
        userId = userIdHeader;
      } else {
        userId = userResult.user.id;
      }
    } else {
      // Get userId from auth token
      const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
      if (userError || !userResult?.user) {
        return NextResponse.json(
          { error: "Unauthorized", details: "Invalid authentication token." },
          { status: 401 }
        );
      }
      userId = userResult.user.id;
    }

    // Get redirect URI using shared helper to ensure consistency
    // This uses getBaseUrl() internally for environment-aware URL resolution
    const cleanRedirectUri = getOAuthRedirectUri(
      { url: request.url, headers: request.headers },
      "/api/gmail/callback",
      "GMAIL_REDIRECT_URI"
    );
    
    // Validate redirect URI format
    try {
      new URL(cleanRedirectUri);
    } catch {
      return NextResponse.json(
        { 
          error: "Invalid redirect URI configuration",
          details: `Redirect URI "${cleanRedirectUri}" is not a valid URL. ` +
                   `Please set GMAIL_REDIRECT_URI in environment variables or ensure NEXT_PUBLIC_APP_URL is set correctly.`
        },
        { status: 500 }
      );
    }

    // Generate OAuth URL with Gmail scopes
    // Scopes requested:
    // - gmail.readonly: Read emails and metadata
    // - gmail.modify: Modify emails, send, delete, etc.
    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GMAIL_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", cleanRedirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline"); // Required for refresh token
    authUrl.searchParams.set("prompt", "consent"); // Force consent screen to get refresh token
    authUrl.searchParams.set("state", userId); // Pass user ID in state for callback
    
    // Log configuration for debugging (never log full secrets)
    console.log("[Gmail OAuth] Configuration:");
    console.log("  - Client ID:", GMAIL_CLIENT_ID.substring(0, 20) + "... (length: " + GMAIL_CLIENT_ID.length + ")");
    console.log("  - Redirect URI:", cleanRedirectUri);
    console.log("  - Scopes:", scopes);
    console.log("  - User ID:", userId.substring(0, 8) + "...");
    
    // Additional debug info in development
    if (process.env.NODE_ENV !== "production") {
      console.log("[Gmail OAuth] Full auth URL:", authUrl.toString().replace(GMAIL_CLIENT_ID, "CLIENT_ID_REDACTED"));
    }

    return NextResponse.json({
      ok: true,
      authUrl: authUrl.toString(),
      redirectUri: cleanRedirectUri, // Return for debugging
    });
  } catch (error: any) {
    console.error("Error generating Gmail auth URL:", error);
    return NextResponse.json(
      { error: "Failed to generate auth URL", details: error.message },
      { status: 500 }
    );
  }
}

