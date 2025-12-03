import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * POST /api/twilio/recording
 *
 * Receives Twilio's recording callback after a voicemail is recorded.
 * Extracts core metadata and stores it in Supabase for now.
 *
 * Expected Twilio parameters (form-encoded):
 * - RecordingUrl
 * - RecordingSid
 * - RecordingDuration
 * - From
 * - To
 * - CallSid
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const recordingUrl = (formData.get("RecordingUrl") as string | null) || "";
    const recordingSid = (formData.get("RecordingSid") as string | null) || "";
    const recordingDuration =
      (formData.get("RecordingDuration") as string | null) || "";
    const from = (formData.get("From") as string | null) || "";
    const to = (formData.get("To") as string | null) || "";
    const callSid = (formData.get("CallSid") as string | null) || "";

    // Basic validation – we at least expect a RecordingUrl.
    if (!recordingUrl) {
      console.warn(
        "Twilio recording callback missing RecordingUrl. Raw payload:",
        Object.fromEntries(formData.entries())
      );

      return NextResponse.json(
        { ok: false, error: "missing_recording_url" },
        { status: 400 }
      );
    }

    // Store voicemail in Supabase (simple, generic table).
    // If this table does not exist yet, you can create it with e.g.:
    // CREATE TABLE voicemail_recordings (
    //   id uuid primary key default uuid_generate_v4(),
    //   created_at timestamptz default now(),
    //   from_number text,
    //   to_number text,
    //   call_sid text,
    //   recording_sid text,
    //   recording_url text,
    //   recording_duration text,
    //   raw_payload jsonb
    // );
    try {
      const supabase = getSupabaseServerClient();
      const { error: insertError } = await supabase
        .from("voicemail_recordings")
        .insert({
          from_number: from,
          to_number: to,
          call_sid: callSid,
          recording_sid: recordingSid,
          recording_url: recordingUrl,
          recording_duration: recordingDuration,
          raw_payload: Object.fromEntries(formData.entries()),
        });

      if (insertError) {
        console.error(
          "Error inserting voicemail_recordings row:",
          insertError
        );
      }
    } catch (dbError) {
      // Do not fail the webhook if storage fails – just log.
      console.error("Error storing Twilio voicemail in Supabase:", dbError);
    }

    // Twilio is fine with XML or JSON; we return a simple XML Response.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you. Your message has been received. Goodbye.</Say>
  <Hangup/>
</Response>`;

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } catch (error: any) {
    console.error("Error in /api/twilio/recording:", error);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred while processing your recording.</Say>
  <Hangup/>
</Response>`;

    return new NextResponse(twiml, {
      status: 500,
      headers: {
        "Content-Type": "text/xml",
      },
    });
  }
}




