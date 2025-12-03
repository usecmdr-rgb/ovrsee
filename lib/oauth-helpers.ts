/**
 * Helper functions for OAuth redirect URI construction
 * Ensures consistency between auth request and callback
 * 
 * IMPORTANT: This is separate from Supabase Google authentication.
 * - Supabase Google login uses Supabase's own OAuth client (configured in Supabase dashboard)
 * - Gmail OAuth uses GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET (configured in Google Cloud Console)
 * 
 * These are two different OAuth clients and should NOT be mixed.
 */

import { getBaseUrl } from "@/lib/auth/getBaseUrl";

/**
 * Gets the redirect URI for OAuth callbacks
 * This function ensures the redirect URI is constructed consistently
 * across auth requests and callbacks
 * 
 * Priority:
 * 1. Explicit GMAIL_REDIRECT_URI env var (if provided)
 * 2. Request origin (from URL or headers)
 * 3. getBaseUrl() helper (uses NEXT_PUBLIC_APP_URL or environment-based defaults)
 * 
 * For Gmail OAuth, the redirect URI must match EXACTLY what's configured in Google Cloud Console:
 * - Development: http://localhost:3000/api/gmail/callback
 * - Production: https://ovrsee.ai/api/gmail/callback
 * 
 * Google Cloud Console Setup Checklist:
 * 
 * 1. Go to https://console.cloud.google.com/apis/credentials
 * 2. Create or select OAuth 2.0 Client ID (type: "Web application")
 * 3. Enable Gmail API:
 *    - Go to APIs & Services → Library
 *    - Search for "Gmail API" → Click "Enable"
 * 4. Add authorized redirect URIs (EXACT match required, no trailing slashes):
 *    - Development: http://localhost:3000/api/gmail/callback
 *    - Production: https://ovrsee.ai/api/gmail/callback
 * 5. Copy Client ID and Client Secret
 * 6. Set in .env.local:
 *    - GMAIL_CLIENT_ID=1077385431224-armgjmsn38f1mj23m5l1q8j274ch80p2.apps.googleusercontent.com
 *    - GMAIL_CLIENT_SECRET=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
 *    - NEXT_PUBLIC_APP_URL=http://localhost:3000
 * 7. Restart dev server after updating env vars
 * 
 * The redirect URI is constructed as: ${getBaseUrl()}/api/gmail/callback
 * Verify by visiting /api/gmail/check-config to see the exact redirect URI being used
 */
export function getOAuthRedirectUri(
  request: { url: string; headers: Headers },
  callbackPath: string,
  envVarName?: string
): string {
  // First, check if explicit redirect URI is set in environment
  if (envVarName && process.env[envVarName]) {
    const envUri = process.env[envVarName]?.trim();
    if (envUri) {
      return envUri.replace(/\/$/, ""); // Remove trailing slash
    }
  }

  // Try to get origin from request URL (most reliable)
  let origin: string | null = null;
  
  try {
    const requestUrl = new URL(request.url);
    origin = requestUrl.origin;
  } catch {
    // If that fails, try headers
  }

  // Fallback to origin header
  if (!origin) {
    origin = request.headers.get("origin");
  }

  // Fallback to referer header
  if (!origin) {
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

  // Final fallback: use getBaseUrl() but default to port 3000 for development
  if (!origin) {
    // For development, default to port 3000 to match Google Cloud Console
    if (process.env.NODE_ENV === 'development') {
      origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    } else {
      origin = getBaseUrl();
    }
  }

  // Construct redirect URI
  const redirectUri = `${origin}${callbackPath}`;
  
  // Remove trailing slash and trim (Google is strict about this)
  return redirectUri.replace(/\/$/, "").trim();
}

