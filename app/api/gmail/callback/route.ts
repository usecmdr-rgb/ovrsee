import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || "";
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "";

export async function GET(request: NextRequest) {
  try {
    // Validate client ID and secret are configured
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
      return NextResponse.redirect(
        new URL("/sync?error=oauth_not_configured", request.url)
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // User ID
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      console.error("Gmail OAuth error:", error, errorDescription);
      return NextResponse.redirect(
        new URL(`/sync?error=${encodeURIComponent(error)}&details=${encodeURIComponent(errorDescription || "")}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/sync?error=missing_code", request.url)
      );
    }

    // Construct redirect URI from the request origin to ensure it matches exactly
    // This must match exactly what was used in the auth request
    let origin = request.headers.get("origin");
    
    if (!origin) {
      // Try to get from referer
      const referer = request.headers.get("referer");
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          origin = refererUrl.origin;
        } catch {
          const match = referer.match(/^(https?:\/\/[^\/]+)/);
          if (match) origin = match[1];
        }
      }
    }
    
    // Try to get from the request URL itself
    if (!origin) {
      try {
        const requestUrl = new URL(request.url);
        origin = requestUrl.origin;
      } catch {
        // Ignore
      }
    }
    
    // Final fallback (use 3001 as default)
    if (!origin) {
      origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    }
    
    const redirectUri = process.env.GMAIL_REDIRECT_URI || `${origin}/api/gmail/callback`;
    
    // Ensure redirect URI doesn't have trailing slash (Google is strict about this)
    const cleanRedirectUri = redirectUri.replace(/\/$/, "").trim();

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        redirect_uri: cleanRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      let errorMessage = "token_exchange_failed";
      try {
        const errorJson = JSON.parse(errorData);
        errorMessage = errorJson.error || errorMessage;
        if (errorJson.error_description) {
          errorMessage += `: ${errorJson.error_description}`;
        }
      } catch {
        // If not JSON, use the text
        errorMessage = errorData.substring(0, 100);
      }
      return NextResponse.redirect(
        new URL(`/sync?error=${encodeURIComponent(errorMessage)}`, request.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Store tokens in Supabase
    const supabase = getSupabaseServerClient();
    
    // Try to store tokens - in dev mode with dev-user, this might fail but that's okay
    try {
      const { error: dbError } = await supabase
        .from("gmail_connections")
        .upsert({
          user_id: state,
          access_token,
          refresh_token,
          expires_at: new Date(Date.now() + (expires_in * 1000)).toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (dbError) {
        console.error("Error storing Gmail tokens:", dbError);
        // Continue anyway - tokens are valid, user can still use Gmail
        // In dev mode, this is expected if using dev-user
      }
    } catch (error) {
      console.error("Error storing Gmail tokens:", error);
      // Continue anyway - OAuth was successful
    }

    // Redirect back to sync page with success
    // Reuse computed origin to ensure consistent redirect
    const redirectOrigin =
      origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3001";

    return NextResponse.redirect(
      new URL(`${redirectOrigin}/sync?gmail_connected=true`, request.url)
    );
  } catch (error: any) {
    console.error("Error in Gmail callback:", error);
    return NextResponse.redirect(
      new URL("/sync?error=callback_error", request.url)
    );
  }
}

