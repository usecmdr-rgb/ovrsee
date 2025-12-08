/**
 * AI Follow-Up Draft Generation
 * Generates follow-up email drafts based on lead context and thread history
 */

import { openai } from "@/lib/openai";
import { getThreadContext } from "./getThreadContext";
import { getBusinessContextForUser } from "./businessInfo";
import type { Lead, Contact } from "./crm";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { buildAIVoiceProfile } from "./aiVoiceProfile";

/**
 * Get user sync preferences for tone and follow-up settings
 */
async function getUserSyncPreferences(userId: string): Promise<{
  tone_preset?: string;
  tone_custom_instructions?: string | null;
  follow_up_intensity?: string;
} | null> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("user_sync_preferences")
      .select("tone_preset, tone_custom_instructions, follow_up_intensity")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.warn("[GenerateFollowUpDraft] Could not load user preferences:", error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.warn("[GenerateFollowUpDraft] Error loading user preferences:", error);
    return null;
  }
}

/**
 * Build tone instructions based on user preferences
 */
function buildToneInstructions(preferences: {
  tone_preset?: string;
  tone_custom_instructions?: string | null;
  follow_up_intensity?: string;
} | null): string {
  if (!preferences) {
    return "";
  }

  const { tone_preset, tone_custom_instructions, follow_up_intensity } = preferences;
  let toneGuidance = "";

  if (tone_preset === "friendly") {
    toneGuidance = "Use a warm, friendly tone with clear explanations. Be approachable and helpful.";
  } else if (tone_preset === "professional") {
    toneGuidance = "Use a concise, professional tone suitable for business communication. Be clear and direct.";
  } else if (tone_preset === "direct") {
    toneGuidance = "Be direct and concise, avoid unnecessary fluff. Get to the point quickly.";
  } else if (tone_preset === "custom" && tone_custom_instructions) {
    toneGuidance = tone_custom_instructions;
  }

  // Add follow-up intensity guidance
  if (follow_up_intensity === "light") {
    toneGuidance += " Use soft language and only nudge after longer gaps. Be gentle and non-pushy.";
  } else if (follow_up_intensity === "strong") {
    toneGuidance += " Be more proactive and use firmer language when appropriate. Show urgency when needed.";
  } else {
    toneGuidance += " Use a balanced approach for follow-ups.";
  }

  return toneGuidance ? `\n\nTONE & STYLE GUIDANCE:\n${toneGuidance}\n` : "";
}

export interface FollowUpDraftInput {
  userId: string;
  emailId: string;
  threadId?: string;
  lead: Lead;
  contact: Contact;
  followUpReason?: string;
}

/**
 * Generate a follow-up draft for a lead
 */
export async function generateFollowUpDraft(
  input: FollowUpDraftInput
): Promise<string> {
  const { userId, emailId, threadId, lead, contact, followUpReason } = input;

  // Get thread context
  let threadContext: string = "";
  if (threadId) {
    const thread = await getThreadContext(userId, threadId, emailId);
    if (thread) {
      if (thread.threadSummary) {
        threadContext += `Thread Summary: ${thread.threadSummary}\n\n`;
      }
      if (thread.recentMessages.length > 0) {
        threadContext += "Recent Messages:\n";
        thread.recentMessages.forEach((msg, idx) => {
          const sender = msg.isFromUser ? "You" : msg.senderName || msg.sender;
          threadContext += `${idx + 1}. ${sender}: ${msg.bodyText.substring(0, 200)}...\n`;
        });
      }
    }
  }

  // Get business context
  const businessContext = await getBusinessContextForUser(userId);
  let businessInfo = "";
  if (businessContext?.profile) {
    businessInfo += `Business: ${businessContext.profile.business_name}\n`;
    if (businessContext.profile.description) {
      businessInfo += `Description: ${businessContext.profile.description}\n`;
    }
  }

  // Build lead context
  const leadContext = `
Lead Information:
- Stage: ${lead.lead_stage}
- Score: ${lead.lead_score}/100
- Budget: ${lead.budget || "Not specified"}
- Timeline: ${lead.timeline || "Not specified"}
- Last Activity: ${new Date(lead.last_activity_at).toLocaleDateString()}
${followUpReason ? `- Follow-up Reason: ${followUpReason}` : ""}
`;

  // Get user preferences for tone
  const userPreferences = await getUserSyncPreferences(userId);
  
  // Build AI voice profile
  const voiceProfile = buildAIVoiceProfile({
    tonePreset: userPreferences?.tone_preset as any,
    toneCustomInstructions: userPreferences?.tone_custom_instructions,
    followUpIntensity: userPreferences?.follow_up_intensity as any,
    lead: {
      stage: lead.lead_stage,
      score: lead.lead_score,
      urgencyLevel: "medium", // Could be enhanced with CRM extraction data
    },
    businessContext,
  });

  // Build prompt
  const systemPrompt = `You are a professional email assistant helping to write follow-up emails. Your task is to write a concise, polite, and professional follow-up email that:

1. References the previous conversation naturally
2. Is appropriate for the lead stage (${lead.lead_stage})
3. Moves the conversation forward without being pushy
4. Matches the business's brand voice
5. Is personalized to the contact (${contact.name || contact.email})

${voiceProfile}

Guidelines:
- Keep it brief (2-4 sentences, or slightly longer if using bullet points)
- Structure with: brief greeting, context alignment, key points (use bullets if multiple items), clear CTA
- Be warm but professional
- Reference specific details from the thread if relevant
- If budget/timeline was discussed, acknowledge it
- If this is a "no_reply" follow-up, be gentle and offer value
- Use bullet points (•) for lists when appropriate

Return ONLY the email body text, no subject line or additional formatting.`;

  const userPrompt = `Generate a follow-up email draft:

${businessInfo}

${leadContext}

${threadContext ? `\n${threadContext}` : ""}

Contact: ${contact.name || contact.email}${contact.company ? ` at ${contact.company}` : ""}

Write a follow-up email that is appropriate for this lead stage and context.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const draft = response.choices[0]?.message?.content?.trim() || "";
    return draft;
  } catch (error: any) {
    console.error("[GenerateFollowUpDraft] Error generating draft:", error);
    throw new Error(`Failed to generate follow-up draft: ${error.message}`);
  }
}

