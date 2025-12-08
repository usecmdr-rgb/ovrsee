import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { upsertSocialAccount } from "@/lib/studio/social-account-service";

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const PROFILE_URL = "https://open.tiktokapis.com/v2/user/info/";

function getBaseUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_BASE_URL (or NEXT_PUBLIC_APP_URL) environment variable"
    );
  }
  return baseUrl.replace(/\/+$/, "");
}

function decodeState<T>(state: string): T {
  const padded = state.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(padded, "base64").toString("utf8");
  return JSON.parse(json) as T;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect("/studio?tiktok_status=error");
  }
  if (!code || !state) {
    return NextResponse.redirect("/studio?tiktok_status=invalid");
  }

  const { userId, codeVerifier } = decodeState<{
    userId: string;
    codeVerifier?: string;
  }>(state);

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/oauth/tiktok/callback`;

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  if (!clientKey || !clientSecret) {
    console.error("TikTok OAuth not configured - missing client key/secret");
    return NextResponse.redirect("/studio?tiktok_status=server_misconfig");
  }

  const verifierToSend = codeVerifier || "";

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code_verifier: verifierToSend,
    }),
  });

  if (!tokenRes.ok) {
    console.error("TikTok token exchange failed:", await tokenRes.text());
    return NextResponse.redirect("/studio?tiktok_status=token_error");
  }

  const tokenJson: any = await tokenRes.json();
  const accessToken = tokenJson.access_token as string;
  const refreshToken = tokenJson.refresh_token as string | undefined;
  const expiresIn = tokenJson.expires_in as number;
  const expiresAt = new Date(Date.now() + (expiresIn ?? 0) * 1000);

  const profileRes = await fetch(
    `${PROFILE_URL}?` +
      new URLSearchParams({
        fields: "open_id,display_name,username,avatar_url",
      }),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!profileRes.ok) {
    console.error("TikTok profile fetch failed:", await profileRes.text());
    return NextResponse.redirect("/studio?tiktok_status=profile_error");
  }

  const profileJson: any = await profileRes.json();
  const user = profileJson.data?.user ?? {};

  const metadata = {
    username: user.username,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
  };

  const supabaseAdmin = getSupabaseServerClient();

  // Get or create workspace for user
  const workspaceId = await getWorkspaceIdForUser(userId, supabaseAdmin);
  if (!workspaceId) {
    console.error("Error getting workspace for user:", userId);
    return NextResponse.redirect("/studio?tiktok_status=workspace_error");
  }

  // Upsert to workspace-scoped studio_social_accounts
  const account = await upsertSocialAccount(
    workspaceId,
    "tiktok",
    {
      external_account_id: user.open_id,
      handle: user.username || user.display_name || null,
      avatar_url: user.avatar_url || null,
      access_token: accessToken,
      refresh_token: refreshToken ?? null,
      expires_at: expiresAt.toISOString(),
      scopes: ["user.info.basic", "video.list", "video.upload"],
      metadata,
      connected_by: userId,
    },
    supabaseAdmin
  );

  if (!account) {
    console.error("Error upserting social account (TikTok):");
    return NextResponse.redirect("/studio?tiktok_status=db_error");
  }

  // Also write to social_connections for backwards compatibility
  // TODO: Remove this after all code paths are migrated to workspace-scoped accounts
  const { error: legacyError } = await supabaseAdmin
    .from("social_connections")
    .upsert(
      {
        user_id: userId,
        provider: "tiktok",
        provider_user_id: user.open_id,
        access_token: accessToken,
        refresh_token: refreshToken ?? null,
        expires_at: expiresAt.toISOString(),
        scopes: ["user.info.basic", "video.list", "video.upload"],
        metadata,
      },
      {
        onConflict: "user_id,provider",
      } as any
    );

  if (legacyError) {
    console.warn("Error writing to legacy social_connections (non-fatal):", legacyError);
  }

  return NextResponse.redirect("/studio?tiktok_status=connected");
}


