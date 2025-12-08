/**
 * AI Copilot for Email Context
 * Provides intelligent insights and suggestions for email conversations
 */

import { openai } from "@/lib/openai";
import { getThreadContext } from "./getThreadContext";
import { getBusinessContextForUser } from "./businessInfo";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { Lead } from "./crm";

export type CopilotMode = "summary" | "next_step" | "proposal_hint" | "risk_analysis";

export interface CopilotInsights {
  summary: string;
  key_points: string[];
  risks: string[];
  opportunities: string[];
  recommended_next_step: string;
  suggested_reply_outline: string[];
}

export interface CopilotContext {
  userId: string;
  emailId: string;
  threadId?: string;
  emailContent: string;
  emailSubject: string;
  lead?: Lead;
  contactName?: string;
}

/**
 * Gather context for copilot analysis
 */
export async function getCopilotContext(params: {
  userId: string;
  emailId: string;
  threadId?: string;
}): Promise<{
  threadMessages: Array<{ sender: string; body: string; isFromUser: boolean }>;
  leadInfo?: {
    stage: string;
    score: number;
    potential_value?: number | null;
    currency?: string | null;
    closed_value?: number | null;
    primary_opportunity_type?: string | null;
    primary_opportunity_strength?: string | null;
  };
  tasks?: Array<{ id: string; description: string; status: string }>;
  reminders?: Array<{ id: string; message: string; due_at: string }>;
  appointments?: Array<{ id: string; title: string; start_at: string }>;
  businessInfo?: {
    services: Array<{ name: string; description?: string }>;
    pricing?: Array<{ name: string; price: number; currency: string }>;
    hours?: string;
  };
}> {
  const { userId, emailId, threadId } = params;
  const supabase = getSupabaseServerClient();

  // Get thread context
  let threadMessages: Array<{ sender: string; body: string; isFromUser: boolean }> = [];
  if (threadId) {
    const thread = await getThreadContext(userId, threadId, emailId);
    if (thread?.recentMessages) {
      threadMessages = thread.recentMessages.map((msg) => ({
        sender: msg.senderName || msg.sender,
        body: msg.bodyText,
        isFromUser: msg.isFromUser,
      }));
    }
  }

  // Get lead info
  const { data: lead } = await supabase
    .from("leads")
    .select("lead_stage, lead_score, potential_value, currency, closed_value, primary_opportunity_type, primary_opportunity_strength")
    .eq("user_id", userId)
    .eq("last_email_id", emailId)
    .maybeSingle();

  // Get tasks, reminders, appointments
  const { data: tasks } = await supabase
    .from("email_tasks")
    .select("id, description, status")
    .eq("user_id", userId)
    .eq("email_id", emailId);

  const { data: reminders } = await supabase
    .from("email_reminders")
    .select("id, message, due_at")
    .eq("user_id", userId)
    .eq("email_id", emailId);

  const { data: appointments } = await supabase
    .from("email_appointments")
    .select("id, title, start_at")
    .eq("user_id", userId)
    .eq("email_id", emailId);

  // Get business info
  const businessContext = await getBusinessContextForUser(userId);
  const businessInfo = businessContext
    ? {
        services: (businessContext.services || []).map((s) => ({
          name: s.name,
          description: s.description || undefined,
        })),
        pricing: (businessContext.pricingTiers || []).map((t) => ({
          name: t.name,
          price: Number(t.price_amount) || 0,
          currency: t.currency || "USD",
        })),
        hours: businessContext.hours?.map((h) => `${h.day}: ${h.is_closed ? "Closed" : `${h.open_time}-${h.close_time}`}`).join(", "),
      }
    : undefined;

  return {
    threadMessages,
    leadInfo: lead
      ? {
          stage: lead.lead_stage,
          score: lead.lead_score,
          potential_value: lead.potential_value,
          currency: lead.currency,
          closed_value: lead.closed_value,
          primary_opportunity_type: lead.primary_opportunity_type,
          primary_opportunity_strength: lead.primary_opportunity_strength,
        }
      : undefined,
    tasks: tasks || [],
    reminders: reminders || [],
    appointments: appointments || [],
    businessInfo,
  };
}

/**
 * Generate copilot insights based on mode
 */
