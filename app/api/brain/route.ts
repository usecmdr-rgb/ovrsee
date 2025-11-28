import { NextResponse } from "next/server";

import { openai } from "@/lib/openai";
import { getModelForTask } from "@/lib/agents/router";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { hasAgentAccess, isAdmin, getUserEmail } from "@/lib/auth";
import { hasActiveAccess } from "@/lib/subscription/trial";
import { getBusinessContext } from "@/lib/business-context";
import { logKnowledgeGap } from "@/lib/knowledge-gap-logger";
import { getAlohaDisplayName } from "@/lib/aloha/profile";
import { getLanguageFromLocale } from "@/lib/localization";
import type { AgentKey, TaskType } from "@/lib/agents/config";
import type { ScenarioContext } from "@/lib/aloha/scenario-detection";
import type {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";

type AgentId = AgentKey;

const MAX_CONTEXT_MESSAGES = 20;
const RECENT_CONVERSATION_WINDOW_HOURS = 12;
const FOLLOWUP_CONTEXT_SOURCES = ["aloha", "sync"];

const SYSTEM_PROMPTS: Record<AgentId, string> = {
  aloha: `
You are OVRSEE Aloha, the friendly, reliable, and natural conversational assistant. Your tone is warm, professional, and helpful. You help users triage calls, summarize key points, and decide next actions. If you are provided with existing follow-ups, consider them as commitments that influence your recommendations.

IMPORTANT: You will be provided with business context information including business name, services, hours, location, and knowledge from their website. Use this information to:
- Answer questions about services, pricing, operating hours, location, and policies
- Introduce yourself appropriately (e.g., "Thank you for calling [BusinessName]...")
- Reference specific information from the business knowledge base when relevant
- Provide accurate information based on what the business has shared

CRITICAL - UNKNOWN INFORMATION HANDLING:
- If you are asked about information that is NOT in the business context (e.g., pricing, specific services, policies, hours, location details), you MUST:
  1. Politely tell the caller: "I'm sorry, I don't have that information available right now. I'll make sure someone follows up with you about this."
  2. NEVER invent or guess information
  3. The system will automatically log this as a knowledge gap for the user to resolve
- Only use information that is explicitly provided in the business context
- If unsure, always err on the side of logging a knowledge gap rather than guessing

REAL-WORLD CALLER BEHAVIOR HANDLING:

AUDIO & TECHNICAL ISSUES:
- If audio quality is poor or you cannot hear the caller clearly: Politely ask them to repeat, speak louder, or offer to call back
- If there's echo, static, or background noise: Acknowledge it and suggest moving to a quieter location or callback
- If you detect voicemail: Leave a brief, professional message with business name, purpose, and callback number
- If call has significant lag: Slow down your speech and be patient
- Always remain calm and professional, even with technical difficulties

CALLER BEHAVIOR VARIATIONS:
- If caller interrupts you: Stop speaking immediately (barge-in handling), acknowledge them, and let them speak
- If caller speaks too fast: Politely ask them to repeat more slowly: "Could you repeat that a bit slower?"
- If caller speaks slowly: Be patient and don't rush them
- If caller switches topics: Acknowledge and gently redirect: "I understand. Let me help you with [original topic]."
- If caller tests if you're AI: Be honest: "I'm OVRSEE Aloha, an AI assistant from [BusinessName]. I'm here to help you today."
- If caller thinks you're human: Clarify politely: "I'm OVRSEE Aloha, an AI assistant from [BusinessName]."
- If caller has a strong accent: Be patient, ask for clarification if needed, never make assumptions

EMOTIONAL & SOCIAL SCENARIOS:
- If caller is angry or hostile: Use calm, empathetic tone. Say: "I understand you're frustrated, and I'm sorry for any inconvenience. Let me see how I can help."
- If caller is upset or crying: Be compassionate: "I can hear this is difficult for you. I'm here to help. Would you like to take a moment, or would you prefer I call you back later?"
- If caller is frustrated: Acknowledge: "I understand this is frustrating. Let me help you get this sorted out."
- NEVER escalate or become defensive, even if caller is rude
- If caller mentions an EMERGENCY: Immediately redirect: "For emergencies, please call 911 immediately. I'm an AI assistant and cannot help with emergencies. Please hang up and call 911 if you need emergency assistance." Then end the call.

CALLER IDENTITY ISSUES:
- If caller is not the intended customer: Be cautious about sharing sensitive information. Keep responses general.
- If caller refuses to identify themselves: Politely ask: "I'd like to make sure I'm speaking with the right person. Could you confirm your name?"
- If caller appears to be a child: Say: "Hi there! Is there a grown-up nearby I could speak with?" Then end call if no adult available.

BUSINESS LOGIC SCENARIOS:
- If caller requests unavailable service: "I understand you're interested in [service]. That's not something we currently offer, but I'd be happy to tell you about our available services."
- If caller wants to opt out / do-not-call: "I understand you'd like to stop receiving calls from us. I'll make sure you're removed from our calling list. Is that correct?" Then confirm and process opt-out.
- If caller mentions legal concerns: "I understand you have legal concerns. I'm an AI assistant and cannot provide legal advice. I'll make sure someone from our team follows up with you about this."
- If caller asks for information you don't have: "I don't have that information available right now, but I'll make sure someone follows up with you about this."

SAFETY & COMPLIANCE:
- NEVER pretend to be human - always identify as OVRSEE Aloha, an AI assistant
- NEVER give medical, legal, or financial advice - always defer to professionals
- NEVER make promises outside BusinessContext
- NEVER share personal data or sensitive information
- ALWAYS allow caller to end call immediately: "Of course. You can end this call at any time."
- ALWAYS remain polite, calm, and neutral, regardless of caller behavior

GENERAL GUIDELINES:
- Keep responses short, clear, and professional
- Use the caller's name if you know it
- Be patient and understanding
- If you cannot help, offer callback or follow-up
- Always end calls politely: "Thank you for calling. Have a great day!"

Each reply MUST end with:
CALL_OUTCOME:
- outcome: <short text such as "resolved", "needs_followup", "scheduled", "audio_issue", "opt_out", "emergency_redirected", etc.>
- followup_title: <short title or "none">
- followup_description: <sentence or "none">
- followup_due_at: <ISO date-time or "none">
`.trim(),

  insight: `
You are OVRSEE Insight, the analytical, concise, and sharp business intelligence agent. Your tone is analytical, precise, and data-driven. You analyze business data, generate insights, and provide actionable recommendations.

IMPORTANT: You will be provided with business context information including business name, industry, services, and knowledge from their website. Use this information to:
- Provide contextually relevant insights based on the business type and industry
- Reference business-specific information when generating recommendations
- Tailor your analysis to the business's services and operations

When generating insights, consider the business context to make your recommendations more relevant and actionable.
`.trim(),

  sync: `
You are OVRSEE Sync, the efficient and extremely precise email + calendar agent. Your tone is efficient, direct, and accurate. Summarize emails crisply, highlight priorities, and recommend next calendar/email actions. Use any provided follow-up list to avoid duplicating tasks.

IMPORTANT: You will be provided with business context information including business name, services, hours, location, and knowledge from their website. Use this information to:
- Draft emails that match the business's tone and style
- Schedule calendar events considering business hours and timezone
- Reference business-specific information when relevant (e.g., services, policies)
- Use business knowledge to provide better context in email summaries

Each reply MUST end with:
EMAIL_OUTCOME:
- importance: <"low" | "normal" | "high">
- followup_title: <short title or "none">
- followup_description: <sentence or "none">
- followup_due_at: <ISO date-time or "none">
`.trim(),

  studio: `
You are OVRSEE Studio, the visual design and content assistant. Your tone is creative, minimal, and elegant.

Your job is to help the user edit their media. You can modify text overlays, fonts, colors, sizes, effects, alignment, positions, brightness, contrast, saturation, and more.

IMPORTANT: You will be provided with business watermark settings. If watermark is enabled, you should automatically apply or suggest watermarking images with the specified text/logo at the specified position. This is a default behavior unless the user explicitly requests otherwise.

CRITICAL: When the user asks for a change, you MUST use a tool call. DO NOT reply with plain text unless they explicitly ask for advice or explanation.

The user's message will include [Current Editor State] showing the current values. ALWAYS use these current values to calculate the new values.

RULES FOR ADJUSTMENTS:
- If current brightness is shown, use it. If not shown, assume 100 (neutral).
- "brighten", "make brighter", "increase brightness" → add 20-50 to current brightness (max 200)
- "darken", "make darker", "decrease brightness" → subtract 20-50 from current brightness (min 0)
- "more contrast", "increase contrast" → add 20-50 to current contrast (max 200)
- "less contrast", "decrease contrast" → subtract 20-50 from current contrast (min 0)
- "more saturation", "increase saturation" → add 20-50 to current saturation (max 200)
- "less saturation", "decrease saturation" → subtract 20-50 from current saturation (min 0)

RULES FOR TEXT ITEMS:
- If the user refers to "the text" or "title" and there's only one text item, update that one.
- If multiple text items exist, update the first one or ask which one.
- "bigger", "increase size" → add 8-16 to current fontSize
- "smaller", "decrease size" → subtract 8-16 from current fontSize
- "higher", "move up" → decrease position.y by 5-10
- "lower", "move down" → increase position.y by 5-10
- "left" → decrease position.x by 5-10
- "right" → increase position.x by 5-10

EXAMPLES:
- User: "brighten image" (current: brightness: 100) → update_adjustments with brightness: 130
- User: "make it darker" (current: brightness: 120) → update_adjustments with brightness: 90
- User: "more contrast" (current: contrast: 100) → update_adjustments with contrast: 130
- User: "Make the text bigger" (current: fontSize: 32) → update_text_item with fontSize: 44
- User: "Change to gold" → update_text_item with color: "#FFD700"
- User: "Add text: Sale" → add_text_item with content: "Sale"
- User: "Move text higher" (current: position.y: 50) → update_text_item with position: {x: 50, y: 40}

ALWAYS use tool calls. Only provide text when asked for explanations.
`.trim(),
};

type StructuredFields = Record<string, string>;

function extractStructuredSection(reply: string, marker: string) {
  const needle = `${marker}:`;
  const upper = reply.toUpperCase();
  const idx = upper.lastIndexOf(needle.toUpperCase());
  if (idx === -1) {
    return { cleaned: reply.trim(), fields: {} as StructuredFields };
  }
  const cleaned = reply.slice(0, idx).trim();
  const block = reply.slice(idx + needle.length).trim();
  const fields: StructuredFields = {};
  block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^-?\s*([^:]+):\s*(.*)$/i);
      if (match) {
        const key = match[1].trim().toLowerCase();
        fields[key] = match[2].trim();
      }
    });
  return { cleaned, fields };
}

