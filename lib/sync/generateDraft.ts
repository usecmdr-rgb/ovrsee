/**
 * Email Draft Generation Helper
 * Uses OpenAI to generate draft replies for emails
 * Supports thread-aware draft generation when enabled
 */

import { openai } from "@/lib/openai";
import { getBusinessContext } from "@/lib/business-context";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getThreadContext, type ThreadContext } from "@/lib/sync/getThreadContext";
import { isThreadContextForDraftsEnabled, isBusinessInfoAwareDraftsEnabled, isSmartSchedulingSuggestionsEnabled } from "@/lib/sync/featureFlags";
import { getBusinessContextForUser } from "@/lib/sync/businessInfo";
import { getAvailableTimeSlots, formatTimeSlotForAI } from "@/lib/sync/smartScheduling";
import { buildAIVoiceProfile } from "@/lib/sync/aiVoiceProfile";
import { getLeadForContact } from "@/lib/sync/crm";

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
      console.warn("[GenerateDraft] Could not load user preferences:", error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.warn("[GenerateDraft] Error loading user preferences:", error);
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

  // Add follow-up intensity guidance if relevant
  if (follow_up_intensity === "light") {
    toneGuidance += " For follow-ups, use soft language and only nudge after longer gaps.";
  } else if (follow_up_intensity === "strong") {
    toneGuidance += " For follow-ups, be more proactive and use firmer language when appropriate.";
  }

  return toneGuidance ? `\n\nTONE & STYLE GUIDANCE:\n${toneGuidance}\n` : "";
}

export interface DraftGenerationResult {
  draft: string;
  rawResponse?: any;
}

const SYSTEM_PROMPT_BASE = `You are OVRSEE Sync, an AI assistant that helps draft professional email replies. Your role is to:

1. Read the incoming email carefully
2. Understand the context and what the sender is asking for
3. Generate a helpful, professional, and concise draft reply
4. Match the tone of the original email (formal, casual, etc.)
5. Address all questions or requests in the email
6. Be concise but complete - aim for 2-4 sentences unless more detail is needed

Guidelines:
- Use a professional but friendly tone
- Be specific and actionable
- If the email asks a question, provide a clear answer
- If the email requests something, acknowledge and provide next steps
- If you don't have enough information to answer, say so politely
- Keep it brief - users can edit the draft before sending

Return ONLY the draft reply text, no additional commentary or formatting.`;

const SYSTEM_PROMPT_WITH_THREAD = `You are OVRSEE Sync, an AI assistant that helps draft professional email replies. Your role is to:

1. Read the incoming email carefully
2. Understand the context and what the sender is asking for
3. Generate a helpful, professional, and concise draft reply
4. Match the tone of the original email (formal, casual, etc.)
5. Address all questions or requests in the email
6. Be concise but complete - aim for 2-4 sentences unless more detail is needed

CRITICAL - THREAD CONTEXT AWARENESS:
- You have access to previous emails in this conversation thread
- Read and respect prior context in the thread
- Be consistent with previous commitments (timeframes, pricing, agreements)
- If there is ongoing scheduling discussion, maintain continuity and clarity
- If there are detected tasks or deadlines, respond in a way that acknowledges or updates them when appropriate
- Avoid hallucinating attachments or facts not supported by the thread
- Address the latest message directly
- Optionally reference prior messages when it clarifies context ("As mentioned in my last email…"), but not excessively
- Do NOT repeat information already covered in previous emails unless it's necessary for clarity

CRITICAL - BUSINESS INFORMATION AWARENESS:
- You have access to the business's services, pricing, hours, and FAQs
- Use ONLY the pricing and services provided in the BUSINESS INFORMATION section
- NEVER invent or guess prices, services, or policies that are not explicitly provided
- If customer asks about pricing:
  - Identify which product/service is relevant from the provided list
  - Respond with accurate pricing details (plan name, price, billing interval) from BUSINESS INFORMATION
  - Only offer upsell suggestions if clearly relevant and the upsell service exists in BUSINESS INFORMATION
- If customer asks "what do you offer?":
  - Summarize key services from BUSINESS INFORMATION
  - Reference specific pricing tiers when relevant
- If business hours or policies are relevant:
  - Use business hours and FAQs from BUSINESS INFORMATION
  - Do not make up hours or policies
- Match the brand voice specified in BUSINESS INFORMATION (formal, friendly, casual_professional, etc.)
- If no business profile exists or pricing is missing:
  - Offer to send a custom quote rather than inventing prices
  - Be helpful but honest about what information is available

CRITICAL - SMART SCHEDULING:
- If available time slots are provided, use ONLY those specific times
- Do NOT invent or suggest times that are not in the availableTimeSlots list
- Offer 2-3 concrete time slot options when responding to scheduling requests
- If no free slots are available in the provided range:
  - Politely explain that you're fully booked in that period
  - Suggest checking back later or offer a generic alternative (e.g., "next week") without fabricating exact times
- Format time slots clearly and include timezone when relevant

Guidelines:
- Use a professional but friendly tone (match brand_voice from BUSINESS INFORMATION if provided)
- Be specific and actionable
- If the email asks a question, provide a clear answer
- If the email requests something, acknowledge and provide next steps
- If you don't have enough information to answer, say so politely
- Keep it brief - users can edit the draft before sending
- Structure the email with:
  * Brief greeting (unless tone=direct)
  * 1-sentence context alignment
  * Bullet points for key information when listing multiple items
  * Clear CTA at the end
  * Optional soft close for friendly tone

Return ONLY the draft reply text, no additional commentary or formatting. Use bullet points (•) for lists when appropriate.`;

