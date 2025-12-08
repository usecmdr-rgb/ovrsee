/**
 * AI Voice Profile Builder
 * Constructs structured voice instructions for AI draft generation
 * Based on user preferences, lead context, and business information
 */

import type { BusinessContextBundle } from "./businessInfo";
import type { Lead } from "./crm";

export interface VoiceProfileInput {
  tonePreset?: "friendly" | "professional" | "direct" | "custom";
  toneCustomInstructions?: string | null;
  followUpIntensity?: "light" | "normal" | "strong";
  lead?: {
    stage?: string;
    score?: number;
    urgencyLevel?: "low" | "medium" | "high" | "unknown";
  } | null;
  businessContext?: BusinessContextBundle | null;
}

/**
 * Build AI voice profile instructions
 * Returns a structured string that guides the AI's tone, structure, and CTA approach
 */
export function buildAIVoiceProfile(input: VoiceProfileInput): string {
  const {
    tonePreset = "professional",
    toneCustomInstructions,
    followUpIntensity = "normal",
    lead,
    businessContext,
  } = input;

  const instructions: string[] = [];

  // TONE GUIDANCE
  instructions.push("=== TONE & STYLE ===");
  
  if (tonePreset === "friendly") {
    instructions.push(
      "- Use a warm, friendly tone with clear explanations.",
      "- Be approachable and conversational while remaining professional.",
      "- Include a brief greeting and optional soft close.",
      "- Use contractions naturally (e.g., \"I'm\", \"we're\")."
    );
  } else if (tonePreset === "professional") {
    instructions.push(
      "- Use a concise, professional tone suitable for business communication.",
      "- Be clear and direct without being overly casual.",
      "- Include a brief greeting.",
      "- Keep sentences structured and polished."
    );
  } else if (tonePreset === "direct") {
    instructions.push(
      "- Be direct and concise, avoid unnecessary fluff.",
      "- Get to the point quickly.",
      "- Skip greetings unless contextually necessary.",
      "- Use short sentences and bullet points for clarity."
    );
  } else if (tonePreset === "custom" && toneCustomInstructions) {
    instructions.push(`- Custom tone instructions: ${toneCustomInstructions}`);
  }

  // FOLLOW-UP INTENSITY
  instructions.push("\n=== FOLLOW-UP INTENSITY ===");
  
  if (followUpIntensity === "light") {
    instructions.push(
      "- Use soft language and only nudge after longer gaps.",
      "- Be gentle and non-pushy.",
      "- Frame follow-ups as helpful check-ins rather than urgent requests."
    );
  } else if (followUpIntensity === "strong") {
    instructions.push(
      "- Be more proactive and use firmer language when appropriate.",
      "- Show urgency when needed.",
      "- Use stronger CTAs (e.g., \"Let's schedule a call this week\" vs \"Would you like to chat?\")."
    );
  } else {
    instructions.push(
      "- Use a balanced approach for follow-ups.",
      "- Be helpful but not pushy."
    );
  }

  // LEAD STAGE & SCORE AWARENESS
  if (lead) {
    instructions.push("\n=== LEAD CONTEXT ===");
    
    const { stage, score, urgencyLevel } = lead;
    
    if (stage) {
      instructions.push(`- Lead stage: ${stage}`);
      
      if (["warm", "negotiating", "ready_to_close"].includes(stage)) {
        instructions.push(
          "- This lead is in an advanced stage. Use a more sales-ready approach.",
          "- Include a clear, actionable CTA (schedule meeting, confirm details, close deal).",
          "- Reference specific next steps or commitments."
        );
      } else if (stage === "qualified") {
        instructions.push(
          "- This lead is qualified. Focus on moving them forward with clear value propositions.",
          "- Include a moderate CTA (schedule a call, provide more info)."
        );
      } else if (["new", "cold"].includes(stage)) {
        instructions.push(
          "- This is an early-stage lead. Focus on building rapport and understanding needs.",
          "- Use a softer CTA (reply with questions, schedule an intro call)."
        );
      }
    }

    if (score !== undefined) {
      if (score >= 80) {
        instructions.push(
          "- Lead score is high (hot lead). Prioritize urgency and clear next steps.",
          "- Use stronger CTAs appropriate for hot leads."
        );
      } else if (score >= 60) {
        instructions.push(
          "- Lead score is warm. Maintain engagement with value-focused messaging."
        );
      }
    }

    if (urgencyLevel === "high") {
      instructions.push("- High urgency detected. Emphasize timely response and action.");
    } else if (urgencyLevel === "medium") {
      instructions.push("- Moderate urgency. Balance helpfulness with gentle prompting.");
    }
  }

  // STRUCTURE GUIDELINES
  instructions.push("\n=== EMAIL STRUCTURE ===");
  instructions.push(
    "- Start with a brief greeting (unless tone=direct and context doesn't require it).",
    "- Include 1 sentence of context alignment (\"Thanks for reaching out...\" / \"Following up on...\").",
    "- Use bullet points for key information when listing multiple items (pricing, scheduling options, next steps).",
    "- End with a clear CTA (call-to-action) appropriate for the lead stage and intensity.",
    "- Optional soft close when tone=friendly (e.g., \"Looking forward to hearing from you!\")."
  );

  // CTA STRENGTH LOGIC
  instructions.push("\n=== CTA STRENGTH ===");
  
  const isAdvancedStage = lead?.stage && ["warm", "negotiating", "ready_to_close"].includes(lead.stage);
  const isStrongIntensity = followUpIntensity === "strong";
  
  if (isAdvancedStage && isStrongIntensity) {
    instructions.push(
      "- Use a sharp, sales-ready CTA (e.g., \"Let's schedule a call this week to finalize details\" or \"Ready to move forward? Let's set up a time to discuss next steps.\").",
      "- Be direct about closing or moving to the next stage."
    );
  } else if (isAdvancedStage) {
    instructions.push(
      "- Use a clear, professional CTA (e.g., \"Would you like to schedule a call to discuss this further?\")."
    );
  } else if (isStrongIntensity) {
    instructions.push(
      "- Use a more assertive CTA (e.g., \"Let's connect this week\" vs \"Would you like to chat?\")."
    );
  } else {
    instructions.push(
      "- Use a standard, helpful CTA (e.g., \"Feel free to reach out if you have any questions\" or \"Would you like to schedule a call?\")."
    );
  }

  // BUSINESS CONTEXT REMINDER
  if (businessContext) {
    instructions.push("\n=== BUSINESS INFORMATION ===");
    instructions.push(
      "- Use ONLY the pricing and services provided in the BUSINESS INFORMATION section.",
      "- NEVER invent or guess prices, services, or policies.",
      "- If customer asks about pricing, identify the relevant service from the provided list and respond with accurate details.",
      "- Match the brand voice specified in BUSINESS INFORMATION."
    );
  }

  return instructions.join("\n");
}