function normalizeValue(value?: string) {
  if (!value) return "";
  if (value.toLowerCase() === "none" || value.toLowerCase() === "null") return "";
  return value;
}

async function loadOpenFollowups(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string,
  sources: string[]
) {
  const { data, error } = await supabase
    .from("followups")
    .select("id, title, description, due_at, source_agent")
    .eq("user_id", userId)
    .eq("status", "open")
    .in("source_agent", sources)
    .order("due_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("Followup fetch failed:", error);
    return null;
  }

  if (!data?.length) return null;

  const bullets = data
    .map((f) => {
      const due =
        f.due_at != null ? ` (due ${new Date(f.due_at).toLocaleString()})` : "";
      return `- [${f.source_agent}] ${f.title}${due}`;
    })
    .join("\n");

  return `Here are this user's open follow-ups from Aloha/Sync:\n${bullets}`;
}

async function buildBetaStatsContext(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userId: string
) {
  const [
    totalCallsResult,
    needsFollowupCallsResult,
    openFollowupsResult,
    emailRowsResult,
  ] = await Promise.all([
    supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("outcome", "needs_followup"),
    supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "open"),
    supabase
      .from("email_summaries")
      .select("importance")
      .eq("user_id", userId),
  ]);

  if (
    totalCallsResult.error ||
    needsFollowupCallsResult.error ||
    openFollowupsResult.error ||
    emailRowsResult.error
  ) {
    console.error("Insight stats lookup failed", {
      totalCallsError: totalCallsResult.error,
      needsFollowupError: needsFollowupCallsResult.error,
      openFollowupsError: openFollowupsResult.error,
      emailError: emailRowsResult.error,
    });
    return null;
  }

  const importanceCounts = { high: 0, normal: 0, low: 0 };
  emailRowsResult.data?.forEach((row) => {
    const key = (row.importance ?? "normal").toLowerCase();
    if (key === "high" || key === "low" || key === "normal") {
      importanceCounts[key as keyof typeof importanceCounts]++;
    } else {
      importanceCounts.normal++;
    }
  });

  return `User analytics snapshot:
- Calls: ${totalCallsResult.count ?? 0} total (${needsFollowupCallsResult.count ?? 0} needing follow-up)
- Open follow-ups: ${openFollowupsResult.count ?? 0}
- Email summaries by importance: high ${importanceCounts.high}, normal ${importanceCounts.normal}, low ${importanceCounts.low}`;
}

function safeDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Detect knowledge gaps in Aloha's response and log them
 * 
 * This function looks for phrases that indicate missing information
 * and logs them as knowledge gaps for the user to resolve.
 */
async function detectAndLogKnowledgeGaps(
  userId: string,
  responseText: string,
  userMessage: string,
  businessContext: any,
  callContext: any
): Promise<void> {
  try {
    // Common phrases that indicate missing information
    const missingInfoPhrases = [
      /don'?t have (?:that|this) information/i,
      /don'?t know (?:about|the|that|this)/i,
      /(?:don'?t|do not) have (?:the|that|this|any) (?:information|details|data)/i,
      /(?:unable|can'?t|cannot) (?:to )?(?:provide|give|tell|find|locate)/i,
      /(?:not|no) (?:available|provided|found|in|available in)/i,
      /(?:sorry|apologize),? (?:i|we) (?:don'?t|do not)/i,
    ];

    // Check if response indicates missing information
    const hasMissingInfo = missingInfoPhrases.some((phrase) =>
      phrase.test(responseText)
    );

    if (!hasMissingInfo) {
      return; // No knowledge gap detected
    }

    // Extract what information was requested from user message
    const requestedInfoMatch = userMessage.match(
      /(?:what|tell me|do you know|can you tell me|what are|what is|how much|when|where|who).*?[?.!]?$/i
    );
    const requestedInfo = requestedInfoMatch
      ? requestedInfoMatch[0].trim()
      : "Information requested during call";

    // Determine category based on keywords
    let category: "pricing" | "services" | "hours" | "policy" | "booking" | "location" | "contact" | "other" = "other";
    const lowerMessage = userMessage.toLowerCase();
    if (lowerMessage.match(/\b(?:price|pricing|cost|fee|charge|rate|how much)\b/)) {
      category = "pricing";
    } else if (lowerMessage.match(/\b(?:service|services|offer|offering|what do you)\b/)) {
      category = "services";
    } else if (lowerMessage.match(/\b(?:hour|hours|open|close|when|time|schedule)\b/)) {
      category = "hours";
    } else if (lowerMessage.match(/\b(?:policy|policies|rule|rules|terms|condition)\b/)) {
      category = "policy";
    } else if (lowerMessage.match(/\b(?:book|booking|appointment|schedule|reserve)\b/)) {
      category = "booking";
    } else if (lowerMessage.match(/\b(?:location|where|address|city|state)\b/)) {
      category = "location";
    } else if (lowerMessage.match(/\b(?:contact|phone|email|reach|call|text)\b/)) {
      category = "contact";
    }

    // Log the knowledge gap
    await logKnowledgeGap({
      userId,
      agent: "aloha",
      source: "call",
      question: userMessage,
      requestedInfo,
      suggestedCategory: category,
      contextId: callContext.callId || callContext.id || undefined,
      contextMetadata: {
        responseText: responseText.substring(0, 500), // Store snippet of response
        callContext: callContext,
      },
    });
  } catch (error) {
    // Don't fail the request if knowledge gap logging fails
    console.error("Error logging knowledge gap:", error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message as string | undefined;
    const agent = (body?.agent as AgentId | undefined) ?? "sync";
    const taskType = (body?.taskType as TaskType | undefined) ?? "default";
    const callContext = body?.callContext ?? {};
    const emailContext = body?.emailContext ?? {};
    const context = body?.context ?? {}; // Studio context with imagePreviewUrl
    const language = getLanguageFromLocale(body?.language as string | undefined);

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing 'message' string in body" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    let effectiveUserId: string | null = null;
    let userEmail: string | null = null;

    // Dev-only bypass: Allow Studio to work without auth in development
    if (!accessToken && process.env.NODE_ENV !== "production") {
      console.warn("[/api/brain] No access token found, using dev fallback user in development.");
      effectiveUserId = "dev-user";
    } else if (accessToken) {
      const { data: userResult, error: userError } =
        await supabase.auth.getUser(accessToken);

      if (userError || !userResult?.user) {
        // In production, return Unauthorized. In dev, use fallback.
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
          );
        } else {
          console.warn("[/api/brain] User auth failed, using dev fallback user in development.");
          effectiveUserId = "dev-user";
        }
      } else {
        effectiveUserId = userResult.user.id;
        userEmail = userResult.user.email || null;
      }
    } else {
      // No access token and in production - return Unauthorized
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // At this point, effectiveUserId is guaranteed to be a string
    // (either from auth or dev fallback "dev-user")
    if (!effectiveUserId) {
      // This should never happen, but TypeScript safety check
      return NextResponse.json(
        { error: "Internal error: No user ID available" },
        { status: 500 }
      );
    }

    // From this point on, use userId (which is guaranteed to be a string)
    const userId = effectiveUserId;

    // Check if user has active access (not expired trial) - skip for dev-user
    if (userId !== "dev-user") {
      const hasActive = await hasActiveAccess(userId);
      
      if (!hasActive) {
        return NextResponse.json(
          { 
            error: "Your free trial has expired. Please upgrade to a paid plan to continue using OVRSEE.",
            code: "TRIAL_EXPIRED"
          },
          { status: 403 }
        );
      }

      // Check if user has access to the requested agent
      const hasAccess = await hasAgentAccess(userId, agent, userEmail);
      
      if (!hasAccess) {
        return NextResponse.json(
          { error: `Access denied. This agent requires a subscription tier that includes ${agent}. Please upgrade your plan to access this feature.` },
          { status: 403 }
        );
      }
    }

    const { data: agentRecord, error: agentLookupError } = await supabase
      .from("agents")
      .select("id, key")
      .eq("key", agent)
      .maybeSingle();

    let agentId: string | null = null;
    if (agentLookupError || !agentRecord?.id) {
      console.error("Agent lookup failed:", { agent, agentLookupError, agentRecord });
      // In development, allow the request to proceed even if agent doesn't exist in DB
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[/api/brain] Agent "${agent}" not found in database, proceeding in development mode.`);
        // Use a dummy agent ID for dev mode
        agentId = "dev-agent-id";
      } else {
        return NextResponse.json(
          { error: `Unknown agent: ${agent}` },
          { status: 400 }
        );
      }
    } else {
      agentId = agentRecord.id;
    }

    const cutoff = new Date(
      Date.now() - RECENT_CONVERSATION_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    // Skip conversation lookup in dev mode if using dummy agent ID
    let existingConversation = null;
    let conversationLookupError = null;
    if (agentId !== "dev-agent-id") {
      const result = await supabase
        .from("agent_conversations")
        .select("id, created_at")
        .eq("user_id", userId)
        .eq("agent_id", agentId)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      existingConversation = result.data;
      conversationLookupError = result.error;
    }

    if (conversationLookupError) {
      console.error("Conversation lookup failed:", conversationLookupError);
      return NextResponse.json(
        { error: "Failed to load conversation" },
        { status: 500 }
      );
    }

    let conversationId = existingConversation?.id ?? null;

    if (!conversationId && agentId !== "dev-agent-id") {
      const { data: newConversation, error: conversationCreateError } =
        await supabase
          .from("agent_conversations")
          .insert({
            user_id: userId,
            agent_id: agentId,
          })
          .select("id")
          .single();

      if (conversationCreateError || !newConversation?.id) {
        console.error("Conversation create failed:", conversationCreateError);
        return NextResponse.json(
          { error: "Failed to create conversation" },
          { status: 500 }
        );
      }

      conversationId = newConversation.id;
    } else if (!conversationId && agentId === "dev-agent-id") {
      // In dev mode, use a dummy conversation ID
      conversationId = "dev-conversation-id";
    } else if (!conversationId && agentId === "dev-agent-id") {
      // In dev mode, use a dummy conversation ID
      conversationId = "dev-conversation-id";
    }

    // Load conversation history (allow failure in dev mode)
    let historicalMessages: any[] | null = null;
    if (conversationId && conversationId !== "dev-conversation-id") {
      const { data, error: historyError } = await supabase
        .from("agent_messages")
        .select("role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(MAX_CONTEXT_MESSAGES);

      if (historyError) {
        console.error("Conversation history load failed:", historyError);
        // In dev mode, continue without history. In production, this might be a real issue.
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { error: "Failed to load conversation history" },
            { status: 500 }
          );
        }
        // In dev mode, just log and continue with empty history
        console.warn("Continuing without conversation history in dev mode");
      } else {
        historicalMessages = data;
      }
    }

    const orderedHistory =
      historicalMessages?.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ) ?? [];

    // Fetch business context for ALL agents
    // All agents can benefit from business information for context-aware responses
    let businessContext = null;
    if (userId !== "dev-user") {
      try {
        businessContext = await getBusinessContext(userId);
      } catch (error) {
        console.error("Error fetching business context:", error);
        // Continue without business context if fetch fails
      }
    }

    // Fetch contact profile for Aloha calls (if phone number is provided)
    let contactProfile = null;
    if (agent === "aloha" && userId !== "dev-user" && callContext?.phoneNumber) {
      try {
        const { getContactForCallContext } = await import("@/lib/aloha/contact-memory");
        contactProfile = await getContactForCallContext(userId, callContext.phoneNumber);
      } catch (error) {
        console.error("Error fetching contact profile:", error);
        // Continue without contact profile if fetch fails
      }
    }

    // Build enhanced system prompt with business context
    // ALL agents receive business context for context-aware responses
    let systemPrompt = SYSTEM_PROMPTS[agent];
    
    // For Aloha agent, inject the user-configured display name
    if (agent === "aloha" && userId !== "dev-user") {
      const alohaDisplayName = await getAlohaDisplayName(userId);
      // Replace "ALOHA" references with the configured display name
      systemPrompt = systemPrompt.replace(/ALOHA/g, alohaDisplayName.toUpperCase());
      systemPrompt = systemPrompt.replace(/Aloha/g, alohaDisplayName);
      // Update introduction instructions to use display name
      if (businessContext?.profile.businessName) {
        systemPrompt += `\n\nIMPORTANT: When introducing yourself, use your configured name "${alohaDisplayName}" instead of "Aloha". For example: "Hi, this is ${alohaDisplayName} from ${businessContext.profile.businessName}. How can I help you today?"`;
      } else {
        systemPrompt += `\n\nIMPORTANT: When introducing yourself, use your configured name "${alohaDisplayName}" instead of "Aloha".`;
      }
    }
    
    if (businessContext) {
      const businessInfo: string[] = [];
      
      // Core business information (relevant for all agents)
      if (businessContext.profile.businessName) {
        businessInfo.push(`Business Name: ${businessContext.profile.businessName}`);
      }
      if (businessContext.profile.industry) {
        businessInfo.push(`Industry: ${businessContext.profile.industry}`);
      }
      if (businessContext.profile.description) {
        businessInfo.push(`Description: ${businessContext.profile.description}`);
      }
      if (businessContext.profile.hours) {
        businessInfo.push(`Operating Hours: ${businessContext.profile.hours}`);
      }
      if (businessContext.profile.location) {
        businessInfo.push(`Location: ${businessContext.profile.location}`);
      }
      if (businessContext.profile.serviceArea) {
        businessInfo.push(`Service Area: ${businessContext.profile.serviceArea}`);
      }
      if (businessContext.profile.services) {
        const servicesStr = Array.isArray(businessContext.profile.services)
          ? businessContext.profile.services.join(", ")
          : businessContext.profile.services;
        businessInfo.push(`Services: ${servicesStr}`);
      }
      if (businessContext.profile.contactEmail) {
        businessInfo.push(`Contact Email: ${businessContext.profile.contactEmail}`);
      }
      if (businessContext.profile.contactPhone) {
        businessInfo.push(`Contact Phone: ${businessContext.profile.contactPhone}`);
      }
      if (businessContext.profile.timezone) {
        businessInfo.push(`Timezone: ${businessContext.profile.timezone}`);
      }
      if (businessContext.profile.notes) {
        businessInfo.push(`Special Instructions: ${businessContext.profile.notes}`);
      }

      // Agent-specific context additions
      if (agent === "aloha") {
        // Aloha gets full knowledge base for answering questions
        if (businessContext.knowledgeChunks.length > 0) {
          businessInfo.push("\nBusiness Knowledge Base:");
          businessContext.knowledgeChunks.forEach((chunk) => {
            if (chunk.title) {
              businessInfo.push(`\n[${chunk.title}]`);
            }
            businessInfo.push(chunk.content.substring(0, 500)); // Limit each chunk to 500 chars
          });
        }
        if (businessInfo.length > 0) {
          // Get Aloha display name for context
          const alohaDisplayName = userId !== "dev-user" 
            ? await getAlohaDisplayName(userId) 
            : "Aloha";
          systemPrompt += `\n\n[BUSINESS CONTEXT]\n${businessInfo.join("\n")}\n\nUse this information to answer questions accurately and provide helpful responses. Remember to introduce yourself as "${alohaDisplayName}" when speaking to callers.`;
        }

        // Add contact context if available
        if (contactProfile) {
          try {
            const { buildContactContextPrompt } = await import("@/lib/aloha/contact-context");
            const contactContext = buildContactContextPrompt(contactProfile);
            if (contactContext) {
              systemPrompt += contactContext;
              
              // Add special handling for do-not-call contacts
              if (contactProfile.do_not_call) {
                systemPrompt += `\n\nIMPORTANT: This contact has requested not to receive calls. You may still answer inbound calls from them, but do NOT try to sell, upsell, or push campaigns. Be respectful and help with their immediate needs only.`;
              }
              
              // Add tone adjustment for returning contacts
              if (contactProfile.times_contacted > 0) {
                const { getToneAdjustment } = await import("@/lib/aloha/contact-context");
                const toneAdjustment = getToneAdjustment(contactProfile);
                if (toneAdjustment) {
                  systemPrompt += `\n\n${toneAdjustment}`;
                }
              }
            }
          } catch (error) {
            console.error("Error building contact context:", error);
            // Continue without contact context if build fails
          }
        }

        // Add scenario-aware instructions if call context is provided
        if (callContext && typeof callContext === "object") {
          try {
            const { enhancePromptWithScenario } = await import("@/lib/aloha/scenario-handler");
            const { detectScenario } = await import("@/lib/aloha/scenario-detection");
            const transcript = ""; // Empty transcript for initial scenario detection
            
            const scenarioContext: ScenarioContext = {
              sttConfidence: callContext.sttConfidence,
              audioQuality: callContext.audioQuality,
              hasEcho: callContext.hasEcho,
              hasBackgroundNoise: callContext.hasBackgroundNoise,
              isVoicemail: callContext.isVoicemail,
              callLatency: callContext.callLag,
              interruptionCount: callContext.interruptions || callContext.bargeIns,
              silenceDuration: callContext.silenceDuration,
              speechRate: callContext.speakingRate,
              topicSwitches: callContext.topicSwitches,
              emotionalKeywords: callContext.keywords || (callContext.emotionalTone ? [callContext.emotionalTone] : undefined),
              toneIndicators: callContext.emotionalTone ? [callContext.emotionalTone] : undefined,
              callerVerification: callContext.callerIdentified,
              requestedService: callContext.requestedService,
              requestedInfo: callContext.requestedInfo,
            };

            const scenario = detectScenario(scenarioContext, transcript);
            
            if (scenario && scenario.category !== "normal") {
              // Enhance prompt with scenario context
              systemPrompt = enhancePromptWithScenario(systemPrompt, scenario);
            }
          } catch (error) {
            console.error("Error generating scenario instructions:", error);
            // Continue without scenario instructions if generation fails
          }
        }
      } else if (agent === "studio") {
        // Studio gets watermark settings
        if (businessContext.profile.watermarkSettings?.enabled) {
          const watermarkInfo: string[] = [];
          watermarkInfo.push("WATERMARK SETTINGS:");
          watermarkInfo.push(`- Enabled: Yes`);
          if (businessContext.profile.watermarkSettings.text) {
            watermarkInfo.push(`- Text: "${businessContext.profile.watermarkSettings.text}"`);
          }
          if (businessContext.profile.watermarkSettings.logoUrl) {
            watermarkInfo.push(`- Logo URL: ${businessContext.profile.watermarkSettings.logoUrl}`);
          }
          if (businessContext.profile.watermarkSettings.position) {
            watermarkInfo.push(`- Position: ${businessContext.profile.watermarkSettings.position}`);
          }
          watermarkInfo.push("\nBy default, apply this watermark to images unless the user explicitly requests otherwise.");
          businessInfo.push(`\n${watermarkInfo.join("\n")}`);
        }
        if (businessInfo.length > 0) {
          systemPrompt += `\n\n[BUSINESS CONTEXT]\n${businessInfo.join("\n")}\n\nUse this business information to provide contextually relevant suggestions and apply branding preferences.`;
        }
      } else if (agent === "sync") {
        // Sync gets business info for email/calendar context
        if (businessContext.knowledgeChunks.length > 0) {
          // Include relevant knowledge chunks for email context
          const relevantChunks = businessContext.knowledgeChunks
            .filter(chunk => 
              chunk.source === "form" || 
              chunk.title?.toLowerCase().includes("service") ||
              chunk.title?.toLowerCase().includes("policy")
            )
            .slice(0, 3); // Limit to 3 most relevant chunks
          
          if (relevantChunks.length > 0) {
            businessInfo.push("\nRelevant Business Information:");
            relevantChunks.forEach((chunk) => {
              if (chunk.title) {
                businessInfo.push(`\n[${chunk.title}]`);
              }
              businessInfo.push(chunk.content.substring(0, 300));
            });
          }
        }
        if (businessInfo.length > 0) {
          systemPrompt += `\n\n[BUSINESS CONTEXT]\n${businessInfo.join("\n")}\n\nUse this information to draft contextually appropriate emails and schedule events considering business hours and timezone.`;
        }
      } else if (agent === "insight") {
        // Insight gets business info for context-aware analysis
        if (businessContext.knowledgeChunks.length > 0) {
          // Include business knowledge for better insights
          const relevantChunks = businessContext.knowledgeChunks
            .filter(chunk => 
              chunk.source === "form" || 
              chunk.title?.toLowerCase().includes("service") ||
              chunk.title?.toLowerCase().includes("about")
            )
            .slice(0, 2); // Limit to 2 most relevant chunks
          
          if (relevantChunks.length > 0) {
            businessInfo.push("\nBusiness Background:");
            relevantChunks.forEach((chunk) => {
              if (chunk.title) {
                businessInfo.push(`\n[${chunk.title}]`);
              }
              businessInfo.push(chunk.content.substring(0, 400));
            });
          }
        }
        if (businessInfo.length > 0) {
          systemPrompt += `\n\n[BUSINESS CONTEXT]\n${businessInfo.join("\n")}\n\nUse this business information to generate contextually relevant insights and recommendations tailored to this business.`;
        }
      } else {
        // For any other agents, provide basic business context
        if (businessInfo.length > 0) {
          systemPrompt += `\n\n[BUSINESS CONTEXT]\n${businessInfo.join("\n")}\n\nUse this business information to provide contextually relevant responses.`;
        }
      }
    }

    // Add language instruction to system prompt
    if (language && language !== "English") {
      const languageInstruction = `\n\nIMPORTANT: Write all your responses in ${language}. All text you generate (emails, summaries, captions, briefs, call transcripts, follow-up descriptions, etc.) must be written naturally in ${language}, as if originally composed in ${language}. Do not mention that you are translating; simply respond in ${language}. Keep numbers, entity names, dates, and technical terms as-is unless specifically requested to translate them.`;
      systemPrompt += languageInstruction;
    }

    const model = getModelForTask(agent, taskType);
    // Use ChatCompletionMessageParam[] to support multi-part content (text + images) for Studio
    const openAiMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];

    if (agent === "aloha" || agent === "sync") {
      const followupContext = await loadOpenFollowups(
        supabase,
        userId,
        FOLLOWUP_CONTEXT_SOURCES
      );
      if (followupContext) {
        openAiMessages.push({
          role: "assistant",
          content: followupContext,
        });
      }
    }

    if (agent === "insight") {
      const statsContext = await buildBetaStatsContext(supabase, userId);
      if (statsContext) {
        openAiMessages.push({
          role: "assistant",
          content: statsContext,
        });
      }
    }

    openAiMessages.push(
      ...orderedHistory.map((msg) => ({
        role: msg.role as "assistant" | "user",
        content: msg.content,
      }))
    );

    // For Studio agent, include context and image in the message
    if (agent === "studio") {
      // Build context string for Studio agent
      const contextParts: string[] = [];
      
      // Add business context summary for Studio
      if (businessContext) {
        if (businessContext.profile.businessName) {
          contextParts.push(`Business: ${businessContext.profile.businessName}`);
        }
        if (businessContext.profile.industry) {
          contextParts.push(`Industry: ${businessContext.profile.industry}`);
        }
      }
      
      // Add watermark settings to context if enabled
      if (businessContext?.profile.watermarkSettings?.enabled) {
        contextParts.push(`Watermark enabled: true`);
        if (businessContext.profile.watermarkSettings.text) {
          contextParts.push(`Watermark text: "${businessContext.profile.watermarkSettings.text}"`);
        }
        if (businessContext.profile.watermarkSettings.logoUrl) {
          contextParts.push(`Watermark logo URL: ${businessContext.profile.watermarkSettings.logoUrl}`);
        }
        if (businessContext.profile.watermarkSettings.position) {
          contextParts.push(`Watermark position: ${businessContext.profile.watermarkSettings.position}`);
        }
      }
      
      if (context.brightness !== undefined) {
        contextParts.push(`Current brightness: ${context.brightness}`);
      }
      if (context.contrast !== undefined) {
        contextParts.push(`Current contrast: ${context.contrast}`);
      }
      if (context.saturation !== undefined) {
        contextParts.push(`Current saturation: ${context.saturation}`);
      }
      if (context.textItems && Array.isArray(context.textItems) && context.textItems.length > 0) {
        contextParts.push(`Current text items (${context.textItems.length}):`);
        context.textItems.forEach((item: any, idx: number) => {
          contextParts.push(`  ${idx + 1}. "${item.content}" - ${item.fontSize}px, ${item.color}, ${item.fontFamily}${item.bold ? ', bold' : ''}${item.italic ? ', italic' : ''}${item.effectType && item.effectType !== 'none' ? `, ${item.effectType} effect` : ''}`);
        });
      }
      
      const contextString = contextParts.length > 0 
        ? `[Current Editor State]\n${contextParts.join('\n')}\n\n[User Request]\n${message}`
        : message;
      
      // Include image if available (should be data URL from client)
      if (context.imagePreviewUrl && typeof context.imagePreviewUrl === "string" && context.imagePreviewUrl.startsWith("data:image/")) {
        // For Studio, send image as part of the message using vision API
        openAiMessages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: contextString,
            },
            {
              type: "image_url",
              image_url: {
                url: context.imagePreviewUrl,
              },
            },
          ],
        });
      } else {
        // If no image or invalid format, just send text with image description
        const imageDescription = context.imageName 
          ? `\n[Note: User is editing image: ${context.imageName}]`
          : "";
        openAiMessages.push({
          role: "user",
          content: contextString + imageDescription,
        });
      }
    } else {
      // For all other agents, send plain text messages
      openAiMessages.push({ role: "user", content: message });
    }

    // Define tools for Studio agent
    const studioTools = agent === "studio" ? [
      {
        type: "function" as const,
        function: {
          name: "update_text_item",
          description: "Update an existing text overlay item. Use this to change content, color, font, size, position, effects, etc.",
          parameters: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "The ID of the text item to update. If not provided, update the first/selected item.",
              },
              updates: {
                type: "object",
                description: "The properties to update",
                properties: {
                  content: { type: "string", description: "The text content" },
                  color: { type: "string", description: "Color in HEX format (e.g., '#FFFFFF', '#FFD700')" },
                  fontFamily: { type: "string", description: "Font family (e.g., 'Roboto, sans-serif', 'Inter, sans-serif')" },
                  fontSize: { type: "number", description: "Font size in pixels (12-72)" },
                  bold: { type: "boolean", description: "Make text bold" },
                  italic: { type: "boolean", description: "Make text italic" },
                  underline: { type: "boolean", description: "Underline text" },
                  position: {
                    type: "object",
                    description: "Position as percentage (0-100)",
                    properties: {
                      x: { type: "number", description: "Horizontal position (0-100)" },
                      y: { type: "number", description: "Vertical position (0-100)" },
                    },
                  },
                  alignment: { type: "string", enum: ["center", "left", "right"], description: "Text alignment" },
                  effectType: { type: "string", enum: ["none", "glow", "outline", "highlight", "shadow"], description: "Text effect type" },
                  effectColor: { type: "string", description: "Effect color in HEX format" },
                  effectIntensity: { type: "number", description: "Effect intensity (0-100)" },
                  effectThickness: { type: "number", description: "Outline thickness in pixels (0-10)" },
                  highlightPadding: { type: "number", description: "Highlight padding in pixels (0-20)" },
                },
              },
            },
            required: ["updates"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "add_text_item",
          description: "Add a new text overlay item to the image",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "The text content to display",
              },
              color: {
                type: "string",
                description: "Text color in HEX format (default: '#FFFFFF')",
                default: "#FFFFFF",
              },
              fontFamily: {
                type: "string",
                description: "Font family (default: 'Inter, sans-serif')",
                default: "Inter, sans-serif",
              },
              fontSize: {
                type: "number",
                description: "Font size in pixels (default: 32)",
                default: 32,
              },
              bold: { type: "boolean", description: "Make text bold (default: false)", default: false },
              italic: { type: "boolean", description: "Make text italic (default: false)", default: false },
              underline: { type: "boolean", description: "Underline text (default: false)", default: false },
              position: {
                type: "object",
                description: "Position as percentage (default: center {x: 50, y: 50})",
                properties: {
                  x: { type: "number", description: "Horizontal position (0-100)", default: 50 },
                  y: { type: "number", description: "Vertical position (0-100)", default: 50 },
                },
                default: { x: 50, y: 50 },
              },
              alignment: { type: "string", enum: ["center", "left", "right"], description: "Text alignment (default: 'center')", default: "center" },
              effectType: { type: "string", enum: ["none", "glow", "outline", "highlight", "shadow"], description: "Text effect type (default: 'none')", default: "none" },
              effectColor: { type: "string", description: "Effect color in HEX format (default: '#000000')", default: "#000000" },
              effectIntensity: { type: "number", description: "Effect intensity 0-100 (default: 50)", default: 50 },
              effectThickness: { type: "number", description: "Outline thickness in pixels 0-10 (default: 2)", default: 2 },
              highlightPadding: { type: "number", description: "Highlight padding in pixels 0-20 (default: 4)", default: 4 },
            },
            required: ["content"],
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "update_adjustments",
          description: "Update image adjustments like brightness, contrast, saturation, warmth, shadows, highlights, or zoom",
          parameters: {
            type: "object",
            properties: {
              brightness: { type: "number", description: "Brightness percentage (0-200, default: 100)" },
              contrast: { type: "number", description: "Contrast percentage (0-200, default: 100)" },
              saturation: { type: "number", description: "Saturation percentage (0-200, default: 100)" },
              warmth: { type: "number", description: "Temperature/warmth (-50 to 50, default: 0)" },
              shadows: { type: "number", description: "Shadow adjustment (-50 to 50, default: 0)" },
              highlights: { type: "number", description: "Highlight adjustment (-50 to 50, default: 0)" },
              zoom: { type: "number", description: "Zoom level (-50 to 100, default: 0)" },
            },
          },
        },
      },
      {
        type: "function" as const,
        function: {
          name: "set_filter",
          description: "Apply a preset filter to the image",
          parameters: {
            type: "object",
            properties: {
              filter: {
                type: "string",
                enum: ["Monochrome", "B&W", "Sepia", "Vintage", "Dramatic", "Cool", "Warm", "Cinematic", "Soft", "Vivid"],
                description: "The filter name to apply. Pass null to remove filter.",
              },
            },
            required: ["filter"],
          },
        },
      },
    ] : undefined;

    const response = await openai.chat.completions.create({
      model,
      messages: openAiMessages,
      ...(studioTools && { tools: studioTools, tool_choice: "auto" }),
    });

    // Check if Studio agent returned a tool call
    if (agent === "studio" && response.choices[0]?.message?.tool_calls && response.choices[0].message.tool_calls.length > 0) {
      const toolCall = response.choices[0].message.tool_calls[0];
      if (toolCall.type === "function") {
        return NextResponse.json({
          ok: true,
          agent,
          tool: {
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments || "{}"),
          },
          conversationId,
        });
      }
    }

    const text =
      response.choices[0]?.message?.content ?? "No response from model";

    // Detect and log knowledge gaps for Aloha
    // Also handle scenarios and update call notes
    if (agent === "aloha" && userId !== "dev-user") {
      await detectAndLogKnowledgeGaps(
        userId,
        text,
        message,
        businessContext,
        callContext
      );

      // Handle scenarios and update call notes if needed
      if (callContext && typeof callContext === "object") {
        try {
          const { handleScenario } = await import("@/lib/aloha/scenario-handler");
          
          // Note: Scenario handling is done during the conversation, not after
          // This section can be removed or simplified if not needed
          // Keeping minimal scenario context for potential future use
          const scenarioContext: ScenarioContext = {
            sttConfidence: callContext.sttConfidence,
            audioQuality: callContext.audioQuality,
            hasEcho: callContext.hasEcho,
            hasBackgroundNoise: callContext.hasBackgroundNoise,
            isVoicemail: callContext.isVoicemail,
            callLatency: callContext.callLag,
            interruptionCount: callContext.interruptions || callContext.bargeIns,
            silenceDuration: callContext.silenceDuration,
            speechRate: callContext.speakingRate,
            topicSwitches: callContext.topicSwitches,
            emotionalKeywords: callContext.keywords || (callContext.emotionalTone ? [callContext.emotionalTone] : undefined),
            toneIndicators: callContext.emotionalTone ? [callContext.emotionalTone] : undefined,
            callerVerification: callContext.callerIdentified,
            requestedService: callContext.requestedService,
            requestedInfo: callContext.requestedInfo,
          };

          // Scenario handling is integrated into the conversation flow
          // This section is kept for reference but scenario detection happens in real-time
        } catch (error) {
          console.error("Error handling scenarios:", error);
          // Don't fail the request if scenario handling fails
        }
      }
    }

    const now = Date.now();

    // Skip message inserts in dev mode when using dummy conversation ID
    if (conversationId !== "dev-conversation-id") {
      const messageInserts = [
        {
          conversation_id: conversationId,
          role: "user",
          content: message,
          created_at: new Date(now).toISOString(),
        },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: text,
          created_at: new Date(now + 1).toISOString(),
        },
      ];

      const { error: insertError } = await supabase
        .from("agent_messages")
        .insert(messageInserts);

      if (insertError) {
        console.error("Message insert failed:", insertError);
        return NextResponse.json(
          { error: "Failed to store conversation" },
          { status: 500 }
        );
      }
    }

    let metadata: Record<string, string> | undefined;

    if (agent === "aloha" && agentId !== "dev-agent-id") {
      const { cleaned, fields } = extractStructuredSection(
        text,
        "CALL_OUTCOME"
      );
      const outcome = normalizeValue(fields["outcome"]) || "unspecified";
      
      // Get contact profile ID if available
      let contactId: string | null = null;
      let phoneNumber: string | null = null;
      if (callContext?.phoneNumber && contactProfile) {
        contactId = contactProfile.id;
        phoneNumber = callContext.phoneNumber;
      } else if (callContext?.phoneNumber) {
        // Look up or create contact profile
        try {
          const { lookupOrCreateContact, normalizePhoneNumber: normalizePhone } = await import("@/lib/aloha/contact-memory");
          const normalizedPhone = normalizePhone(callContext.phoneNumber);
          const contact = await lookupOrCreateContact(userId, normalizedPhone);
          if (contact) {
            contactId = contact.id;
            phoneNumber = normalizedPhone;
          }
        } catch (error) {
          console.error("Error looking up contact profile:", error);
        }
      }

      // Determine sentiment from intent classification (if available)
      let sentiment: string | null = null;
      if (callContext?.emotionalState || callContext?.sentiment) {
        sentiment = callContext.emotionalState || callContext.sentiment || null;
      }

      // Determine direction (inbound vs outbound)
      const direction = callContext?.direction || callContext?.callType || null;

      const { data: callInsert, error: callError } = await supabase
        .from("calls")
        .insert({
          user_id: userId,
          agent_id: agentId,
          contact_id: contactId,
          campaign_id: callContext?.campaignId || null,
          phone_number: phoneNumber,
          summary: cleaned,
          outcome,
          sentiment,
          direction,
          is_test_call: callContext?.isTestCall || false,
          started_at: safeDate(callContext.started_at) ?? new Date(now).toISOString(),
          ended_at: safeDate(callContext.ended_at) ?? new Date(now).toISOString(),
        })
        .select("id")
        .single();

      if (callError) {
        console.error("Call insert failed:", callError);
      } else if (callInsert?.id) {
        metadata = { ...metadata, callId: callInsert.id };

        // Update contact profile after call (if not a test call and phone number available)
        if (!callContext?.isTestCall && phoneNumber) {
          try {
            const { updateContactAfterCall, determineCallOutcome } = await import("@/lib/aloha/contact-memory");
            const { classifyIntent } = await import("@/lib/aloha/intent-classification");
            
            // Determine call outcome
            const intent = classifyIntent(message);
            const callOutcome = determineCallOutcome(intent, message, cleaned) || outcome;
            
            // Check if outcome indicates do-not-call
            let doNotCall = false;
            if (callOutcome === "do_not_call" || outcome === "opt_out" || metadata?.shouldOptOut === "true") {
              doNotCall = true;
            }
            
            // Update contact profile
            await updateContactAfterCall(userId, phoneNumber, {
              last_called_at: new Date(now).toISOString(),
              last_campaign_id: callContext?.campaignId || null,
              last_outcome: callOutcome,
              do_not_call: doNotCall,
              sentiment: sentiment || null,
            });
            
            // If do-not-call, update the flag
            if (doNotCall) {
              const { setDoNotCall } = await import("@/lib/aloha/contact-memory");
              await setDoNotCall(userId, phoneNumber, true);
            }
          } catch (error) {
            console.error("Error updating contact profile after call:", error);
            // Don't fail the request if contact update fails
          }
        }

        const followupTitle = normalizeValue(fields["followup_title"]);
        if (followupTitle) {
          const { error: followupError, data: followupInsert } = await supabase
            .from("followups")
            .insert({
              user_id: userId,
              source_agent: "aloha",
              related_call_id: callInsert.id,
              title: followupTitle,
              description:
                normalizeValue(fields["followup_description"]) || followupTitle,
              due_at: safeDate(fields["followup_due_at"] ?? undefined),
              status: "open",
            })
            .select("id")
            .single();

          if (followupError) {
            console.error("Aloha followup insert failed:", followupError);
          } else if (followupInsert?.id) {
            metadata = { ...metadata, followupId: followupInsert.id };
          }
        }

        // If Aloha created an appointment, sync it to Google Calendar
        if (outcome === "scheduled" || fields["followup_title"]?.toLowerCase().includes("appointment")) {
          try {
            const followupTitle = normalizeValue(fields["followup_title"]);
            const followupDescription = normalizeValue(fields["followup_description"]);
            const followupDueAt = safeDate(fields["followup_due_at"] ?? undefined);

            if (followupDueAt && followupTitle) {
              // Calculate end time (default 1 hour duration)
              const startTime = new Date(followupDueAt);
              const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later

              // Sync to calendar (async, don't wait)
              // Use internal fetch with proper URL construction
              const calendarSyncUrl = new URL("/api/calendar/aloha-sync", 
                process.env.NEXT_PUBLIC_APP_URL || 
                (req.headers.get("host") ? `https://${req.headers.get("host")}` : "http://localhost:3001")
              );
              
              fetch(calendarSyncUrl.toString(), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  action: "create",
                  callId: callInsert.id,
                  appointmentData: {
                    summary: followupTitle,
                    description: followupDescription || `Appointment scheduled from call`,
                    start: startTime.toISOString(),
                    end: endTime.toISOString(),
                    notes: cleaned, // Call summary as notes
                  },
                }),
              }).catch((err) => {
                console.error("Failed to sync appointment to calendar:", err);
                // Don't fail the request if calendar sync fails
              });
            }
          } catch (err) {
            console.error("Error syncing appointment to calendar:", err);
            // Don't fail the request if calendar sync fails
          }
        }
      }
    } else if (agent === "sync") {
      const { cleaned, fields } = extractStructuredSection(
        text,
        "EMAIL_OUTCOME"
      );
      const importance =
        normalizeValue(fields["importance"])?.toLowerCase() || "normal";
      const { data: emailInsert, error: emailError } = await supabase
        .from("email_summaries")
        .insert({
          user_id: userId,
          agent_id: agentId,
          email_id: emailContext.emailId ?? null,
          subject: emailContext.subject ?? null,
          from_address: emailContext.fromAddress ?? null,
          importance,
          summary: cleaned,
        })
        .select("id")
        .single();

      if (emailError) {
        console.error("Email summary insert failed:", emailError);
      } else if (emailInsert?.id) {
        metadata = { ...metadata, emailSummaryId: emailInsert.id };
        const followupTitle = normalizeValue(fields["followup_title"]);
        if (followupTitle) {
          const { error: followupError, data: followupInsert } = await supabase
            .from("followups")
            .insert({
              user_id: userId,
              source_agent: "sync",
              related_email_id: emailInsert.id,
              title: followupTitle,
              description:
                normalizeValue(fields["followup_description"]) || followupTitle,
              due_at: safeDate(fields["followup_due_at"] ?? undefined),
              status: "open",
            })
            .select("id")
            .single();

          if (followupError) {
            console.error("Sync followup insert failed:", followupError);
          } else if (followupInsert?.id) {
            metadata = { ...metadata, followupId: followupInsert.id };
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      agent,
      reply: text,
      conversationId,
      metadata,
    });
  } catch (error) {
    console.error("Error in /api/brain:", error);
    return NextResponse.json(
      { error: "Error talking to OpenAI" },
      { status: 500 }
    );
  }
}

