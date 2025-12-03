import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { buildAlohaSystemPrompt } from "@/lib/alohaContext";
import { lookupOrCreateContact, updateContactAfterCall } from "@/lib/aloha/contact-memory";

// NOTE: In Edge runtime, we use the global WebSocket type.
// This type alias makes it compatible with both Edge and Node.js environments.
type TwilioWebSocket = {
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: any) => void): void;
  accept?(): void;
};

export type TwilioStartEvent = {
  event: "start";
  start: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    from: string;
    to: string;
    [key: string]: any;
  };
};

export type TwilioMediaEvent = {
  event: "media";
  media: {
    payload: string; // base64-encoded audio
    track?: string;
    chunk?: number;
    timestamp?: string;
  };
  streamSid: string;
};

export type TwilioStopEvent = {
  event: "stop";
  streamSid: string;
};

export type TwilioEvent =
  | TwilioStartEvent
  | TwilioMediaEvent
  | TwilioStopEvent
  | { event: string; [key: string]: any };

export type AiActionMessage =
  | { type: "save_note"; payload: any }
  | { type: "create_lead"; payload: any }
  | { type: "update_business_info"; payload: any }
  | { type: "update_call_summary"; payload: any }
  | { type: string; payload: any };

export interface RealtimeAlohaSession {
  userId: string;
  callSid: string;
  streamSid: string;
  from: string;
  to: string;
  callRowId?: string;
  sendTwilioAudio(payloadBase64: string): Promise<void>;
  handleTwilioMedia(event: TwilioMediaEvent): Promise<void>;
  handleStop(): Promise<void>;
}

/**
 * Handle structured AI action messages.
 * For now, this logs and stubs out DB writes; you can extend this to
 * integrate with your existing leads, notes, and business config tables.
 */
export async function handleAiActionMessage(
  userId: string,
  action: AiActionMessage
): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();

    switch (action.type) {
      case "save_note": {
        // Example placeholder: persist to a generic notes table if available
        console.log("[AI Action] save_note", { userId, payload: action.payload });
        // TODO: Insert into a notes table or insight system
        break;
      }
      case "create_lead": {
        console.log("[AI Action] create_lead", { userId, payload: action.payload });
        // TODO: Insert into contact_profiles and/or a dedicated leads table
        break;
      }
      case "update_business_info": {
        console.log("[AI Action] update_business_info", { userId, payload: action.payload });
        // TODO: Update business profile / settings
        break;
      }
      case "update_call_summary": {
        console.log("[AI Action] update_call_summary", { userId, payload: action.payload });
        // TODO: Update calls table with summary/outcome
        break;
      }
      default: {
        console.warn("[AI Action] Unknown action type", action.type, action.payload);
      }
    }
  } catch (error) {
    console.error("Error handling AI action message:", error);
  }
}

/**
 * Utility to send audio back to Twilio over the media WebSocket.
 */
export async function handleAiAudioOut(
  twilioSocket: TwilioWebSocket,
  streamSid: string,
  audioPayloadBase64: string
): Promise<void> {
  const message = {
    event: "media",
    streamSid,
    media: {
      payload: audioPayloadBase64,
    },
  };

  // @ts-ignore - Edge WebSocket uses a compatible API
  twilioSocket.send(JSON.stringify(message));
}

/**
 * Create a minimal Realtime Aloha session abstraction.
 *
 * NOTE: This is a placeholder where you would integrate with OpenAI
 * Realtime (e.g., via WebSocket). The current implementation focuses on
 * Twilio + Supabase wiring so the surrounding architecture is ready.
 */
export async function createRealtimeAlohaSession(options: {
  userId: string;
  from: string;
  to: string;
  callSid: string;
  streamSid: string;
  twilioSocket: TwilioWebSocket;
}): Promise<RealtimeAlohaSession> {
  const { userId, from, to, callSid, streamSid, twilioSocket } = options;

  const supabase = getSupabaseServerClient();

  // Preload system prompt & context (assistant name, business name, voice)
  const { prompt: systemPrompt, context } = await buildAlohaSystemPrompt(userId);

  console.log("[Realtime Aloha] Starting session", {
    userId,
    callSid,
    streamSid,
    assistantName: context.assistantName,
    businessName: context.businessName,
    voice: context.voiceProfile.key,
  });

  // Create or look up contact and log the call skeleton
  const contact = await lookupOrCreateContact(userId, from);

  const { data: callRow, error: insertError } = await supabase
    .from("calls")
    .insert({
      user_id: userId,
      direction: "inbound",
      phone_number: to,
      caller_phone_number: from,
      contact_id: contact?.id ?? null,
      // Additional suggested fields; these columns may already exist:
      call_sid: callSid,
      started_at: new Date().toISOString(),
      summary: null,
      outcome: null,
      raw_context: {
        systemPrompt,
        businessContext: context.rawBusinessContext,
      },
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    console.error("Error inserting call row:", insertError);
  }

  const callRowId = callRow?.id as string | undefined;

  // Placeholder AI "session" – in a real implementation this would:
  // - Connect to OpenAI Realtime via WebSocket
  // - Stream Twilio audio in
  // - Receive audio + JSON actions back
  // - Call handleAiAudioOut(...) and handleAiActionMessage(...)

  const sendTwilioAudioFn = async (_payloadBase64: string) => {
    // TODO: Forward to OpenAI Realtime session
  };

  const handleTwilioMediaFn = async (event: TwilioMediaEvent) => {
    const payload = event.media?.payload;
    if (!payload) return;
    await sendTwilioAudioFn(payload);
  };

  return {
    userId,
    callSid,
    streamSid,
    from,
    to,
    callRowId,
    sendTwilioAudio: sendTwilioAudioFn,
    handleTwilioMedia: handleTwilioMediaFn,
    async handleStop() {
      console.log("[Realtime Aloha] Call stopped", {
        userId,
        callSid,
        streamSid,
        callRowId,
      });

      // Best-effort finalize call + contact
      try {
        const nowIso = new Date().toISOString();

        if (callRowId) {
          await supabase
            .from("calls")
            .update({
              ended_at: nowIso,
            })
            .eq("id", callRowId);
        }

        await updateContactAfterCall(userId, from, {
          last_called_at: nowIso,
        });
      } catch (error) {
        console.error("Error finalizing call/contact after stop:", error);
      }
    },
  };
}


