/**
 * Aloha Voicemail Script Generator
 * 
 * Generates voicemail-specific scripts and system prompts for Aloha
 * when operating in voicemail mode.
 */

import { getAlohaDisplayName } from "./profile";
import { getBusinessContext } from "@/lib/business-context";

/**
 * Generate voicemail greeting script
 */
export function generateVoicemailGreeting(displayName: string, businessName: string): string {
  return `Hi, you've reached ${businessName}. This is ${displayName}. The call couldn't be answered right now, but I can take a quick message for you.`;
}

/**
 * Generate voicemail system prompt
 */
export async function generateVoicemailSystemPrompt(
  userId: string
): Promise<string> {
  const [displayName, businessContext] = await Promise.all([
    getAlohaDisplayName(userId),
    getBusinessContext(userId),
  ]);

  const businessName = businessContext?.profile.businessName || "our business";

  return `You are ${displayName}, handling voicemail for ${businessName}.

VOICEMAIL MODE:
You are operating in voicemail mode. This means the call couldn't be answered, and you're collecting a message.

YOUR GOAL:
Collect a brief message from the caller with:
1. Caller's name (if not obvious from caller ID)
2. Reason for calling
3. Best callback number (if needed)
4. Optional: Best time to reach them

BEHAVIOR:
- Keep the conversation brief and focused
- Be friendly but efficient
- Don't engage in long conversations
- This is voicemail, not a full call
- Get the essential information quickly

GREETING:
Start with: "Hi, you've reached ${businessName}. This is ${displayName}. The call couldn't be answered right now, but I can take a quick message for you."

CLOSING:
End with: "Thanks, I'll pass this along to the team."

IMPORTANT:
- If caller asks complex questions, politely say: "I'm just taking messages right now. Someone will call you back to answer that."
- If caller wants to speak to someone immediately, say: "I understand you'd like to speak with someone. I'll make sure they get your message and call you back as soon as possible."
- Keep responses short - this is voicemail, not a consultation

${businessContext?.profile.services ? `Available services: ${Array.isArray(businessContext.profile.services) ? businessContext.profile.services.join(", ") : businessContext.profile.services}` : ""}
${businessContext?.profile.hours ? `Business hours: ${businessContext.profile.hours}` : ""}
${businessContext?.profile.location ? `Location: ${businessContext.profile.location}` : ""}
`;
}