/**
 * Generate a draft reply for an email
 * 
 * @param userId - User ID for business context
 * @param fromAddress - Email sender address
 * @param fromName - Email sender name (optional)
 * @param subject - Email subject line
 * @param bodyText - Plain text body of the email
 * @param bodyHtml - HTML body of the email (optional, will use bodyText if not provided)
 * @param emailId - Email ID (optional, required for thread context)
 * @param threadId - Gmail thread ID (optional, required for thread context)
 * @returns Draft reply text
 */
export async function generateEmailDraft(
  userId: string,
  fromAddress: string,
  fromName: string | null | undefined,
  subject: string,
  bodyText: string | null | undefined,
  bodyHtml: string | null | undefined,
  emailId?: string,
  threadId?: string
): Promise<DraftGenerationResult> {
  try {
    // Get thread context if enabled and threadId is available
    let threadContext: ThreadContext | null = null;
    if (isThreadContextForDraftsEnabled() && emailId && threadId) {
      try {
        threadContext = await getThreadContext(userId, threadId, emailId);
        if (threadContext.recentMessages.length === 0 && !threadContext.threadSummary) {
          // No useful thread context, set to null
          threadContext = null;
        }
      } catch (error) {
        // Log error but continue without thread context (graceful fallback)
        console.warn("[GenerateDraft] Could not load thread context, continuing without it:", error);
        threadContext = null;
      }
    }

    // Get business context for personalization
    let businessContext = "";
    let businessInfoContext = "";
    let availableTimeSlots: string[] = [];
    
    try {
      const context = await getBusinessContext(userId);
      if (context) {
        businessContext = `\n\nBusiness Context:\n- Business Name: ${context.businessName || "N/A"}\n- Services: ${Array.isArray(context.servicesOffered) ? context.servicesOffered.join(", ") : context.servicesOffered || "N/A"}\n`;
      }
    } catch (error) {
      // Business context is optional, continue without it
      console.warn("[GenerateDraft] Could not load business context:", error);
    }

    // Get detailed business info context if enabled
    if (isBusinessInfoAwareDraftsEnabled()) {
      try {
        const businessInfo = await getBusinessContextForUser(userId);
        if (businessInfo) {
          let contextParts: string[] = [];
          
          if (businessInfo.profile) {
            contextParts.push(`Business: ${businessInfo.profile.business_name}`);
            if (businessInfo.profile.description) {
              contextParts.push(`Description: ${businessInfo.profile.description}`);
            }
          }
          
          if (businessInfo.services.length > 0) {
            contextParts.push(`\nServices:`);
            businessInfo.services.forEach((s) => {
              contextParts.push(`- ${s.name}${s.description ? `: ${s.description}` : ""}`);
            });
          }
          
          if (businessInfo.pricingTiers.length > 0) {
            contextParts.push(`\nPricing:`);
            businessInfo.pricingTiers.forEach((t) => {
              contextParts.push(`- ${t.name}: ${t.price_currency} ${t.price_amount} / ${t.billing_interval}`);
            });
          }
          
          if (businessInfo.faqs.length > 0) {
            contextParts.push(`\nFAQs:`);
            businessInfo.faqs.forEach((f) => {
              contextParts.push(`Q: ${f.question}\nA: ${f.answer}`);
            });
          }
          
          businessInfoContext = `\n--- BUSINESS INFORMATION ---\n${contextParts.join("\n")}\n--- END BUSINESS INFORMATION ---\n`;
        }
      } catch (error) {
        console.warn("[GenerateDraft] Could not load business info context:", error);
      }
    }

    // Get available time slots if smart scheduling is enabled
    if (isSmartSchedulingSuggestionsEnabled() && threadId) {
      try {
        const slots = await getAvailableTimeSlots(userId, threadId);
        availableTimeSlots = slots.map(formatTimeSlotForAI);
      } catch (error) {
        console.warn("[GenerateDraft] Could not load available time slots:", error);
      }
    }

    // Use plain text body, fallback to HTML if needed
    let emailBody = bodyText || "";
    if (!emailBody && bodyHtml) {
      // Simple HTML stripping - remove tags but keep text
      emailBody = bodyHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }

    // Limit email body to 3000 characters to avoid token limits
    const truncatedBody = emailBody.substring(0, 3000);
    if (emailBody.length > 3000) {
      emailBody = truncatedBody + "... [truncated]";
    }

    // Build the user prompt
    const senderInfo = fromName ? `${fromName} <${fromAddress}>` : fromAddress;
    
    // Get user preferences for tone
    const userPreferences = await getUserSyncPreferences(userId);
    
    // Get lead info if available (for CTA strength and tone adjustments)
    let leadInfo: { stage?: string; score?: number; urgencyLevel?: "low" | "medium" | "high" | "unknown" } | null = null;
    try {
      const supabase = getSupabaseServerClient();
      // Try to get lead for this contact
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("user_id", userId)
        .eq("email", fromAddress.toLowerCase())
        .maybeSingle();
      
      if (contact) {
        const { data: lead } = await supabase
          .from("leads")
          .select("lead_stage, lead_score")
          .eq("user_id", userId)
          .eq("contact_id", contact.id)
          .order("last_activity_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (lead) {
          leadInfo = {
            stage: lead.lead_stage,
            score: lead.lead_score,
            // Urgency would come from CRM extraction, but we'll use score as proxy
            urgencyLevel: lead.lead_score >= 80 ? "high" : lead.lead_score >= 60 ? "medium" : "low",
          };
        }
      }
    } catch (error) {
      // Lead info is optional, continue without it
      console.warn("[GenerateDraft] Could not load lead info:", error);
    }

    // Get business context for voice profile
    const businessInfoForVoice = isBusinessInfoAwareDraftsEnabled() 
      ? await getBusinessContextForUser(userId).catch(() => null)
      : null;

    // Build AI voice profile
    const voiceProfile = buildAIVoiceProfile({
      tonePreset: userPreferences?.tone_preset as any,
      toneCustomInstructions: userPreferences?.tone_custom_instructions,
      followUpIntensity: userPreferences?.follow_up_intensity as any,
      lead: leadInfo,
      businessContext: businessInfoForVoice,
    });

    // Choose system prompt based on whether thread context or business info is available
    const hasBusinessInfo = isBusinessInfoAwareDraftsEnabled() && businessInfoContext.length > 0;
    let systemPrompt = (threadContext || hasBusinessInfo) ? SYSTEM_PROMPT_WITH_THREAD : SYSTEM_PROMPT_BASE;
    
    // Append voice profile instructions
    systemPrompt += `\n\n${voiceProfile}\n`;

    // Build user prompt with thread context if available
    let userPrompt = `Generate a draft reply for this email:

From: ${senderInfo}
Subject: ${subject}
Body: ${emailBody}`;

    // Add thread context if available
    if (threadContext) {
      userPrompt += `\n\n--- THREAD CONTEXT ---\n`;

      // Add thread summary if available
      if (threadContext.threadSummary) {
        userPrompt += `\nPrevious conversation summary:\n${threadContext.threadSummary}\n`;
      }

      // Add recent messages
      if (threadContext.recentMessages.length > 0) {
        userPrompt += `\nRecent messages in this thread:\n`;
        threadContext.recentMessages.forEach((msg, idx) => {
          const senderLabel = msg.isFromUser ? "You" : (msg.senderName || msg.sender);
          userPrompt += `\n[${idx + 1}] ${senderLabel} (${msg.sentAt}):\n`;
          userPrompt += `Subject: ${msg.subject}\n`;
          userPrompt += `${msg.bodyText}\n`;
        });
      }

      // Add intent metadata if available
      if (threadContext.intentMetadata) {
        const { appointments, tasks, reminders } = threadContext.intentMetadata;
        
        if (appointments && appointments.length > 0) {
          userPrompt += `\nAppointments mentioned in this thread:\n`;
          appointments.forEach((apt) => {
            userPrompt += `- ${apt.title} on ${apt.appointment_date} at ${apt.appointment_time}`;
            if (apt.location) userPrompt += ` (${apt.location})`;
            userPrompt += `\n`;
          });
        }

        if (tasks && tasks.length > 0) {
          userPrompt += `\nTasks/action items from this thread:\n`;
          tasks.forEach((task) => {
            userPrompt += `- ${task.description}`;
            if (task.due_date) userPrompt += ` (due: ${task.due_date})`;
            userPrompt += `\n`;
          });
        }

        if (reminders && reminders.length > 0) {
          userPrompt += `\nReminders from this thread:\n`;
          reminders.forEach((reminder) => {
            userPrompt += `- ${reminder.message} (remind at: ${reminder.remind_at})\n`;
          });
        }
      }

      userPrompt += `\n--- END THREAD CONTEXT ---\n`;
    }

    // Add business info context
    if (businessInfoContext) {
      userPrompt += businessInfoContext;
    }

    // Add available time slots if provided
    if (availableTimeSlots.length > 0) {
      userPrompt += `\n--- AVAILABLE TIME SLOTS FOR SCHEDULING ---\n`;
      userPrompt += `When suggesting meeting times, use ONLY these available slots:\n`;
      availableTimeSlots.forEach((slot, idx) => {
        userPrompt += `${idx + 1}. ${slot}\n`;
      });
      userPrompt += `--- END AVAILABLE TIME SLOTS ---\n`;
    }

    userPrompt += `${businessContext}\n\nGenerate a professional, helpful draft reply.`;

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for cost efficiency
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
      temperature: 0.7, // Slightly higher for more natural responses
      max_tokens: 500, // Limit draft length
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[GenerateDraft] Empty response from OpenAI");
      return {
        draft: "I received your email and will respond shortly.",
        rawResponse: response,
      };
    }

    // Clean up the draft (remove any markdown formatting if present)
    let draft = content.trim();
    // Remove markdown code blocks if present
    draft = draft.replace(/^```[\w]*\n?/g, "").replace(/\n?```$/g, "");
    draft = draft.trim();

    // Ensure draft is not empty
    if (!draft) {
      draft = "I received your email and will respond shortly.";
    }

    // Append signature with name and company
    const signature = await buildEmailSignature(userId);
    if (signature) {
      draft = `${draft}\n\n${signature}`;
    }

    return {
      draft,
      rawResponse: response,
    };
  } catch (error: any) {
    console.error("[GenerateDraft] Error generating draft:", error);
    // Return a safe default draft
    return {
      draft: "Thank you for your email. I'll review it and get back to you soon.",
      rawResponse: { error: error.message || "unknown_error" },
    };
  }
}

/**
 * Build email signature with user name and company
 * Uses business profile full_name first, then falls back to user profile full_name
 */
async function buildEmailSignature(userId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseServerClient();
    
    // Get business context first (preferred source for name and company)
    const businessContext = await getBusinessContext(userId);
    
    // Use business profile full_name if available, otherwise fall back to user profile
    let name = businessContext?.profile?.fullName || null;
    
    if (!name) {
      // Fallback to user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single();
      name = profile?.full_name || null;
    }
    
    const company = businessContext?.profile?.businessName || null;

    // Build signature parts
    const signatureParts: string[] = [];
    
    if (name) {
      signatureParts.push(name);
    }
    
    if (company) {
      signatureParts.push(company);
    }

    // Only return signature if we have at least name or company
    if (signatureParts.length > 0) {
      return signatureParts.join("\n");
    }

    return null;
  } catch (error) {
    // Signature is optional, don't fail if we can't get it
    console.warn("[GenerateDraft] Could not build signature:", error);
    return null;
  }
}

