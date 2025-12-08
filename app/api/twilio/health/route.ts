import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getTwilioClient } from "@/lib/twilio";
import { getExpectedTwilioWebhookUrl } from "@/lib/twilioExpectedWebhook";

export async function GET(request: NextRequest) {
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
      console.error("[Twilio Health] Error fetching user phone number:", error);
      return NextResponse.json(
        {
          status: "error",
          message: "Failed to load user phone number.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    if (!phoneRecord) {
      return NextResponse.json(
        {
          status: "error",
          message: "User has no assigned phone number.",
        },
        { status: 200 }
      );
    }

    const incomingSid = phoneRecord.twilio_phone_sid as string | undefined;
    if (!incomingSid) {
      return NextResponse.json(
        {
          status: "error",
          message: "Assigned number is missing its Twilio SID.",
        },
        { status: 200 }
      );
    }

    let expectedUrl: string;
    try {
      expectedUrl = getExpectedTwilioWebhookUrl();
    } catch (envError: any) {
      console.error("[Twilio Health] PUBLIC_BASE_URL misconfigured:", envError);
      return NextResponse.json(
        {
          status: "error",
          message: "PUBLIC_BASE_URL is not configured.",
          details: envError.message,
        },
        { status: 500 }
      );
    }

    const client = getTwilioClient();

    const number = await client.incomingPhoneNumbers(incomingSid).fetch();

    const exists = !!number && !!number.phoneNumber;
    const webhookConfigured = number.voiceUrl === expectedUrl;
    const voiceMethodCorrect = (number.voiceMethod || "").toUpperCase() === "POST";

    const allChecksPass = exists && webhookConfigured && voiceMethodCorrect;

    return NextResponse.json(
      {
        status: allChecksPass ? "ok" : "error",
        number: number.phoneNumber,
        checks: {
          exists,
          webhookConfigured,
          webhookUrl: number.voiceUrl,
          expectedWebhook: expectedUrl,
          voiceMethodCorrect,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Twilio Health] Unexpected error:", error);

    const message =
      error?.message?.includes("Twilio is not configured")
        ? "Twilio is not configured on the server."
        : "Unexpected error during Twilio health check.";

    return NextResponse.json(
      {
        status: "error",
        message,
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}





