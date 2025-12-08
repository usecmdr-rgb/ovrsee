/**
 * AI Opportunity Detection
 * Detects buying signals, risks, competitor mentions, upsells, and renewals from email content
 */

import { openai } from "@/lib/openai";
import { getThreadContext } from "./getThreadContext";
import type { Lead } from "./crm";

export interface OpportunitySignal {
  type: "buying_signal" | "risk" | "competitor" | "upsell" | "renewal";
  strength: "low" | "medium" | "high";
  summary: string;
}

export interface OpportunityDetectionInput {
  userId: string;
  emailId: string;
  threadId?: string;
  emailContent: string;
  emailSubject: string;
  lead: Lead;
  contactName?: string;
}

/**
 * Detect opportunity signals from email content
 * Uses OpenAI with structured output to identify buying signals, risks, competitors, etc.
 */
export async function detectOpportunitySignals(
  input: OpportunityDetectionInput
): Promise<OpportunitySignal[]> {
  const { userId, emailId, threadId, emailContent, emailSubject, lead, contactName } = input;

  // Get thread context if available
  let threadContext = "";
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
        });
      }
    }
  }

  const systemPrompt = `You are an expert sales intelligence analyst. Your task is to analyze email conversations and identify opportunity signals.

OPPORTUNITY TYPES:
- buying_signal: Clear indicators the prospect is ready to purchase (e.g., "ready to move forward", "let's get started", "when can we begin", asking about pricing/contracts)
- risk: Warning signs the deal might be at risk (e.g., "delaying decision", "budget concerns", "looking at alternatives", negative sentiment)
- competitor: Mentions of competitors or alternative solutions (e.g., "also considering X", "comparing with Y", "talking to another vendor")
- upsell: Opportunities to sell additional services/products to existing customers
- renewal: Signals about contract renewals or subscription renewals

STRENGTH LEVELS:
- high: Strong, clear signal with explicit language
- medium: Moderate signal with implied intent
- low: Weak signal, subtle hint

RULES:
1. Only identify opportunities based on ACTUAL TEXT in the email/thread - NO HALLUCINATION
2. Summaries must be max 2 sentences, referencing specific text patterns
3. If no clear opportunity exists, return empty array
4. Be conservative - only flag when there's clear evidence
5. Focus on actionable signals, not generic statements

Return a JSON array of opportunities, or empty array if none found.`;

  const userPrompt = `Analyze this email conversation for opportunity signals:

Lead Information:
- Stage: ${lead.lead_stage}
- Score: ${lead.lead_score}/100
- Contact: ${contactName || "Unknown"}

Email Subject: ${emailSubject}

Email Content:
${emailContent.substring(0, 2000)}${emailContent.length > 2000 ? "..." : ""}

${threadContext ? `\n${threadContext}` : ""}

Identify any buying signals, risks, competitor mentions, upsells, or renewal opportunities. Return as JSON array with type, strength, and summary fields.`;

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
      temperature: 0.3, // Lower temperature for more consistent, factual output
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return [];
    }

    const parsed = JSON.parse(content);
    const opportunities = parsed.opportunities || [];

    // Validate and filter opportunities
    const validOpportunities: OpportunitySignal[] = opportunities
      .filter((opp: any) => {
        return (
          opp.type &&
          ["buying_signal", "risk", "competitor", "upsell", "renewal"].includes(opp.type) &&
          opp.strength &&
          ["low", "medium", "high"].includes(opp.strength) &&
          opp.summary &&
          typeof opp.summary === "string" &&
          opp.summary.length > 0 &&
          opp.summary.length <= 500 // Max 2 sentences
        );
      })
      .map((opp: any) => ({
        type: opp.type as OpportunitySignal["type"],
        strength: opp.strength as OpportunitySignal["strength"],
        summary: opp.summary.trim(),
      }));

    return validOpportunities;
  } catch (error: any) {
    console.error("[DetectOpportunitySignals] Error detecting opportunities:", error);
    // Return empty array on error - don't fail the pipeline
    return [];
  }
}


