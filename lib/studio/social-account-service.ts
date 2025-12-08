/**
 * Social Account Service
 * 
 * Central abstraction for workspace-scoped social media accounts.
 * Provides secure access to tokens and account information.
 * 
 * All social accounts are workspace-scoped, not user-scoped.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SocialPlatform = "instagram" | "tiktok" | "facebook";

export interface SocialAccountCredentials {
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string[];
}

export interface SocialAccount {
  id: string;
  workspace_id: string;
  platform: SocialPlatform;
  status: "disconnected" | "connected" | "error";
  external_account_id: string | null;
  handle: string | null;
  avatar_url: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  metadata: Record<string, any>;
  // Credentials (only available via getCredentials)
  credentials?: SocialAccountCredentials;
}

/**
 * Get social account for a workspace and platform
 * Returns account metadata (no tokens) unless includeCredentials is true
 */
export async function getSocialAccount(
  workspaceId: string,
  platform: SocialPlatform,
  options: {
    includeCredentials?: boolean;
    supabaseClient?: SupabaseClient;
  } = {}
): Promise<SocialAccount | null> {
  const supabase = options.supabaseClient || getSupabaseServerClient();

  const { data: account, error } = await supabase
    .from("studio_social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("platform", platform)
    .single();

  if (error || !account) {
    return null;
  }

  const result: SocialAccount = {
    id: account.id,
    workspace_id: account.workspace_id,
    platform: account.platform,
    status: account.status,
    external_account_id: account.external_account_id,
    handle: account.handle,
    avatar_url: account.avatar_url,
    connected_at: account.connected_at,
    last_sync_at: account.last_sync_at,
    metadata: account.metadata || {},
  };

  if (options.includeCredentials) {
    result.credentials = {
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expires_at: account.expires_at,
      scopes: account.scopes || [],
    };
  }

  return result;
}

/**
 * Get credentials for a social account (service role only)
 * This should only be called from server-side code with service role client
 */
export async function getSocialAccountCredentials(
  workspaceId: string,
  platform: SocialPlatform,
  supabaseClient?: SupabaseClient
): Promise<SocialAccountCredentials | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: account, error } = await supabase
    .from("studio_social_accounts")
    .select("access_token, refresh_token, expires_at, scopes")
    .eq("workspace_id", workspaceId)
    .eq("platform", platform)
    .single();

  if (error || !account || !account.access_token) {
    return null;
  }

  return {
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expires_at: account.expires_at,
    scopes: account.scopes || [],
  };
}

/**
 * Get all social accounts for a workspace
 */
export async function getSocialAccounts(
  workspaceId: string,
  options: {
    includeCredentials?: boolean;
    supabaseClient?: SupabaseClient;
  } = {}
): Promise<SocialAccount[]> {
  const supabase = options.supabaseClient || getSupabaseServerClient();

  const { data: accounts, error } = await supabase
    .from("studio_social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("platform", { ascending: true });

  if (error || !accounts) {
    return [];
  }

  return accounts.map((account) => {
    const result: SocialAccount = {
      id: account.id,
      workspace_id: account.workspace_id,
      platform: account.platform,
      status: account.status,
      external_account_id: account.external_account_id,
      handle: account.handle,
      avatar_url: account.avatar_url,
      connected_at: account.connected_at,
      last_sync_at: account.last_sync_at,
      metadata: account.metadata || {},
    };

    if (options.includeCredentials) {
      result.credentials = {
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        expires_at: account.expires_at,
        scopes: account.scopes || [],
      };
    }

    return result;
  });
}

/**
 * Create or update a social account with credentials
 * Used by OAuth callbacks
 */
export async function upsertSocialAccount(
  workspaceId: string,
  platform: SocialPlatform,
  data: {
    external_account_id: string;
    handle?: string | null;
    avatar_url?: string | null;
    access_token: string;
    refresh_token?: string | null;
    expires_at?: string | null;
    scopes?: string[];
    metadata?: Record<string, any>;
    connected_by: string;
  },
  supabaseClient?: SupabaseClient
): Promise<SocialAccount | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: account, error } = await supabase
    .from("studio_social_accounts")
    .upsert(
      {
        workspace_id: workspaceId,
        platform,
        status: "connected",
        external_account_id: data.external_account_id,
        handle: data.handle,
        avatar_url: data.avatar_url,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        scopes: data.scopes || [],
        connected_at: new Date().toISOString(),
        connected_by: data.connected_by,
        metadata: data.metadata || {},
      },
      {
        onConflict: "workspace_id,platform",
      }
    )
    .select()
    .single();

  if (error || !account) {
    console.error("Error upserting social account:", error);
    return null;
  }

  return {
    id: account.id,
    workspace_id: account.workspace_id,
    platform: account.platform,
    status: account.status,
    external_account_id: account.external_account_id,
    handle: account.handle,
    avatar_url: account.avatar_url,
    connected_at: account.connected_at,
    last_sync_at: account.last_sync_at,
    metadata: account.metadata || {},
  };
}

/**
 * Update account tokens (for refresh flows)
 */
