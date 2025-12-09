import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { upsertSocialAccount } from "@/lib/studio/social-account-service";

const FB_GRAPH_BASE = "https://graph.facebook.com/v19.0";

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
    return NextResponse.redirect("/studio?facebook_status=error");
  }
  if (!code || !state) {
    return NextResponse.redirect("/studio?facebook_status=invalid");
  }

  const { userId } = decodeState<{ userId: string }>(state);

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/oauth/facebook/callback`;

  const clientId = process.env.FACEBOOK_APP_ID;
  const clientSecret = process.env.FACEBOOK_APP_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Facebook OAuth not configured - missing client id/secret");
    return NextResponse.redirect("/studio?facebook_status=server_misconfig");
  }

  const tokenRes = await fetch(
    `${FB_GRAPH_BASE}/oauth/access_token?` +
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      })
  );

  if (!tokenRes.ok) {
    console.error("Facebook token exchange failed:", await tokenRes.text());
    return NextResponse.redirect("/studio?facebook_status=token_error");
  }

  const tokenJson: any = await tokenRes.json();
  let accessToken = tokenJson.access_token as string;
  let expiresIn = tokenJson.expires_in as number;

  const longRes = await fetch(
    `${FB_GRAPH_BASE}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: accessToken,
      })
  );

  if (longRes.ok) {
    const longJson: any = await longRes.json();
    accessToken = longJson.access_token ?? accessToken;
    expiresIn = longJson.expires_in ?? expiresIn;
  }

  const expiresAt = new Date(Date.now() + (expiresIn ?? 0) * 1000);

  const meRes = await fetch(
    `${FB_GRAPH_BASE}/me?` +
      new URLSearchParams({
        access_token: accessToken,
        fields: "id,name",
      })
  );
  const meJson: any = await meRes.json();

  const pagesRes = await fetch(
    `${FB_GRAPH_BASE}/me/accounts?` +
      new URLSearchParams({
        access_token: accessToken,
        fields: "id,name,access_token,instagram_business_account",
      })
  );
  const pagesJson: any = await pagesRes.json();
  const firstPage = pagesJson.data?.[0];
  const igBusinessId = firstPage?.instagram_business_account?.id;

  const provider =
    igBusinessId && typeof igBusinessId === "string" ? "instagram" : "facebook";

  const providerUserId =
    provider === "instagram" ? igBusinessId : (meJson.id as string);

  const metadata = {
    name: meJson.name,
    fb_user_id: meJson.id,
    primary_page_id: firstPage?.id,
    primary_page_name: firstPage?.name,
    ig_business_id: igBusinessId,
  };

  const supabaseAdmin = getSupabaseServerClient();

  // Get or create workspace for user
  const workspaceId = await getWorkspaceIdForUser(userId, supabaseAdmin);
  if (!workspaceId) {
    console.error("Error getting workspace for user:", userId);
    return NextResponse.redirect("/studio?facebook_status=workspace_error");
  }

  // Determine platform (instagram vs facebook)
  const platform = provider === "instagram" ? "instagram" : "facebook";

  // Extract handle/name from metadata
  const handle = provider === "instagram" 
    ? (metadata.name || metadata.primary_page_name)
    : (metadata.name || metadata.primary_page_name);

  // Upsert to workspace-scoped studio_social_accounts
  const account = await upsertSocialAccount(
    workspaceId,
    platform,
    {
      external_account_id: providerUserId,
      handle: handle || null,
      avatar_url: null, // Facebook/Instagram don't provide avatar in this flow
      access_token: accessToken,
      refresh_token: null,
      expires_at: expiresAt.toISOString(),
      scopes: [
        "public_profile",
        "email",
        "pages_show_list",
        "instagram_basic",
        "instagram_manage_insights",
      ],
      metadata,
      connected_by: userId,
    },
    supabaseAdmin
  );

  if (!account) {
    console.error("Error upserting social account (Facebook):");
    return NextResponse.redirect("/studio?facebook_status=db_error");
  }

  // Also write to social_connections for backwards compatibility
  // TODO: Remove this after all code paths are migrated to workspace-scoped accounts
  const { error: legacyError } = await supabaseAdmin
    .from("social_connections")
    .upsert(
      {
        user_id: userId,
        provider,
        provider_user_id: providerUserId,
        access_token: accessToken,
        refresh_token: null,
        expires_at: expiresAt.toISOString(),
        scopes: [
          "public_profile",
          "email",
          "pages_show_list",
          "instagram_basic",
          "instagram_manage_insights",
        ],
        metadata,
      },
      {
        onConflict: "user_id,provider",
      } as any
    );

  if (legacyError) {
    console.warn("Error writing to legacy social_connections (non-fatal):", legacyError);
  }

  return NextResponse.redirect("/studio?facebook_status=connected");
}



