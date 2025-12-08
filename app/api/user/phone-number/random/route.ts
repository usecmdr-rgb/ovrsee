import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getTwilioClient } from "@/lib/twilio";
import { getExpectedTwilioWebhookUrl } from "@/lib/twilioExpectedWebhook";

interface RandomNumberRequestBody {
  country?: string;
  areaCode?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const supabase = getSupabaseServerClient();
    const body = (await request.json().catch(() => ({}))) as RandomNumberRequestBody;

    const country = (body.country || "US").toUpperCase();
    const areaCode = body.areaCode?.trim();

    // Ensure user does not already have an active number
    const { data: existing, error: existingError } = await supabase
      .from("user_phone_numbers")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (existingError) {
      console.error(
        "[Random Phone Number] Error checking existing user_phone_numbers:",
        existingError
      );
      return NextResponse.json(
        { error: "Failed to check existing phone number." },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "User already has an assigned phone number." },
        { status: 400 }
      );
    }

    const client = getTwilioClient();

    const numbers = await client
      .availablePhoneNumbers(country)
      .local.list({
        areaCode: areaCode ? Number(areaCode) : undefined,
        voiceEnabled: true,
        smsEnabled: false,
        limit: 20,
      });

    if (!numbers || numbers.length === 0) {
      return NextResponse.json(
        { error: "No available numbers found for that country/area code." },
        { status: 400 }
      );
    }

    // Shuffle candidates so we don't always try in the same order
    const candidates = [...numbers];
    for (let i = candidates.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const expectedUrl = getExpectedTwilioWebhookUrl();

    let purchased:
      | {
          sid: string;
          phoneNumber: string;
        }
      | null = null;

    for (const candidate of candidates) {
      try {
        const incoming = await client.incomingPhoneNumbers.create({
          phoneNumber: candidate.phoneNumber,
          voiceUrl: expectedUrl,
          voiceMethod: "POST",
        });

        purchased = {
          sid: incoming.sid,
          phoneNumber: incoming.phoneNumber,
        };
        break;
      } catch (twilioError: any) {
        const msg = twilioError?.message || String(twilioError);
        console.warn(
          "[Random Phone Number] Failed to purchase candidate number",
          candidate.phoneNumber,
          msg
        );
        // If it's a "not available" style error, continue; otherwise, rethrow
        if (!/available/i.test(msg) && !/purchased/i.test(msg)) {
          // Non-availability error – propagate
          throw twilioError;
        }
      }
    }

    if (!purchased) {
      return NextResponse.json(
        { error: "Failed to purchase a number. Please try again." },
        { status: 400 }
      );
    }

    const { data: newRow, error: insertError } = await supabase
      .from("user_phone_numbers")
      .insert({
        user_id: userId,
        phone_number: purchased.phoneNumber,
        twilio_phone_sid: purchased.sid,
        is_active: true,
      })
      .select("phone_number, twilio_phone_sid")
      .single();

    if (insertError) {
      console.error(
        "[Random Phone Number] Error inserting user_phone_numbers row:",
        insertError
      );
      // Best-effort cleanup: release the Twilio number
      try {
        await client.incomingPhoneNumbers(purchased.sid).remove();
      } catch (cleanupError) {
        console.error(
          "[Random Phone Number] Error cleaning up Twilio number after DB failure:",
          cleanupError
        );
      }
      return NextResponse.json(
        { error: "Failed to save phone number." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        phoneNumber: newRow.phone_number,
        twilioSid: newRow.twilio_phone_sid,
        message: "Random number assigned successfully.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Random Phone Number] Unexpected error:", error);

    const message =
      error?.message?.includes("Twilio is not configured")
        ? "Twilio is not configured on the server."
        : "Unexpected error while assigning random number.";

    return NextResponse.json(
      {
        error: message,
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}





