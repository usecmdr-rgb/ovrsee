export const runtime = "edge";

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import {
  createRealtimeAlohaSession,
  type TwilioEvent,
  type TwilioStartEvent,
  type TwilioMediaEvent,
  type TwilioStopEvent,
} from "@/lib/aiSession";

interface ConnectionState {
  userId?: string;
  from?: string;
  to?: string;
  callSid?: string;
  streamSid?: string;
  session?: Awaited<ReturnType<typeof createRealtimeAlohaSession>>;
}

/**
 * WebSocket endpoint for Twilio Media Streams.
 *
 * Twilio connects here using the <Stream> URL from /api/twilio/inbound.
 * This route must use the Edge runtime and WebSocketPair.
 */
export async function GET(request: Request): Promise<Response> {
  const upgradeHeader = request.headers.get("Upgrade") || "";
  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket Upgrade", { status: 426 });
  }

  const pair = new (globalThis as any).WebSocketPair();
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

  const state: ConnectionState = {};

  // Accept the server side of the WebSocketPair
  // @ts-ignore - Edge runtime WebSocket
  server.accept();

  server.addEventListener("message", async (event: MessageEvent) => {
    try {
      const data = typeof event.data === "string"
        ? event.data
        : event.data instanceof ArrayBuffer
        ? new TextDecoder().decode(event.data)
        : String(event.data);

      const parsed: TwilioEvent = JSON.parse(data);

      if (parsed.event === "start") {
        await handleStartEvent(server, parsed as TwilioStartEvent, state);
      } else if (parsed.event === "media") {
        await handleMediaEvent(parsed as TwilioMediaEvent, state);
      } else if (parsed.event === "stop") {
        await handleStopEvent(state);
        // After stop, we close the server side
        // @ts-ignore
        server.close();
      } else {
        console.log("[Twilio Stream] Unknown event type:", parsed.event);
      }
    } catch (error) {
      console.error("[Twilio Stream] Error handling message:", error);
    }
  });

  server.addEventListener("close", async () => {
    try {
      if (state.session) {
        await state.session.handleStop();
      }
    } catch (error) {
      console.error("[Twilio Stream] Error on close:", error);
    }
  });

  // Return the client side of the pair to Twilio
  return new Response(null, {
    status: 101,
    // @ts-ignore - Next.js Edge runtime expects `webSocket`
    webSocket: client,
  });
}

async function handleStartEvent(
  ws: WebSocket,
  event: TwilioStartEvent,
  state: ConnectionState
) {
  const { start } = event;
  const { callSid, from, to, streamSid } = start;

  console.log("[Twilio Stream] start", {
    callSid,
    from,
    to,
    streamSid,
  });

  state.callSid = callSid;
  state.from = from;
  state.to = to;
  state.streamSid = streamSid;

  // Look up which user owns this Twilio number
  try {
    const supabase = getSupabaseServerClient();
    const { data: phoneRecord, error } = await supabase
      .from("user_phone_numbers")
      .select("user_id")
      .eq("phone_number", to)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !phoneRecord) {
      console.warn(
        "[Twilio Stream] No user_phone_numbers record found for inbound call",
        { to, error }
      );
      return;
    }

    const userId = phoneRecord.user_id as string;
    state.userId = userId;

    state.session = await createRealtimeAlohaSession({
      userId,
      from,
      to,
      callSid,
      streamSid,
      twilioSocket: ws,
    });
  } catch (lookupError) {
    console.error(
      "[Twilio Stream] Error looking up user for inbound call:",
      lookupError
    );
  }
}

async function handleMediaEvent(
  event: TwilioMediaEvent,
  state: ConnectionState
) {
  if (!state.session) {
    // We haven't successfully bound this stream to a user yet
    return;
  }

  await state.session.handleTwilioMedia(event);
}

async function handleStopEvent(state: ConnectionState) {
  if (!state.session) return;
  await state.session.handleStop();
}




