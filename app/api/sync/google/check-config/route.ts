import { NextRequest, NextResponse } from "next/server";
import { googleConfig } from "@/lib/config/env";
import { GOOGLE_OAUTH_SCOPES } from "@/lib/sync/googleOAuth";

/**
 * GET /api/sync/google/check-config
 * 
 * Diagnostic endpoint to check Google OAuth configuration
 * Helps troubleshoot "invalid_client" errors
 * 
 * Validates:
 * - Environment variables are set
 * - Redirect URI matches expected values for dev/prod
 * - Configuration is ready for OAuth flow
 */
export async function GET(request: NextRequest) {
  const isProduction = process.env.NODE_ENV === "production";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  
  // Expected redirect URIs based on environment
  const expectedRedirectUrlDev = "http://localhost:3000/api/sync/google/callback";
  const expectedRedirectUrlProd = "https://ovrsee.ai/api/sync/google/callback";
  const expectedRedirectUrl = isProduction ? expectedRedirectUrlProd : expectedRedirectUrlDev;
  
  // Actual redirect URL being used
  const actualRedirectUrl = googleConfig.redirectUrl || 
    `${baseUrl}/api/sync/google/callback`;

  const config = {
    clientId: googleConfig.clientId 
      ? `${googleConfig.clientId.substring(0, 20)}...` 
      : "NOT SET",
    clientSecret: googleConfig.clientSecret 
      ? "***SET***" 
      : "NOT SET",
    redirectUrl: actualRedirectUrl,
    expectedRedirectUrl,
    expectedRedirectUrlDev,
    expectedRedirectUrlProd,
    scopes: GOOGLE_OAUTH_SCOPES,
    hasClientId: !!googleConfig.clientId,
    hasClientSecret: !!googleConfig.clientSecret,
    hasRedirectUrl: !!googleConfig.redirectUrl,
    isConfigured: !!(googleConfig.clientId && googleConfig.clientSecret),
    redirectUriMatches: actualRedirectUrl === expectedRedirectUrl,
  };

  const issues: string[] = [];
  
  if (!config.hasClientId) {
    issues.push("GOOGLE_CLIENT_ID is not set in environment variables");
  }
  
  if (!config.hasClientSecret) {
    issues.push("GOOGLE_CLIENT_SECRET is not set in environment variables");
  }

  if (!config.hasRedirectUrl) {
    issues.push("GOOGLE_OAUTH_REDIRECT_URL is not set (using auto-constructed default)");
  }

  if (!config.redirectUriMatches) {
    issues.push(
      `Redirect URI mismatch: Using "${actualRedirectUrl}" but expected "${expectedRedirectUrl}". ` +
      "Ensure this exact URI is registered in Google Cloud Console."
    );
  }

  return NextResponse.json({
    configured: config.isConfigured && config.redirectUriMatches,
    issues,
    config,
    environment: {
      isProduction,
      nodeEnv: process.env.NODE_ENV,
      baseUrl,
    },
    instructions: config.isConfigured && config.redirectUriMatches ? [
      "✅ Configuration looks good!",
      "",
      "Registered scopes:",
      ...GOOGLE_OAUTH_SCOPES.map(s => `  - ${s}`),
      "",
      "If you're still getting OAuth errors:",
      "1. Verify the Client ID in Google Cloud Console matches your GOOGLE_CLIENT_ID",
      "2. Ensure the redirect URI is added to Google Cloud Console:",
      `   ${actualRedirectUrl}`,
      "3. Make sure the OAuth consent screen is configured",
      "4. Check that the OAuth client type is 'Web application'",
      "5. Ensure all requested scopes are approved in the consent screen",
    ] : [
      "❌ Configuration incomplete or misconfigured",
      "",
      "To fix:",
      "1. Add to your .env.local file:",
      "   GOOGLE_CLIENT_ID=your_client_id_here",
      "   GOOGLE_CLIENT_SECRET=your_client_secret_here",
      `   GOOGLE_OAUTH_REDIRECT_URL=${expectedRedirectUrl}`,
      "",
      "2. Get credentials from Google Cloud Console:",
      "   - Go to https://console.cloud.google.com/apis/credentials",
      "   - Create OAuth 2.0 Client ID (type: Web application)",
      "   - Add authorized redirect URI:",
      `     ${expectedRedirectUrl}`,
      "   - Enable Gmail API and Calendar API in APIs & Services → Library",
      "",
      "3. Restart your dev server after adding env vars",
    ],
  });
}



