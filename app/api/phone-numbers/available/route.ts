import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getTwilioClient } from "@/lib/twilio";

/**
 * GET /api/phone-numbers/available
 *
 * Query params:
 * - country: string (default "US")
 * - areaCode: string (optional, 3-digit)
 *
 * Returns a list of available Twilio local numbers.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuthFromRequest(request);

    const searchParams = request.nextUrl.searchParams;
    const country = (searchParams.get("country") || "US").toUpperCase();
    const areaCodeParam = searchParams.get("areaCode");

    const client = getTwilioClient();

    const numbers = await client
      .availablePhoneNumbers(country)
      .local.list({
        areaCode: areaCodeParam ? Number(areaCodeParam) : undefined,
        smsEnabled: false,
        voiceEnabled: true,
        limit: 10,
      });

    const result = numbers.map((num) => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      locality: (num as any).locality,
      region: (num as any).region,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in /api/phone-numbers/available:", error);
    console.error("Error details:", {
      status: error?.status,
      code: error?.code,
      message: error?.message,
      moreInfo: error?.moreInfo,
    });

    // Handle Twilio auth errors explicitly
    if (error?.status === 401 || error?.code === 20003) {
      return NextResponse.json(
        {
          error:
            "Failed to authenticate with Twilio (Error 20003). Common causes:\n" +
            "1. API Key and Secret don't match (they must be from the same API Key pair)\n" +
            "2. API Key belongs to a different account than TWILIO_ACCOUNT_SID\n" +
            "3. API Key was deleted or revoked in Twilio Console\n" +
            "4. Credentials are for a different Twilio account/environment\n\n" +
            "Please verify in Twilio Console:\n" +
            "- Go to Account → API Keys & Tokens\n" +
            "- Ensure the API Key SID matches TWILIO_API_KEY\n" +
            "- Ensure the API Secret matches TWILIO_API_SECRET\n" +
            "- Ensure the Account SID matches TWILIO_ACCOUNT_SID",
          code: error?.code,
          moreInfo: error?.moreInfo,
        },
        { status: 500 }
      );
    }

    if (error?.message?.includes("Twilio is not configured")) {
      return NextResponse.json(
        {
          error:
            "Twilio is not configured. Set TWILIO_ACCOUNT_SID and either TWILIO_API_KEY/TWILIO_API_SECRET or TWILIO_AUTH_TOKEN.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


