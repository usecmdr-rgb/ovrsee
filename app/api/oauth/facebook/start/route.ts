import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth-helpers";

const FB_AUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth";

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
  const redirectUri = `${baseUrl}/api/oauth/facebook/callback`;

  const state = encodeState({ userId, provider: "facebook" });

  const url = new URL(FB_AUTH_URL);
  url.searchParams.set("client_id", process.env.FACEBOOK_APP_ID ?? "");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    [
      "public_profile",
      "email",
      "pages_show_list",
      "instagram_basic",
      "instagram_manage_insights",
    ].join(",")
  );
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}



