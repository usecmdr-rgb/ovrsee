/**
 * POST /api/aloha/webhooks/voicemail-recorded
 * 
 * Twilio webhook when voicemail recording is complete
 * Creates voicemail_messages entry and links to call_log
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { withLogging } from "@/lib/api/middleware";
import { Errors } from "@/lib/api/errors";

async function handler(request: NextRequest) {
  const formData = await request.formData();
  
  const callSid = formData.get("CallSid") as string;
  const recordingSid = formData.get("RecordingSid") as string;
  const recordingUrl = formData.get("RecordingUrl") as string;
  const recordingDuration = formData.get("RecordingDuration") as string | null;
  const fromNumber = formData.get("From") as string;
  const toNumber = formData.get("To") as string;

  if (!callSid || !recordingSid || !recordingUrl) {
    throw Errors.BadRequest("Missing required recording parameters");
  }

  const supabase = getSupabaseServerClient();

  // Find call_log by Twilio call SID
  const { data: callLog, error: callLogError } = await supabase
    .from("call_logs")
    .select("*")
    .eq("twilio_call_sid", callSid)
    .single();

  if (callLogError || !callLog) {
    console.error("[Aloha Webhook] Call log not found for voicemail:", callSid, callLogError);
    throw Errors.NotFound("Call log");
  }

  // Check if voicemail already exists
  const { data: existingVoicemail } = await supabase
    .from("voicemail_messages")
    .select("id")
    .eq("twilio_recording_sid", recordingSid)
    .single();

  if (existingVoicemail) {
    console.log("[Aloha Webhook] Voicemail already exists:", recordingSid);
    return NextResponse.json({ received: true, voicemail_id: existingVoicemail.id });
  }

  // Create voicemail_messages entry
  const { data: voicemail, error: voicemailError } = await supabase
    .from("voicemail_messages")
    .insert({
      workspace_id: callLog.workspace_id,
      user_id: callLog.user_id,
      call_log_id: callLog.id,
      twilio_recording_sid: recordingSid,
      recording_url: recordingUrl,
      recording_duration_seconds: recordingDuration ? parseInt(recordingDuration, 10) : null,
      from_number: fromNumber || callLog.from_number,
      to_number: toNumber || callLog.to_number,
      metadata: {
        twilio_webhook_received_at: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (voicemailError) {
    console.error("[Aloha Webhook] Error creating voicemail:", voicemailError);
    throw Errors.InternalServerError("Failed to create voicemail");
  }

  // Update call_log to mark as having voicemail
  await supabase
    .from("call_logs")
    .update({
      has_voicemail: true,
      status: "voicemail",
      updated_at: new Date().toISOString(),
    })
    .eq("id", callLog.id);

  // TODO: Enqueue transcription job here
  // For now, we just store the voicemail - transcription will be added later

  return NextResponse.json({
    received: true,
    voicemail_id: voicemail.id,
    call_log_id: callLog.id,
  });
}

export const POST = withLogging(handler);




