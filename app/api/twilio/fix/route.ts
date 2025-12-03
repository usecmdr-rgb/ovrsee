import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getTwilioClient } from "@/lib/twilio";
import { getExpectedTwilioWebhookUrl } from "@/lib/twilioExpectedWebhook";

/**
 * POST /api/twilio/fix
 *
 * Optional helper to automatically correct the Twilio webhook configuration
 * for the current user's assigned number.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const supabase = getSupabaseServerClient();

    const { data: phoneRecord, error } = await supabase
      .from("user_phone_numbers")
      .select("phone_number, twilio_phone_sid")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("[Twilio Fix] Error fetching user phone number:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to load user phone number.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    if (!phoneRecord) {
      return NextResponse.json(
        {
          success: false,
          error: "User has no assigned phone number.",
        },
        { status: 200 }
      );
    }

    const incomingSid = phoneRecord.twilio_phone_sid as string | undefined;
    if (!incomingSid) {
      return NextResponse.json(
        {
          success: false,
          error: "Assigned number is missing its Twilio SID.",
        },
        { status: 200 }
      );
    }

    let expectedUrl: string;
    try {
      expectedUrl = getExpectedTwilioWebhookUrl();
    } catch (envError: any) {
      console.error("[Twilio Fix] PUBLIC_BASE_URL misconfigured:", envError);
      return NextResponse.json(
        {
          success: false,
          error: "PUBLIC_BASE_URL is not configured.",
          details: envError.message,
        },
        { status: 500 }
      );
    }

    const client = getTwilioClient();

    await client.incomingPhoneNumbers(incomingSid).update({
      voiceUrl: expectedUrl,
      voiceMethod: "POST",
    });

    return NextResponse.json(
      {
        success: true,
        number: phoneRecord.phone_number,
        voiceUrl: expectedUrl,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Twilio Fix] Unexpected error:", error);

    const message =
      error?.message?.includes("Twilio is not configured")
        ? "Twilio is not configured on the server."
        : "Unexpected error while attempting to fix Twilio configuration.";

    return NextResponse.json(
      {
        success: false,
        error: message,
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}




