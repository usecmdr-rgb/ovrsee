/**
 * Google OAuth helper for Sync integration
 * Handles OAuth flow for Gmail and Calendar access
 */

import { googleConfig } from "@/lib/config/env";
import { createHmac } from "crypto";

/**
 * State payload for OAuth flow
 */
interface OAuthState {
  workspaceId: string;
  userId: string;
  returnTo?: string;
}

/**
 * Get secret for signing state (uses AUTH_SECRET or JWT_SECRET)
 */
function getStateSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET or JWT_SECRET must be at least 32 characters for OAuth state signing"
    );
  }
  return secret;
}

/**
 * Sign and encode OAuth state
 */
function signState(state: OAuthState): string {
  const secret = getStateSecret();
  const payload = JSON.stringify(state);
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${signature}`;
}

/**
 * Verify and decode OAuth state
 */
function verifyState(signedState: string): OAuthState {
  const secret = getStateSecret();
  const [encoded, signature] = signedState.split(".");
  
  if (!encoded || !signature) {
    throw new Error("Invalid state format");
  }

  const payload = Buffer.from(encoded, "base64url").toString("utf-8");
  const expectedSignature = createHmac("sha256", secret).update(payload).digest("hex");

  if (signature !== expectedSignature) {
    throw new Error("Invalid state signature");
  }

  return JSON.parse(payload) as OAuthState;
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(params: {
  workspaceId: string;
  userId: string;
  returnTo?: string;
}): string {
  if (!googleConfig.clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  if (!googleConfig.redirectUrl) {
    throw new Error("GOOGLE_OAUTH_REDIRECT_URL is not configured");
  }

  const state = signState({
    workspaceId: params.workspaceId,
    userId: params.userId,
    returnTo: params.returnTo,
  });

  const scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
  ].join(" ");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", googleConfig.clientId);
  authUrl.searchParams.set("redirect_uri", googleConfig.redirectUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("access_type", "offline"); // Required for refresh token
  authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token
  authUrl.searchParams.set("state", state);

  return authUrl.toString();
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date | null;
  scope: string[];
  idToken?: string;
}> {
  if (!googleConfig.clientId || !googleConfig.clientSecret) {
    throw new Error("Google OAuth credentials are not configured");
  }

  if (!googleConfig.redirectUrl) {
    throw new Error("GOOGLE_OAUTH_REDIRECT_URL is not configured");
  }

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const params = new URLSearchParams({
    client_id: googleConfig.clientId,
    client_secret: googleConfig.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: googleConfig.redirectUrl,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : null,
    scope: data.scope ? data.scope.split(" ") : [],
    idToken: data.id_token,
  };
}

/**
 * Get user email from Google ID token or userinfo endpoint
 */
export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  // Try userinfo endpoint first
  const userinfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
  const response = await fetch(userinfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch user info from Google");
  }

  const data = await response.json();
  if (!data.email) {
    throw new Error("Email not found in Google user info");
  }

  return data.email;
}

/**
 * Verify and decode OAuth state (exported for use in callbacks)
 */
export function decodeOAuthState(signedState: string): OAuthState {
  return verifyState(signedState);
}



