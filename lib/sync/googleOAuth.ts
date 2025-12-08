/**
 * Google OAuth helper for Sync integration
 * Handles OAuth flow for Gmail and Calendar access
 */

import { googleConfig } from "@/lib/config/env";
import { createHmac } from "crypto";

/**
 * Google OAuth scopes for Sync agent
 * - openid: Required to get ID token (contains user email)
 * - gmail.readonly: Read emails and metadata
 * - gmail.send: Send emails on behalf of user
 * - calendar: Full calendar access (read/write events)
 */
export const GOOGLE_OAUTH_SCOPES = [
  "openid", // Required for ID token (contains email, avoids userinfo API call)
  "https://www.googleapis.com/auth/userinfo.email", // User email
  "https://www.googleapis.com/auth/userinfo.profile", // User profile
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
] as const;

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

  const redirectUrl = googleConfig.redirectUrl;
  if (!redirectUrl) {
    throw new Error("GOOGLE_OAUTH_REDIRECT_URL is not configured (could not auto-construct)");
  }

  const state = signState({
    workspaceId: params.workspaceId,
    userId: params.userId,
    returnTo: params.returnTo,
  });

  const scopes = GOOGLE_OAUTH_SCOPES.join(" ");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", googleConfig.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("access_type", "offline"); // Required for refresh token
  authUrl.searchParams.set("prompt", "consent"); // Force consent to get refresh token
  authUrl.searchParams.set("state", state);

  return authUrl.toString();
}

/**
 * Exchange authorization code for access and refresh tokens
 * 
 * IMPORTANT: Google only returns refresh_token when:
 * - access_type=offline is set (✅ we do this)
 * - prompt=consent is set (✅ we do this)
 * - User grants consent (first time or after revocation)
 * 
 * If refresh_token is not returned, we return empty string (caller should preserve existing)
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null; // null if not provided (preserve existing)
  expiresAt: Date | null;
  scope: string[];
  idToken?: string;
}> {
  if (!googleConfig.clientId || !googleConfig.clientSecret) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const redirectUrl = googleConfig.redirectUrl;
  if (!redirectUrl) {
    throw new Error("GOOGLE_OAUTH_REDIRECT_URL is not configured (could not auto-construct)");
  }

  const tokenUrl = "https://oauth2.googleapis.com/token";
  const params = new URLSearchParams({
    client_id: googleConfig.clientId,
    client_secret: googleConfig.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUrl,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Google OAuth] Token exchange failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      clientId: googleConfig.clientId?.substring(0, 30) + "...",
      redirectUrl,
    });
    throw new Error(`Failed to exchange code for tokens: ${errorText}`);
  }

  const data = await response.json();
  console.log("[Google OAuth] Token exchange raw response keys:", Object.keys(data));

  // Validate that we got an access token
  if (!data.access_token) {
    console.error("[Google OAuth] Token exchange response missing access_token:", {
      keys: Object.keys(data),
      error: data.error,
      error_description: data.error_description,
      fullResponse: JSON.stringify(data, null, 2),
    });
    throw new Error(
      `Token exchange failed: No access token in response. Response keys: ${Object.keys(data).join(", ")}. Error: ${data.error || "none"}`
    );
  }

  // Validate access token is not empty
  if (data.access_token.trim() === "") {
    console.error("[Google OAuth] Access token is empty string!");
    throw new Error("Token exchange returned empty access token");
  }

  // Log token exchange success (without exposing sensitive data)
  console.log("[Google OAuth] Token exchange successful:", {
    hasAccessToken: !!data.access_token,
    accessTokenLength: data.access_token?.length,
    hasRefreshToken: !!data.refresh_token,
    hasIdToken: !!data.id_token,
    idTokenLength: data.id_token?.length,
    expiresIn: data.expires_in,
    scope: data.scope,
    tokenType: data.token_type,
  });

  // Refresh token may not be returned if user already granted access
  // Return null instead of undefined to distinguish from missing response
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
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
export async function getGoogleUserEmail(
  accessToken: string,
  idToken?: string
): Promise<string> {
  // Validate access token
  if (!accessToken || accessToken.trim() === "") {
    throw new Error("Access token is missing or empty");
  }

  // Try ID token first (contains email, no API call needed)
  if (idToken && idToken.trim() !== "") {
    try {
      console.log("[Google OAuth] Attempting to decode ID token...");
      // Decode JWT (base64url decode the payload)
      const parts = idToken.split(".");
      if (parts.length === 3) {
        // JWT uses base64url encoding (no padding), but Buffer.from needs padding
        // Convert base64url to base64 by adding padding
        let payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        while (payloadBase64.length % 4) {
          payloadBase64 += "=";
        }
        
        const payload = JSON.parse(
          Buffer.from(payloadBase64, "base64").toString("utf-8")
        );
        
        console.log("[Google OAuth] ID token decoded successfully:", {
          hasEmail: !!payload.email,
          email: payload.email,
          aud: payload.aud,
          iss: payload.iss,
        });
        
        if (payload.email) {
          console.log("[Google OAuth] Got email from ID token:", payload.email);
          return payload.email;
        } else {
          console.warn("[Google OAuth] ID token does not contain email");
        }
      } else {
        console.warn("[Google OAuth] ID token has invalid format (not 3 parts)");
      }
    } catch (error: any) {
      console.warn("[Google OAuth] Failed to decode ID token, falling back to userinfo:", {
        error: error.message,
        idTokenLength: idToken?.length,
        idTokenPrefix: idToken?.substring(0, 30) + "...",
      });
    }
  } else {
    console.log("[Google OAuth] No ID token provided, using userinfo endpoint");
  }

  // Fallback to userinfo endpoint
  console.log("[Google OAuth] Fetching user info from Google API...");
  console.log("[Google OAuth] Access token details:", {
    length: accessToken.length,
    startsWith: accessToken.substring(0, 10),
    endsWith: accessToken.substring(accessToken.length - 10),
    fullToken: accessToken, // Log full token for debugging
  });
  
  const userinfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo";
  const authHeader = `Bearer ${accessToken}`;
  console.log("[Google OAuth] Authorization header:", {
    length: authHeader.length,
    preview: authHeader.substring(0, 30) + "...",
  });
  
  const response = await fetch(userinfoUrl, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    // Get error details for debugging
    let errorDetails = "";
    try {
      const errorData = await response.json();
      errorDetails = JSON.stringify(errorData);
    } catch {
      errorDetails = await response.text();
    }
    
    console.error("[Google OAuth] Failed to fetch user info:", {
      status: response.status,
      statusText: response.statusText,
      errorDetails,
      accessTokenLength: accessToken?.length,
      accessTokenPrefix: accessToken?.substring(0, 30) + "...",
      accessTokenSuffix: "..." + accessToken?.substring(accessToken.length - 10),
    });
    
    throw new Error(
      `Failed to fetch user info from Google: ${response.status} ${response.statusText}. ${errorDetails}`
    );
  }

  const data = await response.json();
  if (!data.email) {
    console.error("[Google OAuth] User info response missing email:", data);
    throw new Error("Email not found in Google user info");
  }

  console.log("[Google OAuth] Got email from userinfo endpoint:", data.email);
  return data.email;
}

/**
 * Verify and decode OAuth state (exported for use in callbacks)
 */
export function decodeOAuthState(signedState: string): OAuthState {
  return verifyState(signedState);
}



