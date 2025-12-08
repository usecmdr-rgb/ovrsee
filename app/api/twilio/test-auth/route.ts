import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getTwilioClient, resetTwilioClient } from "@/lib/twilio";

/**
 * GET /api/twilio/test-auth
 *
 * Diagnostic endpoint to test Twilio authentication.
 * This helps debug authentication issues by attempting a simple API call.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuthFromRequest(request);

    // Reset client to ensure fresh credentials
    resetTwilioClient();
    const client = getTwilioClient();

    // Try a simple API call to verify authentication
    // Fetching the account details is a lightweight test
    const account = await client.api.accounts(client.accountSid).fetch();

    return NextResponse.json({
      success: true,
      message: "Twilio authentication successful",
      accountSid: account.sid,
      accountName: account.friendlyName,
      status: account.status,
    });
  } catch (error: any) {
    console.error("[Twilio Test Auth] Error:", error);

    const errorDetails: any = {
      success: false,
      error: error?.message || "Unknown error",
      code: error?.code,
      status: error?.status,
      moreInfo: error?.moreInfo,
    };

    // Provide specific guidance based on error
    if (error?.status === 401 || error?.code === 20003) {
      errorDetails.guidance = {
        issue: "Authentication failed (Error 20003)",
        steps: [
          "1. Verify TWILIO_ACCOUNT_SID matches your Twilio Account SID (starts with AC)",
          "2. Verify TWILIO_API_KEY matches the API Key SID (starts with SK)",
          "3. Verify TWILIO_API_SECRET matches the secret for that API Key",
          "4. Ensure the API Key and Account SID are from the same Twilio account",
          "5. Check if the API Key was deleted or revoked in Twilio Console",
          "6. Restart your dev server after updating .env.local",
        ],
        consoleUrl: "https://console.twilio.com/us1/develop/api-keys",
      };
    } else if (error?.message?.includes("Twilio is not configured")) {
      errorDetails.guidance = {
        issue: "Twilio environment variables not set",
        steps: [
          "1. Set TWILIO_ACCOUNT_SID in .env.local",
          "2. Set either (TWILIO_API_KEY + TWILIO_API_SECRET) or TWILIO_AUTH_TOKEN",
          "3. Restart your dev server",
        ],
      };
    }

    return NextResponse.json(errorDetails, { status: 500 });
  }
}




