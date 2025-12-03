import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * POST /api/twilio/voice/incoming
 * 
 * Twilio webhook for inbound calls
 * 
 * TODO: Add Twilio signature validation for security
 * See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 * 
 * Behavior:
 * - Parses Twilio request (To, From, CallSid, etc.)
 * - Identifies user by phone number
 * - Determines call type (voicemail vs live)
 * - Returns TwiML to start media stream
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Validate Twilio request signature
    // const signature = request.headers.get("x-twilio-signature");
    // const url = request.url;
    // const params = await request.formData();
    // if (!twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, params)) {
    //   return new NextResponse("Unauthorized", { status: 401 });
    // }

    // Parse Twilio form data
    const formData = await request.formData();
    const to = formData.get("To") as string;
    const from = formData.get("From") as string;
    const callSid = formData.get("CallSid") as string;

    if (!to) {
      return new NextResponse("Missing 'To' parameter", { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // Find user by phone number
    const { data: phoneNumberRecord, error: fetchError } = await supabase
      .from("user_phone_numbers")
      .select("user_id, voicemail_enabled, voicemail_mode")
      .eq("phone_number", to)
      .eq("is_active", true)
      .single();

    if (fetchError || !phoneNumberRecord) {
      // No matching user - return simple TwiML to hang up
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This number is not configured. Goodbye.</Say>
  <Hangup/>
</Response>`,
        {
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    const userId = phoneNumberRecord.user_id;
    const voicemailEnabled = phoneNumberRecord.voicemail_enabled;
    const voicemailMode = phoneNumberRecord.voicemail_mode;

    // Determine call type
    const callType = voicemailEnabled ? "voicemail" : "live";

    // Get base URL for WebSocket endpoint
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    // TODO: Replace with actual WebSocket endpoint when implemented
    // For now, this is a placeholder that will be connected to OpenAI Realtime API
    const streamUrl = `${baseUrl}/api/twilio/voice/stream?userId=${userId}&callType=${callType}&from=${encodeURIComponent(from)}&callSid=${encodeURIComponent(callSid)}`;

    // Return TwiML to start media stream
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${streamUrl}"/>
  </Start>
</Response>`;

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error: any) {
    console.error("Error in /api/twilio/voice/incoming:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again later.</Say>
  <Hangup/>
</Response>`,
      {
        headers: { "Content-Type": "text/xml" },
        status: 500,
      }
    );
  }
}













