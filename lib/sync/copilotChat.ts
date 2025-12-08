/**
 * Copilot Chat Helper
 * Conversational AI assistant for email context
 * Can answer questions, provide suggestions, and optionally update drafts
 */

import { openai } from "@/lib/openai";
import { updateDraftWithInstructions } from "./updateDraftWithInstructions";
import { getThreadContext } from "./getThreadContext";
import { getBusinessContextForUser } from "./businessInfo";
import { buildAIVoiceProfile } from "./aiVoiceProfile";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getLeadForContact, type Lead } from "./crm";
import { getAvailableTimeSlots, formatTimeSlotForAI } from "./smartScheduling";

export type SyncChatResponse =
  | { type: "answer"; message: string }
  | { type: "draft_update"; message: string; draftBody: string }
  | { type: "clarification"; message: string };

export interface CopilotChatInput {
  userId: string;
  emailId: string;
  userMessage: string;
  draftBody?: string | null;
  threadId?: string;
  emailSubject?: string;
  fromAddress?: string;
}

/**
 * Run Sync Chat - conversational assistant for email context
 */
export async function runSyncChat(
  input: CopilotChatInput
): Promise<SyncChatResponse> {
  const { userId, emailId, userMessage, draftBody, threadId, emailSubject, fromAddress } = input;

  const supabase = getSupabaseServerClient();

  // Get thread context
  let threadContext = "";
  let threadMessages: Array<{ sender: string; body: string; isFromUser: boolean }> = [];
  let lastCustomerMessageSummary = "";
  if (threadId) {
    const thread = await getThreadContext(userId, threadId, emailId);
    if (thread) {
      if (thread.threadSummary) {
        threadContext += `Thread Summary: ${thread.threadSummary}\n\n`;
      }
      if (thread.recentMessages.length > 0) {
        threadContext += "Recent Messages:\n";
        thread.recentMessages.slice(0, 5).forEach((msg, idx) => {
          const sender = msg.isFromUser ? "You" : msg.senderName || msg.sender;
          threadContext += `${idx + 1}. ${sender}: ${msg.bodyText.substring(0, 200)}...\n`;
          threadMessages.push({
            sender: msg.isFromUser ? "You" : msg.senderName || msg.sender,
            body: msg.bodyText,
            isFromUser: msg.isFromUser,
          });
        });
        // Extract last customer message
        const lastCustomerMsg = thread.recentMessages.filter(m => !m.isFromUser).slice(-1)[0];
        if (lastCustomerMsg) {
          lastCustomerMessageSummary = lastCustomerMsg.bodyText.substring(0, 300);
        }
      }
    }
  }

  // Get business context
  const businessContext = await getBusinessContextForUser(userId);
  const businessInfo = businessContext
    ? {
        name: businessContext.profile?.business_name || "",
        services: (businessContext.services || []).map((s) => ({
          name: s.name,
          description: s.description || "",
        })),
        pricing: (businessContext.pricingTiers || []).map((t) => ({
          name: t.name,
          price: Number(t.price_amount) || 0,
          currency: t.price_currency || "USD",
          interval: t.billing_interval || "one_time",
        })),
        hours: businessContext.hours
          ?.map((h) => {
            const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            return `${dayNames[h.day_of_week]}: ${h.is_closed ? "Closed" : `${h.open_time}-${h.close_time}`}`;
          })
          .join(", "),
        faqs: businessContext.faqs || [],
      }
    : null;

  // Get user tone preferences
  const { data: preferences } = await supabase
    .from("user_sync_preferences")
    .select("tone_preset, tone_custom_instructions, follow_up_intensity")
    .eq("user_id", userId)
    .single();

  const voiceProfile = buildAIVoiceProfile(preferences || null);
  
  // Generate tone description for chat responses
  const toneDescription = preferences
    ? preferences.tone_preset === "friendly"
      ? "Use a warm, friendly, conversational tone. Be approachable and helpful."
      : preferences.tone_preset === "professional"
      ? "Use a concise, professional tone. Be clear and direct without being overly casual."
      : preferences.tone_preset === "direct"
      ? "Use a direct, concise tone. Get to the point quickly while remaining polite."
      : preferences.tone_preset === "custom" && preferences.tone_custom_instructions
      ? `Use this custom tone: ${preferences.tone_custom_instructions}`
      : "Use a professional, helpful tone."
    : "Use a professional, helpful tone.";

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
        // Type assertion to include Phase 6 fields that exist in DB but not in TypeScript interface yet
        const leadWithExtras = lead as Lead & {
          potential_value?: number | null;
          currency?: string | null;
          primary_opportunity_type?: string | null;
          primary_opportunity_strength?: string | null;
        };
        leadInfo = {
          stage: lead.lead_stage,
          score: lead.lead_score,
          budget: lead.budget,
          timeline: lead.timeline,
          potential_value: leadWithExtras.potential_value,
          currency: leadWithExtras.currency,
          primary_opportunity_type: leadWithExtras.primary_opportunity_type,
          primary_opportunity_strength: leadWithExtras.primary_opportunity_strength,
        };
      }
    }
  }

  // Get email intelligence (tasks, appointments, opportunities)
  const { data: tasks } = await supabase
    .from("email_tasks")
    .select("description, status")
    .eq("user_id", userId)
    .eq("email_id", emailId);

  const { data: appointments } = await supabase
    .from("email_appointments")
    .select("title, start_at")
    .eq("user_id", userId)
    .eq("email_id", emailId);

  const { data: opportunities } = await supabase
    .from("lead_opportunities")
    .select("type, strength, summary")
    .eq("user_id", userId)
    .eq("email_id", emailId)
    .limit(5);

  // Build system prompt
  const systemPrompt = `You are **Sync**, the user's AI email, calendar, and light CRM assistant inside OVRSEE.

Your job:
- Help the user understand and respond to a specific email thread.
- Use the user's business info, services, pricing, and availability.
- Respect their tone preferences.
- Think like an executive assistant + SDR who understands deals, leads, and revenue.

You always have access to structured context, which may include:
- The current email and previous messages in the thread.
- A summary of the thread.
- Lead information: stage, lead score, potential value, opportunities, notes.
- Business information: services, pricing, hours, FAQs, policies.
- Calendar and appointment info: upcoming availability and existing bookings.
- User tone preferences (friendly, professional, direct, custom instructions).
- The current draft email body (if one exists).

### How you should behave

1. **Understand intent first**
   - If the user is asking a question about the email, the customer, the lead, or what to do → you should answer and advise.
   - If the user is clearly asking you to change the email (shorten, rewrite, change tone, add pricing, suggest times, etc.) → you should update the draft.
   - If the user's request is vague ("What do you think?") → you should ask a clarifying question with a few concrete options.

2. **Response types**
   You must choose exactly ONE of these types and respond as JSON:

   - \`"answer"\`:
     - Use when the user is seeking understanding or advice.
     - Explain what the customer wants, what stage the lead seems to be in, what options the user has, and what you recommend next.
     - Use the context: refer to the last customer message, lead stage, lead score, and relevant services/pricing when helpful.
     - End with a short, helpful suggestion for what the user can ask you next or what you can do (e.g., "If you'd like, I can now rewrite the draft with this approach.").

   - \`"draft_update"\`:
     - Use when the user clearly wants the email draft changed.
     - Apply the user's instructions to the existing draft.
     - Keep all factual information (prices, dates, commitments, policies) accurate and unchanged unless the user explicitly asks to change them.
     - Respect business info: never invent new products, prices, or discounts.
     - Respect tone preferences (friendly / professional / direct / custom).
     - Preserve the core intent of the draft while improving clarity, tone, and structure.
     - Explain briefly in \`message\` what you changed (e.g., "Shortened the intro, made the tone friendlier, and added two time slots for next week based on your availability.").

   - \`"clarification"\`:
     - Use when the user's request is not clear enough to decide whether they want advice or a draft edit.
     - Ask a clear, concrete follow-up question.
     - Whenever possible, offer 2–3 specific options they can choose (e.g., "Do you want a summary of this thread, advice on what to say, or for me to rewrite the draft?").

3. **Tone and style**
   ${voiceProfile ? `\nDRAFT TONE & STYLE (for draft updates):\n${voiceProfile}\n` : ""}
   - **Chat responses** (all types): Match this tone: ${toneDescription}
   - **Draft updates**: Use the tone profile above, which matches the user's preferences.
   - For chat responses, be concise but helpful, and match the user's tone preference.
   - For draft updates, aim for:
     - A short, clear opening.
     - Logical structure (paragraphs or bullet points when appropriate).
     - A clear call-to-action when the situation calls for it (e.g., propose times, ask for confirmation, next step).

4. **Use context intelligently**
   - Use lead stage, lead score, and opportunities to influence your advice:
     - Warm/negotiating/ready_to_close → lean more into a strong, confident CTA.
     - Early stage → focus more on understanding, value, and next steps.
   - Use business info to keep details correct:
     - Do NOT invent prices or services not provided.
     - Only mention services and prices that exist in the business context.
   - Use availability and business hours when suggesting times:
     - Suggest realistic time slots that fall within business hours and do not conflict with known commitments.

5. **Safety and factual accuracy**
   - Never fabricate:
     - Prices, discounts, or payment terms.
     - Dates, times, or locations.
     - Legal or contractual language.
   - If information is missing or ambiguous, say so and either:
     - Ask the user to clarify, OR
     - Suggest how they could phrase it generically.

6. **Language and localization**
   - Reply in the same language as the user's draft or question unless they explicitly ask you to translate.
   - If the thread is in one language and the user writes in another, prefer the language the user is using now, unless instructed otherwise.

### Output format

You must ALWAYS respond as valid JSON in this exact shape:

{
  "type": "answer" | "draft_update" | "clarification",
  "message": "string with your response or explanation",
  "draftBody": "string with the updated draft, ONLY for type === 'draft_update'; omit or null otherwise"
}

Do not include any extra top-level keys. Do not wrap your JSON in backticks or prose.`;

  // Build user prompt with all context
  const userPrompt = `User message: ${userMessage}

EMAIL CONTEXT:
- Subject: ${emailSubject || "(No subject)"}
- From: ${fromAddress || "Unknown"}

${threadContext ? `\n${threadContext}` : ""}

${lastCustomerMessageSummary ? `\nLAST CUSTOMER MESSAGE SUMMARY:\n"${lastCustomerMessageSummary}"\n` : ""}

${businessInfo ? `\nBUSINESS INFORMATION:\n- Name: ${businessInfo.name}\n- Services: ${businessInfo.services.map((s) => `${s.name}${s.description ? `: ${s.description}` : ""}`).join(", ")}\n- Pricing: ${businessInfo.pricing.map((p) => `${p.name}: $${p.price} ${p.currency}/${p.interval}`).join(", ")}\n- Hours: ${businessInfo.hours || "Not specified"}\n- FAQs: ${businessInfo.faqs.map((f) => `Q: ${f.question} A: ${f.answer}`).join("\n") || "None"}` : ""}

${leadInfo ? `\nLEAD INFORMATION:\n- Stage: ${leadInfo.stage}\n- Score: ${leadInfo.score}/100\n- Budget: ${leadInfo.budget || "Not specified"}\n- Timeline: ${leadInfo.timeline || "Not specified"}\n- Potential Value: ${leadInfo.potential_value ? `$${leadInfo.potential_value} ${leadInfo.currency || "USD"}` : "Not set"}\n- Primary Opportunity: ${leadInfo.primary_opportunity_type || "None"} (${leadInfo.primary_opportunity_strength || "N/A"})` : ""}

${opportunities && opportunities.length > 0 ? `\nDETECTED OPPORTUNITIES:\n${opportunities.map((o) => `- ${o.type} (${o.strength}): ${o.summary}`).join("\n")}` : ""}

${tasks && tasks.length > 0 ? `\nTASKS:\n${tasks.map((t) => `- ${t.description} (${t.status})`).join("\n")}` : ""}

${appointments && appointments.length > 0 ? `\nAPPOINTMENTS:\n${appointments.map((a) => `- ${a.title} on ${new Date(a.start_at).toLocaleDateString()}`).join("\n")}` : ""}

${draftBody ? `\nCURRENT DRAFT:\n${draftBody}` : "\nNo draft exists yet."}`;

  // Check if user is asking about scheduling/time slots
  const lowerMessage = userMessage.toLowerCase();
  const isSchedulingRequest = lowerMessage.includes("time slot") || 
                              lowerMessage.includes("schedule") || 
                              lowerMessage.includes("availability") ||
                              lowerMessage.includes("when are you available") ||
                              lowerMessage.includes("suggest") && (lowerMessage.includes("time") || lowerMessage.includes("slot"));

  // Get available time slots if this is a scheduling request
  let availableTimeSlots: string[] = [];
  if (isSchedulingRequest && threadId) {
    try {
      // Get time slots for next 7 days
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      endDate.setHours(23, 59, 59, 999);

      const slots = await getAvailableTimeSlots({
        userId,
        dateRange: {
          start: startDate,
          end: endDate,
        },
        businessHoursAware: true,
      });
      availableTimeSlots = slots.slice(0, 10).map(formatTimeSlotForAI); // Limit to top 10
    } catch (error) {
      console.warn("[CopilotChat] Could not load available time slots:", error);
    }
  }

  // Add time slots to user prompt if available
  const timeSlotsContext = availableTimeSlots.length > 0
    ? `\n--- AVAILABLE TIME SLOTS FOR SCHEDULING ---\nWhen suggesting meeting times, use ONLY these available slots:\n${availableTimeSlots.map((slot, idx) => `${idx + 1}. ${slot}`).join("\n")}\n--- END AVAILABLE TIME SLOTS ---\n`
    : "";

  const finalUserPrompt = `${userPrompt}${timeSlotsContext}

INSTRUCTIONS:
- When giving advice, reference specific context (e.g., "In the last message, the customer asked about...", "This lead is in stage '${leadInfo?.stage || "unknown"}' with a score of ${leadInfo?.score || "N/A"}/100", "Your ${businessInfo?.pricing?.[0]?.name || "Premium"} package is $${businessInfo?.pricing?.[0]?.price || "N/A"}/${businessInfo?.pricing?.[0]?.interval || "month"}")
- For 'answer' responses, end with a helpful suggestion like "If you'd like, I can also: [suggested actions]"
- For 'clarification' responses, provide 2-3 concrete options
- Match the chat tone: ${toneDescription}
${availableTimeSlots.length > 0 ? `- When suggesting time slots, use ONLY the available slots listed above. Do NOT invent times.` : ""}

Respond to the user's message. Choose the appropriate type (answer, draft_update, or clarification) and format your response as JSON.`;

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
          content: finalUserPrompt,
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

    // Validate response structure
    if (!parsed.type || !parsed.message) {
      throw new Error("Invalid response format from AI");
    }

    const type = parsed.type as "answer" | "draft_update" | "clarification";

    // Handle draft_update case - use the helper to ensure quality
    if (type === "draft_update") {
      if (!draftBody) {
        // If no draft exists, return clarification
        return {
          type: "clarification",
          message: "There's no draft to update yet. Would you like me to generate one first, or are you asking something else?",
        };
      }

      // Extract instructions from user message or use AI's reasoning
      const instructions = parsed.instructions || userMessage;

      // Use the existing helper for draft updates
      const draftResult = await updateDraftWithInstructions({
        userId,
        emailId,
        threadId: threadId || undefined,
        currentDraft: draftBody,
        instructions,
        emailSubject: emailSubject || undefined,
        fromAddress: fromAddress || undefined,
      });

      return {
        type: "draft_update",
        message: parsed.message || draftResult.explanation || "I've updated the draft based on your request.",
        draftBody: draftResult.draftBody,
      };
    }

    // Return answer or clarification
    return {
      type,
      message: parsed.message,
      ...(type === "draft_update" && parsed.draftBody ? { draftBody: parsed.draftBody } : {}),
    } as SyncChatResponse;
  } catch (error: any) {
    console.error("[CopilotChat] Error:", error);
    
    // If JSON parsing fails, try to extract a message
    if (error.message?.includes("JSON") || error.message?.includes("parse")) {
      return {
        type: "answer",
        message: "I encountered an error processing your request. Could you try rephrasing it?",
      };
    }

    throw new Error(`Failed to process chat: ${error.message}`);
  }
}


