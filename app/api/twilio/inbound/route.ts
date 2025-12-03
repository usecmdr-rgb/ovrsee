import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/twilio/inbound
 *
 * Twilio webhook for inbound calls.
 *
 * Upgraded from voicemail-only (<Say>/<Record>) to realtime AI via
 * Twilio Media Streams:
 *
 * <Response>
 *   <Connect>
 *     <Stream url="wss://PUBLIC_BASE_URL/api/twilio/stream" />
 *   </Connect>
 * </Response>
 *
 * We still parse the form data so we can log basic metadata, but the
 * actual call handling happens in /api/twilio/stream.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const from = (formData.get("From") as string | null) || "";
    const to = (formData.get("To") as string | null) || "";
    const callSid = (formData.get("CallSid") as string | null) || "";

    console.log("[Twilio Inbound] Incoming call", {
      from,
      to,
      callSid,
    });

    // Derive PUBLIC_BASE_URL → then map to wss:// for Twilio streaming.
    const publicBaseUrl =
      process.env.PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    let wsBase = publicBaseUrl;
    if (wsBase.startsWith("http://")) {
      wsBase = wsBase.replace("http://", "ws://");
    } else if (wsBase.startsWith("https://")) {
      wsBase = wsBase.replace("https://", "wss://");
    } else if (!wsBase.startsWith("ws://") && !wsBase.startsWith("wss://")) {
      // Assume host only
      wsBase = `wss://${wsBase}`;
    }

    const streamUrl = `${wsBase.replace(/\/+$/, "")}/api/twilio/stream`;

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
  } catch (error: any) {
    console.error("Error in /api/twilio/inbound:", error);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again later.</Say>
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

