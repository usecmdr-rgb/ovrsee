import { getBusinessContext } from "@/lib/business-context";
import {
  getAlohaProfile,
  getAlohaSelfName,
  getAlohaVoiceProfile,
} from "@/lib/aloha/profile";
import type { AlohaVoiceProfile } from "@/lib/aloha/voice-profiles";

export interface AlohaRuntimeContext {
  userId: string;
  assistantName: string;
  businessName: string;
  voiceProfile: AlohaVoiceProfile;
  rawBusinessContext: Awaited<ReturnType<typeof getBusinessContext>> | null;
}

/**
 * Load unified Aloha context for a user:
 * - Assistant name (self-name or display name, fallback "Aloha")
 * - Business name (fallback "this business")
 * - Selected voice profile (one of 4)
 * - Raw business context blob
 */
export async function getBusinessContextForUser(
  userId: string
): Promise<AlohaRuntimeContext> {
  const [profile, selfName, voiceProfile, businessContext] =
    await Promise.all([
      getAlohaProfile(userId),
      getAlohaSelfName(userId),
      getAlohaVoiceProfile(userId),
      getBusinessContext(userId).catch((error) => {
        console.error("Error loading business context for Aloha:", error);
        return null;
      }),
    ]);

  const assistantName =
    selfName?.trim() ||
    profile?.display_name?.trim() ||
    "Aloha";

  const businessName =
    businessContext?.profile.businessName?.trim() || "this business";

  return {
    userId,
    assistantName,
    businessName,
    voiceProfile,
    rawBusinessContext: businessContext,
  };
}

/**
 * Build the core system prompt for realtime Aloha calls.
 * This prompt is appended to any lower-level state/tone logic.
 */
export async function buildAlohaSystemPrompt(
  userId: string
): Promise<{ prompt: string; context: AlohaRuntimeContext }> {
  const ctx = await getBusinessContextForUser(userId);

  const { assistantName, businessName, voiceProfile } = ctx;

  const prompt = `
You are ${assistantName}, the AI phone receptionist for ${businessName}.

CRITICAL IDENTITY RULES:
- Always refer to yourself as "${assistantName}".
- Never use any other name unless assistantName is exactly "Aloha".

VOICE CONFIGURATION:
- Use the selected voice profile: ${voiceProfile.key} (OpenAI voice: ${voiceProfile.openaiVoiceId}).
- Your default speaking style should match this voice's tone preset (${voiceProfile.tonePreset}).

ROLE & BEHAVIOR:
- Be helpful, friendly, concise, and fully represent this business.
- You have access to business information, hours, services, notes, and past calls.
- Greet callers appropriately (e.g., "Thank you for calling ${businessName}, this is ${assistantName}.").
- If you don't know something, say you'll have someone follow up instead of guessing.
- You can take messages, log notes, create leads, and summarize calls for the business owner.

CALL HANDLING:
- Handle real-world caller behavior: interruptions, silence, background noise, emotional callers.
- If the caller is angry or upset, respond calmly and empathetically.
- If the caller tests if you're AI, be honest: "I'm ${assistantName}, an AI assistant for ${businessName}."
- Never provide medical, legal, or financial advice; defer to a human.

STRUCTURED ACTIONS:
- When appropriate, emit JSON action messages (save_note, create_lead, update_business_info, update_call_summary)
  in addition to natural language so the system can update its records.

You are currently on a live phone call. Keep responses short (1-3 sentences) and conversational.
`;

  return { prompt, context: ctx };
}

/**
 * Resolve the OpenAI voice ID for the user's selected Aloha voice.
 */
export async function resolveAssistantVoice(
  userId: string
): Promise<string> {
  const voiceProfile = await getAlohaVoiceProfile(userId);
  return voiceProfile.openaiVoiceId;
}




