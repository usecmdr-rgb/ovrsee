/**
 * AI-Based CRM Field Extraction
 * Extracts structured CRM data from emails using OpenAI
 */

import { openai } from "@/lib/openai";
import { isSyncIntelligenceEnabled } from "./featureFlags";
import type { CRMExtractionResult } from "./crm";

const SYSTEM_PROMPT = `You are a CRM data extraction assistant. Your task is to analyze email content and extract structured information about:
1. Service/product interest
2. Budget level and text
3. Urgency level
4. Intent type
5. Whether they want an appointment
6. Whether this appears to be a new lead

You MUST return ONLY valid JSON with this exact structure:
{
  "inferredServiceId": null | string (UUID if service can be matched),
  "inferredServiceName": string | null,
  "budgetText": string | null,
  "budgetLevel": "low" | "medium" | "high" | "unknown",
  "urgencyLevel": "low" | "medium" | "high" | "unknown",
  "intentType": "pricing" | "appointment" | "general_question" | "support" | "other",
  "wantsAppointment": boolean,
  "isNewLead": boolean
}

Guidelines:
- inferredServiceName: Extract the service/product name mentioned, or null
- budgetText: Extract any budget mentions (e.g., "$5k", "around $2000", "budget is tight")
- budgetLevel: Infer from budgetText or context ("high" = $10k+, "medium" = $1k-10k, "low" = <$1k, "unknown" if unclear)
- urgencyLevel: "high" = urgent/time-sensitive language, "medium" = some urgency, "low" = casual inquiry, "unknown" if unclear
- intentType: Classify the primary intent
- wantsAppointment: true if they explicitly request a meeting/call/demo
- isNewLead: true if this appears to be a first-time inquiry from a potential customer

Be conservative - only mark fields as non-null if there's clear evidence in the email.`;

/**
 * Extract CRM fields from email content
 */
export async function extractCrmFields(params: {
  emailBody: string;
  emailSubject: string;
  fromAddress: string;
  threadContext?: string; // Optional thread summary or recent messages
  availableServices?: Array<{ id: string; name: string }>; // For service matching
}): Promise<CRMExtractionResult> {
  if (!isSyncIntelligenceEnabled()) {
    return {
      inferredServiceId: null,
      inferredServiceName: null,
      budgetText: null,
      budgetLevel: "unknown",
      urgencyLevel: "unknown",
      intentType: "other",
      wantsAppointment: false,
      isNewLead: false,
    };
  }

  try {
    // Build context for AI
    let context = `Email Subject: ${params.emailSubject}\n\nEmail Body:\n${params.emailBody.substring(0, 2000)}`;

    if (params.threadContext) {
      context += `\n\nThread Context:\n${params.threadContext.substring(0, 1000)}`;
    }

    if (params.availableServices && params.availableServices.length > 0) {
      const servicesList = params.availableServices.map((s) => `- ${s.name} (ID: ${s.id})`).join("\n");
      context += `\n\nAvailable Services:\n${servicesList}`;
    }

    const userPrompt = `Extract CRM fields from this email:\n\n${context}`;

    // Call OpenAI with JSON mode
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2, // Low temperature for consistency
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[ExtractCrmFields] Empty response from OpenAI");
      return getDefaultResult();
    }

    // Parse JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("[ExtractCrmFields] Failed to parse JSON response:", content);
      return getDefaultResult();
    }

    // Validate and return
    return {
      inferredServiceId: parsed.inferredServiceId || null,
      inferredServiceName: parsed.inferredServiceName || null,
      budgetText: parsed.budgetText || null,
      budgetLevel: ["low", "medium", "high", "unknown"].includes(parsed.budgetLevel)
        ? parsed.budgetLevel
        : "unknown",
      urgencyLevel: ["low", "medium", "high", "unknown"].includes(parsed.urgencyLevel)
        ? parsed.urgencyLevel
        : "unknown",
      intentType: ["pricing", "appointment", "general_question", "support", "other"].includes(
        parsed.intentType
      )
        ? parsed.intentType
        : "other",
      wantsAppointment: Boolean(parsed.wantsAppointment),
      isNewLead: Boolean(parsed.isNewLead),
    };
  } catch (error: any) {
    console.error("[ExtractCrmFields] Error extracting CRM fields:", error);
    return getDefaultResult();
  }
}

function getDefaultResult(): CRMExtractionResult {
  return {
    inferredServiceId: null,
    inferredServiceName: null,
    budgetText: null,
    budgetLevel: "unknown",
    urgencyLevel: "unknown",
    intentType: "other",
    wantsAppointment: false,
    isNewLead: false,
  };
}


