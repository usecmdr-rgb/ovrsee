import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withLogging } from "@/lib/api/middleware";
import { Errors } from "@/lib/api/errors";
import { searchAvailableNumbers } from "@/lib/twilioClient";

/**
 * GET /api/telephony/twilio/available-numbers
 * 
 * Search for available Twilio phone numbers
 * 
 * Query params:
 * - country: string (default: "US")
 * - areaCode: string (optional)
 */
async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country") || "US";
  const areaCode = searchParams.get("areaCode") || undefined;

  try {
    const numbers = await searchAvailableNumbers(country, areaCode);
    return NextResponse.json(numbers);
  } catch (error: any) {
    console.error("[Available Numbers] Error:", error);
    throw Errors.InternalServerError(`Failed to search numbers: ${error.message}`);
  }
}

export const GET = withLogging(requireAuth(handler));
