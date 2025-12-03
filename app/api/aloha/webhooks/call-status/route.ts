/**
 * POST /api/aloha/webhooks/call-status
 * 
 * Twilio webhook for call status updates
 * Updates call_log entry with status, duration, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { withLogging } from "@/lib/api/middleware";
import { Errors } from "@/lib/api/errors";

async function handler(request: NextRequest) {
  const formData = await request.formData();
  
  const callSid = formData.get("CallSid") as string;
  const callStatus = formData.get("CallStatus") as string;
  const callDuration = formData.get("CallDuration") as string | null;
  const recordingUrl = formData.get("RecordingUrl") as string | null;

  if (!callSid || !callStatus) {
    throw Errors.BadRequest("Missing CallSid or CallStatus");
  }

  const supabase = getSupabaseServerClient();

  // Find call_log by Twilio call SID
  const { data: callLog, error: findError } = await supabase
    .from("call_logs")
    .select("*")
    .eq("twilio_call_sid", callSid)
    .single();

  if (findError || !callLog) {
    console.warn("[Aloha Webhook] Call log not found for call SID:", callSid);
    // Return 200 to acknowledge webhook even if we can't find the call
    return NextResponse.json({ received: true });
  }

  // Map Twilio status to our status
  let status = callLog.status;
  if (callStatus === "completed") {
    status = "completed";
  } else if (callStatus === "no-answer" || callStatus === "busy") {
    status = callStatus;
  } else if (callStatus === "failed") {
    status = "failed";
  } else if (callStatus === "in-progress") {
    status = "in-progress";
  }

  // Update call_log
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (callStatus === "completed" && callDuration) {
    updateData.ended_at = new Date().toISOString();
    updateData.duration_seconds = parseInt(callDuration, 10);
  }

  if (recordingUrl) {
    updateData.recording_url = recordingUrl;
  }

  const { error: updateError } = await supabase
    .from("call_logs")
    .update(updateData)
    .eq("id", callLog.id);

  if (updateError) {
    console.error("[Aloha Webhook] Error updating call log:", updateError);
  }

  return NextResponse.json({ received: true });
}

export const POST = withLogging(handler);



