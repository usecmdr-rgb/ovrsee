/**
 * GET /api/aloha/phone/search
 * 
 * Search for available phone numbers via Twilio
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { searchAvailableNumbers } from "@/lib/twilioClient";

export async function GET(request: NextRequest) {
  try {
    const { responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const { searchParams } = new URL(request.url);

    const country = searchParams.get("country") || "US";
    const areaCode = searchParams.get("areaCode") || undefined;

    const numbers = await searchAvailableNumbers(country, areaCode);

    return NextResponse.json({
      items: numbers.map(n => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
      })),
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Phone Search] Error:", error);
    return NextResponse.json(
      { error: "Failed to search phone numbers" },
      { status: 500 }
    );
  }
}