export async function generateCopilotInsights(
  context: CopilotContext,
  mode: CopilotMode
): Promise<CopilotInsights> {
  const { userId, emailId, threadId, emailContent, emailSubject, lead, contactName } = context;

  // Gather full context
  const fullContext = await getCopilotContext({ userId, emailId, threadId });

  const systemPrompts: Record<CopilotMode, string> = {
    summary: `You are an expert email analyst. Summarize the conversation, extract key points, and identify any action items or decisions made.`,
    next_step: `You are a sales and communication strategist. Analyze the conversation and recommend the best next step to move the relationship forward.`,
    proposal_hint: `You are a proposal and pitch expert. Analyze the conversation to suggest angles, value propositions, or talking points for a proposal or pitch.`,
    risk_analysis: `You are a risk assessment specialist. Identify potential risks, concerns, or red flags in the conversation, and suggest mitigation strategies.`,
  };

  const userPrompts: Record<CopilotMode, string> = {
    summary: `Summarize this email conversation:

Subject: ${emailSubject}
Content: ${emailContent.substring(0, 2000)}${emailContent.length > 2000 ? "..." : ""}

${fullContext.threadMessages.length > 0 ? `\nThread History:\n${fullContext.threadMessages.slice(0, 10).map((msg, idx) => `${idx + 1}. ${msg.isFromUser ? "You" : msg.sender}: ${msg.body.substring(0, 300)}...`).join("\n")}` : ""}

${fullContext.leadInfo ? `\nLead Info:\n- Stage: ${fullContext.leadInfo.stage}\n- Score: ${fullContext.leadInfo.score}/100\n- Potential Value: ${fullContext.leadInfo.potential_value ? `$${fullContext.leadInfo.potential_value}` : "Not set"}` : ""}

${fullContext.tasks.length > 0 ? `\nTasks:\n${fullContext.tasks.map((t) => `- ${t.description} (${t.status})`).join("\n")}` : ""}

Provide a concise summary, key points, and any action items.`,

    next_step: `Analyze this conversation and recommend the best next step:

Subject: ${emailSubject}
Content: ${emailContent.substring(0, 2000)}${emailContent.length > 2000 ? "..." : ""}

${fullContext.leadInfo ? `\nLead Context:\n- Stage: ${fullContext.leadInfo.stage}\n- Score: ${fullContext.leadInfo.score}/100` : ""}
${fullContext.appointments.length > 0 ? `\nUpcoming Appointments:\n${fullContext.appointments.map((a) => `- ${a.title} on ${new Date(a.start_at).toLocaleDateString()}`).join("\n")}` : ""}

What should be the next step to move this forward?`,

    proposal_hint: `Suggest proposal angles for this conversation:

Subject: ${emailSubject}
Content: ${emailContent.substring(0, 2000)}${emailContent.length > 2000 ? "..." : ""}

${fullContext.leadInfo ? `\nLead Context:\n- Stage: ${fullContext.leadInfo.stage}\n- Budget/Timeline: ${fullContext.leadInfo.potential_value ? `$${fullContext.leadInfo.potential_value}` : "Not specified"}` : ""}
${fullContext.businessInfo ? `\nAvailable Services:\n${fullContext.businessInfo.services.map((s) => `- ${s.name}${s.description ? `: ${s.description}` : ""}`).join("\n")}` : ""}

What angles, value propositions, or talking points should be included in a proposal?`,

    risk_analysis: `Analyze risks in this conversation:

Subject: ${emailSubject}
Content: ${emailContent.substring(0, 2000)}${emailContent.length > 2000 ? "..." : ""}

${fullContext.leadInfo ? `\nLead Context:\n- Stage: ${fullContext.leadInfo.stage}\n- Opportunity: ${fullContext.leadInfo.primary_opportunity_type || "None"} (${fullContext.leadInfo.primary_opportunity_strength || "N/A"})` : ""}

Identify potential risks, concerns, or red flags, and suggest mitigation strategies.`,
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompts[mode],
        },
        {
          role: "user",
          content: userPrompts[mode],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);

    // Validate and structure response
    return {
      summary: parsed.summary || "",
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
      recommended_next_step: parsed.recommended_next_step || "",
      suggested_reply_outline: Array.isArray(parsed.suggested_reply_outline) ? parsed.suggested_reply_outline : [],
    };
  } catch (error: any) {
    console.error("[Copilot] Error generating insights:", error);
    throw new Error(`Failed to generate copilot insights: ${error.message}`);
  }
}


