/**
 * Update Draft With Instructions
 * Takes a current draft and user instructions, returns a revised draft
 */

import { openai } from "@/lib/openai";
import { getThreadContext } from "./getThreadContext";
import { getBusinessContextForUser } from "./businessInfo";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { buildAIVoiceProfile } from "./aiVoiceProfile";
import { getLeadForContact } from "./crm";

export interface UpdateDraftInput {
  userId: string;
  emailId: string;
  threadId?: string;
  currentDraft: string;
  instructions: string;
  emailSubject?: string;
  fromAddress?: string;
}

/**
 * Update a draft based on user instructions
 * Maintains tone, business info, and context while applying changes
 */
export async function updateDraftWithInstructions(
  input: UpdateDraftInput
): Promise<{ draftBody: string; explanation?: string }> {
  const { userId, emailId, threadId, currentDraft, instructions, emailSubject, fromAddress } = input;

  // Get context
  const supabase = getSupabaseServerClient();

  // Get email details
  const { data: email } = await supabase
    .from("email_queue")
    .select("id, subject, body_text, body_html, gmail_thread_id, from_address, from_name")
    .eq("id", emailId)
    .eq("user_id", userId)
    .single();

  if (!email) {
    throw new Error("Email not found");
  }

  // Get thread context
  let threadContext = "";
  if (threadId || email.gmail_thread_id) {
    const thread = await getThreadContext(userId, threadId || email.gmail_thread_id || "", emailId);
    if (thread) {
      if (thread.threadSummary) {
        threadContext += `Thread Summary: ${thread.threadSummary}\n\n`;
      }
      if (thread.recentMessages.length > 0) {
        threadContext += "Recent Messages:\n";
        thread.recentMessages.slice(0, 5).forEach((msg, idx) => {
          const sender = msg.isFromUser ? "You" : msg.senderName || msg.sender;
          threadContext += `${idx + 1}. ${sender}: ${msg.bodyText.substring(0, 200)}...\n`;
        });
      }
    }
  }

  // Get business context
  const businessContext = await getBusinessContextForUser(userId);
  const businessInfo = businessContext
    ? {
        name: businessContext.profile?.businessName || "",
        services: (businessContext.services || []).map((s) => ({
          name: s.name,
          description: s.description || "",
        })),
        pricing: (businessContext.pricingTiers || []).map((t) => ({
          name: t.name,
          price: Number(t.price_amount) || 0,
          currency: t.currency || "USD",
          interval: t.billing_interval || "one_time",
        })),
        hours: businessContext.hours
          ?.map((h) => `${h.day}: ${h.is_closed ? "Closed" : `${h.open_time}-${h.close_time}`}`)
          .join(", "),
      }
    : null;

  // Get user tone preferences
  const { data: preferences } = await supabase
    .from("user_sync_preferences")
    .select("tone_preset, tone_custom_instructions, follow_up_intensity")
    .eq("user_id", userId)
    .single();

  const voiceProfile = buildAIVoiceProfile(preferences || null);

  // Get lead info if available
  let leadInfo = null;
  if (fromAddress) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("user_id", userId)
      .eq("email", fromAddress)
      .maybeSingle();

    if (contact) {
      const lead = await getLeadForContact(userId, contact.id);
      if (lead) {
        leadInfo = {
          stage: lead.lead_stage,
          score: lead.lead_score,
          budget: lead.budget,
          timeline: lead.timeline,
        };
      }
    }
  }

  // Build prompt
  const systemPrompt = `You are Sync, the user's email assistant. Your task is to update an email draft based on user instructions while maintaining accuracy and context.

CRITICAL RULES:
1. Keep the same tone and style unless the user explicitly asks to change it
2. Use ONLY business information that is provided - do NOT invent new prices, services, or details
3. Maintain the same level of formality unless instructed otherwise
4. Keep all factual information accurate (dates, names, references)
5. Apply the user's instructions precisely
6. Do not add information that wasn't in the original draft or business context
7. Keep the email professional and appropriate for the context

${voiceProfile ? `\nTONE & STYLE:\n${voiceProfile}\n` : ""}

Return a JSON object with:
- draftBody: the revised draft text
- explanation: a brief 1-2 sentence summary of what you changed`;

  const userPrompt = `Update this email draft based on the user's instructions:

CURRENT DRAFT:
${currentDraft}

USER INSTRUCTIONS:
${instructions}

EMAIL CONTEXT:
- Subject: ${emailSubject || email.subject || "(No subject)"}
- From: ${email.from_name || fromAddress || "Unknown"}

${threadContext ? `\n${threadContext}` : ""}

${businessInfo ? `\nBUSINESS INFORMATION:\n- Name: ${businessInfo.name}\n- Services: ${businessInfo.services.map((s) => s.name).join(", ")}\n- Pricing: ${businessInfo.pricing.map((p) => `${p.name}: $${p.price} ${p.currency}`).join(", ")}\n- Hours: ${businessInfo.hours || "Not specified"}` : ""}

${leadInfo ? `\nLEAD INFORMATION:\n- Stage: ${leadInfo.stage}\n- Score: ${leadInfo.score}/100\n- Budget: ${leadInfo.budget || "Not specified"}\n- Timeline: ${leadInfo.timeline || "Not specified"}` : ""}

Apply the user's instructions to the draft. Return the updated draft and a brief explanation of changes.`;

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
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);

    return {
      draftBody: parsed.draftBody || currentDraft,
      explanation: parsed.explanation || "Draft updated based on your instructions.",
    };
  } catch (error: any) {
    console.error("[UpdateDraftWithInstructions] Error:", error);
    throw new Error(`Failed to update draft: ${error.message}`);
  }
}


