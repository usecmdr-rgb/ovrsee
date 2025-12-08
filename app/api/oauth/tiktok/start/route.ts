import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth-helpers";
import crypto from "crypto";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";

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

function encodeState(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function GET(_req: NextRequest) {
  const userId = await getUserIdFromRequest();
  if (!userId) {
    return NextResponse.redirect("/login");
  }

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/oauth/tiktok/callback`;

  // TikTok v2 OAuth requires PKCE (code_verifier + code_challenge).
  // We'll use the plain method for simplicity.
  const codeVerifier = crypto.randomBytes(32).toString("hex");
  const codeChallenge = codeVerifier;

  const state = encodeState({
    userId,
    provider: "tiktok",
    codeVerifier,
  });

  const url = new URL(AUTH_URL);
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    ["user.info.basic", "video.list", "video.upload"].join(",")
  );
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "plain");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}


