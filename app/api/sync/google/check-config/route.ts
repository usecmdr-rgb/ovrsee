import { NextRequest, NextResponse } from "next/server";
import { googleConfig } from "@/lib/config/env";

/**
 * GET /api/sync/google/check-config
 * 
 * Diagnostic endpoint to check Google OAuth configuration
 * Helps troubleshoot "invalid_client" errors
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  
  const expectedRedirectUrl = googleConfig.redirectUrl || 
    `${baseUrl}/api/sync/google/callback`;

  const config = {
    clientId: googleConfig.clientId 
      ? `${googleConfig.clientId.substring(0, 20)}...` 
      : "NOT SET",
    clientSecret: googleConfig.clientSecret 
      ? "***SET***" 
      : "NOT SET",
    redirectUrl: expectedRedirectUrl,
    hasClientId: !!googleConfig.clientId,
    hasClientSecret: !!googleConfig.clientSecret,
    hasRedirectUrl: !!googleConfig.redirectUrl,
    isConfigured: !!(googleConfig.clientId && googleConfig.clientSecret),
  };

  const issues: string[] = [];
  
  if (!config.hasClientId) {
    issues.push("GOOGLE_CLIENT_ID is not set in environment variables");
  }
  
  if (!config.hasClientSecret) {
    issues.push("GOOGLE_CLIENT_SECRET is not set in environment variables");
  }

  if (!config.hasRedirectUrl) {
    issues.push("GOOGLE_OAUTH_REDIRECT_URL is not set (using default)");
  }

  return NextResponse.json({
    configured: config.isConfigured,
    issues,
    config,
    instructions: config.isConfigured ? [
      "✅ Configuration looks good!",
      "",
      "If you're still getting 'invalid_client' errors:",
      "1. Verify the Client ID in Google Cloud Console matches your GOOGLE_CLIENT_ID",
      "2. Ensure the redirect URI is added to Google Cloud Console:",
      `   ${expectedRedirectUrl}`,
      "3. Make sure the OAuth consent screen is configured",
      "4. Check that the OAuth client type is 'Web application'",
    ] : [
      "❌ Configuration incomplete",
      "",
      "To fix:",
      "1. Add to your .env.local file:",
      "   GOOGLE_CLIENT_ID=your_client_id_here",
      "   GOOGLE_CLIENT_SECRET=your_client_secret_here",
      "   GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/sync/google/callback",
      "",
      "2. Get credentials from Google Cloud Console:",
      "   - Go to https://console.cloud.google.com/apis/credentials",
      "   - Create OAuth 2.0 Client ID (Web application)",
      "   - Add authorized redirect URI:",
      `     ${expectedRedirectUrl}`,
      "",
      "3. Restart your dev server after adding env vars",
    ],
  });
}



