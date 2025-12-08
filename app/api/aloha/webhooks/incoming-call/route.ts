/**
 * POST /api/aloha/webhooks/incoming-call
 * 
 * Twilio webhook for incoming calls
 * Creates initial call_log entry and routes call to Aloha/voicemail
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { withLogging } from "@/lib/api/middleware";
import { Errors } from "@/lib/api/errors";
import { getBaseUrl } from "@/lib/auth/getBaseUrl";

async function handler(request: NextRequest) {
  const formData = await request.formData();
  
  // Twilio webhook parameters
  const callSid = formData.get("CallSid") as string;
  const fromNumber = formData.get("From") as string;
  const toNumber = formData.get("To") as string;
  const callStatus = formData.get("CallStatus") as string || "ringing";
  const direction = formData.get("Direction") as string || "inbound";

  if (!callSid || !fromNumber || !toNumber) {
    throw Errors.BadRequest("Missing required Twilio parameters");
  }

  const supabase = getSupabaseServerClient();

  // Find workspace by phone number
  const { data: phoneNumber, error: phoneError } = await supabase
    .from("user_phone_numbers")
    .select("workspace_id, user_id")
    .eq("phone_number", toNumber)
    .eq("is_active", true)
    .single();

  if (phoneError || !phoneNumber) {
    console.error("[Aloha Webhook] Phone number not found:", toNumber, phoneError);
    // Still return TwiML to handle gracefully
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, this number is not configured. Please try again later.</Say>
  <Hangup/>
</Response>`,
      {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }
    );
  }

  // Create call_log entry
  const { data: callLog, error: callLogError } = await supabase
    .from("call_logs")
    .insert({
      workspace_id: phoneNumber.workspace_id,
      user_id: phoneNumber.user_id,
      twilio_call_sid: callSid,
      from_number: fromNumber,
      to_number: toNumber,
      status: callStatus,
      direction: direction === "inbound" ? "inbound" : "outbound",
      started_at: new Date().toISOString(),
      metadata: {
        twilio_webhook_received_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (callLogError) {
    console.error("[Aloha Webhook] Error creating call log:", callLogError);
    // Continue anyway - we'll try to update it later
  }

  // Get Aloha settings for this workspace
  const { data: alohaSettings } = await supabase
    .from("aloha_settings")
    .select("*")
    .eq("workspace_id", phoneNumber.workspace_id)
    .single();

  // Determine if we should answer or forward
  const baseUrl = getBaseUrl();
  const streamUrl = `${baseUrl.replace(/^http/, "ws")}/api/twilio/stream`;

  // For now, route to Aloha stream (AI assistant)
  // In the future, check business hours, forwarding settings, etc.
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
    },
  });
}

export const POST = withLogging(handler);