export async function updateSocialAccountTokens(
  workspaceId: string,
  platform: SocialPlatform,
  tokens: {
    access_token: string;
    refresh_token?: string | null;
    expires_at?: string | null;
  },
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { error } = await supabase
    .from("studio_social_accounts")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("platform", platform);

  return !error;
}

/**
 * Update last_sync_at timestamp
 */
export async function updateSocialAccountLastSync(
  workspaceId: string,
  platform: SocialPlatform,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { error } = await supabase
    .from("studio_social_accounts")
    .update({
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("platform", platform);

  return !error;
}

/**
 * Check if token is expired or will expire soon
 */
export function isTokenExpired(expiresAt: string | null, bufferMinutes: number = 5): boolean {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  const now = new Date();
  return expiry.getTime() - now.getTime() < bufferMinutes * 60 * 1000;
}

/**
 * Ensure access token is fresh (refresh if needed)
 * 
 * If token expires within 24 hours and refresh is supported, attempts to refresh.
 * Returns the current or refreshed access token.
 * 
 * @throws TokenExpiredError if token is expired and cannot be refreshed
 */
export async function ensureFreshAccessToken(
  account: SocialAccount,
  supabaseClient?: SupabaseClient
): Promise<string> {
  const supabase = supabaseClient || getSupabaseServerClient();
  
  // Get credentials
  const credentials = await getSocialAccountCredentials(
    account.workspace_id,
    account.platform,
    supabase
  );

  if (!credentials || !credentials.access_token) {
    throw new Error(`No access token found for ${account.platform}`);
  }

  // Check if token expires within 24 hours
  const expiresAt = credentials.expires_at;
  if (!expiresAt) {
    // No expiry info - return current token (some platforms don't expire)
    return credentials.access_token;
  }

  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // If token is good for more than 24 hours, return as-is
  if (hoursUntilExpiry > 24) {
    return credentials.access_token;
  }

  // If token is expired or expiring soon, try to refresh
  if (hoursUntilExpiry <= 0) {
    // Token already expired
    if (account.platform === "tiktok" && credentials.refresh_token) {
      // TikTok supports refresh tokens
      return await refreshTikTokToken(account, credentials.refresh_token, supabase);
    } else if (account.platform === "facebook" || account.platform === "instagram") {
      // Facebook/Instagram: try long-lived token exchange
      return await refreshFacebookToken(account, credentials.access_token, supabase);
    } else {
      throw new Error(`Token expired for ${account.platform} and refresh not supported`);
    }
  }

  // Token expiring soon (within 24h) - refresh proactively
  if (account.platform === "tiktok" && credentials.refresh_token) {
    return await refreshTikTokToken(account, credentials.refresh_token, supabase);
  } else if (account.platform === "facebook" || account.platform === "instagram") {
    return await refreshFacebookToken(account, credentials.access_token, supabase);
  }

  // No refresh support - return current token (will fail when actually expired)
  return credentials.access_token;
}

/**
 * Refresh TikTok access token using refresh token
 */
async function refreshTikTokToken(
  account: SocialAccount,
  refreshToken: string,
  supabase: SupabaseClient
): Promise<string> {
  const config = await import("./platform-clients/config").then(m => m.getPlatformConfig());
  const TOKEN_URL = `${config.tiktok.baseUrl}/${config.tiktok.apiVersion}/oauth/token/`;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: config.tiktok.clientKey,
      client_secret: config.tiktok.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TikTok token refresh failed: ${errorText}`);
  }

  const data: any = await response.json();
  const newAccessToken = data.access_token;
  const newRefreshToken = data.refresh_token;
  const expiresIn = data.expires_in;
  const expiresAt = new Date(Date.now() + (expiresIn ?? 0) * 1000).toISOString();

  // Update tokens in database
  await updateSocialAccountTokens(
    account.workspace_id,
    account.platform,
    {
      access_token: newAccessToken,
      refresh_token: newRefreshToken ?? refreshToken,
      expires_at: expiresAt,
    },
    supabase
  );

  return newAccessToken;
}

/**
 * Refresh Facebook/Instagram access token using long-lived token exchange
 */
async function refreshFacebookToken(
  account: SocialAccount,
  currentToken: string,
  supabase: SupabaseClient
): Promise<string> {
  const config = await import("./platform-clients/config").then(m => m.getPlatformConfig());
  const FB_GRAPH_BASE = `${config.facebook.baseUrl}/${config.facebook.apiVersion}`;

  const response = await fetch(
    `${FB_GRAPH_BASE}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: config.facebook.appId,
        client_secret: config.facebook.appSecret,
        fb_exchange_token: currentToken,
      })
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Facebook token refresh failed: ${errorText}`);
  }

  const data: any = await response.json();
  const newAccessToken = data.access_token;
  const expiresIn = data.expires_in;
  const expiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  // Update tokens in database
  await updateSocialAccountTokens(
    account.workspace_id,
    account.platform,
    {
      access_token: newAccessToken,
      refresh_token: null, // Facebook doesn't use refresh tokens
      expires_at: expiresAt,
    },
    supabase
  );

  return newAccessToken;
}

