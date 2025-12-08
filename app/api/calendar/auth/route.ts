import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getOAuthRedirectUri } from "@/lib/oauth-helpers";

/**
 * ⚠️ DEPRECATED: This route is deprecated. Use /api/sync/google/oauth-url instead.
 * 
 * This legacy endpoint is kept for backward compatibility but should not be used for new integrations.
 * The unified Google OAuth flow at /api/sync/google/* provides:
 * - Combined Gmail + Calendar authorization
 * - Better token management in integrations table
 * - Consistent error handling
 * 
 * This endpoint will return 410 Gone.
 */
// Google Calendar OAuth configuration
const CALENDAR_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || "";
const CALENDAR_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || "";

export async function GET(request: NextRequest) {
  // Deprecation: Return error directing to unified route
  return NextResponse.json(
    {
      error: "DEPRECATED",
      message: "This endpoint is deprecated. Use /api/sync/google/oauth-url instead.",
      migration: {
        oldRoute: "/api/calendar/auth",
        newRoute: "/api/sync/google/oauth-url",
        reason: "Unified Google OAuth flow supports both Gmail and Calendar with better token management",
        documentation: "See GOOGLE_OAUTH_COMPREHENSIVE_AUDIT.md for migration guide",
      },
    },
    { status: 410 } // 410 Gone
  );

  /* LEGACY CODE BELOW - Not executed but kept for reference
  try {
    // Validate client ID is configured
    if (!CALENDAR_CLIENT_ID || CALENDAR_CLIENT_ID === "your_google_client_id_here" || CALENDAR_CLIENT_ID.includes("your_")) {
      return NextResponse.json(
        { 
          error: "Calendar OAuth is not configured",
          details: "GOOGLE_CLIENT_ID or GMAIL_CLIENT_ID is not set or contains placeholder value. Please set a valid Client ID from Google Cloud Console.",
          setupRequired: true
        },
        { status: 500 }
      );
    }
    
    // Validate client ID format
    if (CALENDAR_CLIENT_ID.length < 20) {
      return NextResponse.json(
        { 
          error: "Invalid Calendar Client ID",
          details: "GOOGLE_CLIENT_ID or GMAIL_CLIENT_ID appears to be invalid (too short). Please check your .env.local file.",
          setupRequired: true
        },
        { status: 500 }
      );
    }

    const supabase = getSupabaseServerClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Unauthorized", details: "Please log in to connect Calendar." },
        { status: 401 }
      );
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return NextResponse.json(
        { error: "Unauthorized", details: "Invalid authentication token." },
        { status: 401 }
      );
    }

    const userId = userResult.user.id;

    // Get redirect URI using shared helper to ensure consistency
    const cleanRedirectUri = getOAuthRedirectUri(
      { url: request.url, headers: request.headers },
      "/api/calendar/callback",
      "CALENDAR_REDIRECT_URI"
    );
    
    // Validate redirect URI format
    try {
      new URL(cleanRedirectUri);
    } catch {
      return NextResponse.json(
        { 
          error: "Invalid redirect URI configuration",
          details: `Redirect URI "${cleanRedirectUri}" is not a valid URL. Please set CALENDAR_REDIRECT_URI in environment variables.`
        },
        { status: 500 }
      );
    }

    // Generate OAuth URL
    const scopes = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", CALENDAR_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", cleanRedirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", userId);
    
    // Log the exact redirect URI being used for debugging
    console.log("[Calendar OAuth] Redirect URI being used:", cleanRedirectUri);
    console.log("[Calendar OAuth] Client ID:", CALENDAR_CLIENT_ID.substring(0, 20) + "...");

    // Log for debugging (remove in production)
    if (process.env.NODE_ENV !== "production") {
      console.log("Calendar OAuth URL generated:", {
        clientId: CALENDAR_CLIENT_ID ? "***configured***" : "MISSING",
        redirectUri: cleanRedirectUri,
        userId,
      });
    }

    return NextResponse.json({
      ok: true,
      authUrl: authUrl.toString(),
      redirectUri: cleanRedirectUri, // Return for debugging
    });
  } catch (error: any) {
    console.error("Error generating Calendar auth URL:", error);
    return NextResponse.json(
      { error: "Failed to generate auth URL", details: error.message },
      { status: 500 }
    );
  }
  */
}

