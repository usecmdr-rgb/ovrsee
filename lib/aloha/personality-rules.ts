/**
 * Aloha Personality Micro-Rules
 * 
 * Always-on behavioral rules that run on EVERY response to keep Aloha
 * consistent, calm, and human-like. Applied after content generation
 * and tone preset, but before TTS.
 */

import type { CallState } from "./state-machine";
import type { TonePreset } from "./tone-presets";
import type { AlohaCallContext } from "./state-machine";

export interface PersonalityRuleContext {
  state: CallState;
  tonePreset: TonePreset;
  callContext: AlohaCallContext;
  isFirstResponse: boolean;
  isClosing: boolean;
  isClarification: boolean;
  callerName?: string;
  businessName?: string;
}

/**
 * Apply personality micro-rules to response
 */
export function applyPersonalityRules(
  responseText: string,
  context: PersonalityRuleContext
): string {
  let processed = responseText;

  // Rule 1: Always calm and polite
  processed = enforceCalmAndPolite(processed);

  // Rule 2: Honest about limitations
  processed = ensureHonestLimitations(processed);

  // Rule 3: Short over long
  processed = enforceBrevity(processed, context);

  // Rule 4: One step at a time
  processed = enforceOneStepAtATime(processed);

  // Rule 5: Periodic purpose reminder (if in longer call)
  if (shouldRemindPurpose(context)) {
    processed = addPurposeReminder(processed, context);
  }

  // Rule 6: Never pretend to be human
  processed = ensureAIIdentity(processed, context);

  // Rule 7: Respect caller boundaries
  processed = respectCallerBoundaries(processed, context);

  // Rule 8: Clean closing
  if (context.isClosing) {
    processed = ensureCleanClosing(processed, context);
  }

  // Remove any banned phrases
  processed = removeBannedPhrases(processed);

  return processed.trim();
}

/**
 * Rule 1: Always calm and polite
 * Remove aggressive language, ensure neutral/kind tone
 */
function enforceCalmAndPolite(text: string): string {
  // Remove aggressive phrases
  const aggressivePhrases = [
    /\b(you must|you have to|you need to)\b/gi,
    /\b(that's wrong|incorrect|no, that's not)\b/gi,
  ];

  let cleaned = text;
  aggressivePhrases.forEach((phrase) => {
    cleaned = cleaned.replace(phrase, (match) => {
      // Replace with softer alternatives
      if (match.toLowerCase().includes("must") || match.toLowerCase().includes("have to")) {
        return "I'd recommend";
      }
      if (match.toLowerCase().includes("wrong") || match.toLowerCase().includes("incorrect")) {
        return "let me clarify";
      }
      return match;
    });
  });

  // Ensure polite language
  if (!cleaned.match(/\b(please|thank you|I appreciate|I understand)\b/i)) {
    // Add a polite phrase if none exists (30% chance)
    if (Math.random() < 0.3) {
      const politePhrases = [
        "I appreciate your patience",
        "Thank you for your time",
        "I understand",
      ];
      const phrase =
        politePhrases[Math.floor(Math.random() * politePhrases.length)];
      cleaned = `${phrase}. ${cleaned}`;
    }
  }

  return cleaned;
}

/**
 * Rule 2: Honest about limitations
 * Ensure Aloha acknowledges when it doesn't know something
 */
function ensureHonestLimitations(text: string): string {
  // Check if response contains uncertainty indicators
  const uncertaintyPhrases = [
    /\b(I don't know|I'm not sure|I don't have|unable to|can't tell)\b/i,
  ];

  const hasUncertainty = uncertaintyPhrases.some((phrase) => phrase.test(text));

  if (hasUncertainty) {
    // Ensure follow-up is offered
    if (!text.match(/\b(follow up|call back|get back to you|someone will)\b/i)) {
      text += " I'll make sure someone follows up with you about this.";
    }
  }

  return text;
}

/**
 * Rule 3: Short over long
 * Compress overly long responses
 */
function enforceBrevity(
  text: string,
  context: PersonalityRuleContext
): string {
  const maxLength = context.tonePreset.maxSentenceLength * 3; // ~3 sentences max

  if (text.length > maxLength) {
    // Try to compress by removing unnecessary qualifiers
    let compressed = text;

    // Remove redundant phrases
    compressed = compressed.replace(
      /\b(I just wanted to let you know that|I wanted to inform you that|I'd like to mention that)\b/gi,
      ""
    );

    // Remove excessive qualifiers
    compressed = compressed.replace(
      /\b(actually|basically|essentially|literally|really|very|quite|rather)\b/gi,
      ""
    );

    // If still too long, truncate at sentence boundary
    if (compressed.length > maxLength) {
      const sentences = compressed.split(/([.!?]+)/);
      let truncated = "";
      for (let i = 0; i < sentences.length; i += 2) {
        const sentence = sentences[i] + (sentences[i + 1] || "");
        if ((truncated + sentence).length > maxLength) {
          break;
        }
        truncated += sentence + " ";
      }
      compressed = truncated.trim() + "...";
    }

    return compressed;
  }

  return text;
}

/**
 * Rule 4: One step at a time
 * Avoid asking multiple complex questions
 */
function enforceOneStepAtATime(text: string): string {
  // Count question marks
  const questionCount = (text.match(/\?/g) || []).length;

  if (questionCount > 2) {
    // Keep only the first question, remove others
    const parts = text.split(/\?/);
    if (parts.length > 1) {
      return parts[0] + "? " + parts.slice(1).join(" ").replace(/\?/g, ".");
    }
  }

  // Ensure questions are simple
  const complexQuestions = text.match(/[.!?]\s+[A-Z][^.!?]*\?/g);
  if (complexQuestions && complexQuestions.length > 1) {
    // Keep only the first question
    const firstQuestion = complexQuestions[0];
    const rest = text.substring(text.indexOf(firstQuestion) + firstQuestion.length);
    return firstQuestion + " " + rest.replace(/\?/g, ".");
  }

  return text;
}

/**
 * Rule 5: Periodic purpose reminder
 * Check if we should remind caller of purpose
 */
function shouldRemindPurpose(context: PersonalityRuleContext): boolean {
  // Remind if:
  // - In INTERACTION state
  // - Purpose was delivered more than 30 seconds ago
  // - Call has been going for a while
  if (context.state !== "INTERACTION") {
    return false;
  }

  if (!context.callContext.hasDeliveredPurpose) {
    return false;
  }

  const callDuration =
    Date.now() - context.callContext.startedAt.getTime();
  const purposeAge = context.callContext.purposeDeliveredAt
    ? Date.now() - context.callContext.purposeDeliveredAt.getTime()
    : 0;

  // Remind if call is long (>2 minutes) and purpose was delivered >30s ago
  return callDuration > 120000 && purposeAge > 30000;
}

/**
 * Add purpose reminder to response
 */
function addPurposeReminder(
  text: string,
  context: PersonalityRuleContext
): string {
  if (!context.callContext.campaignPurpose) {
    return text;
  }

  const reminder = `Just as a reminder, I'm calling to ${context.callContext.campaignPurpose}. `;

  // Add reminder at the beginning (30% chance) or after first sentence (70% chance)
  if (Math.random() < 0.3) {
    return reminder + text;
  } else {
    return text.replace(
      /([.!?])\s+([A-Z])/,
      `$1 ${reminder}$2`
    );
  }
}

/**
 * Rule 6: Never pretend to be human
 * Ensure AI identity is clear if challenged
 */
function ensureAIIdentity(
  text: string,
  context: PersonalityRuleContext
): string {
  // Check if caller might be confused about identity
  const identityChallenges = [
    /\b(are you a person|are you human|are you real|who am I talking to)\b/i,
  ];

  // If response doesn't clarify AI identity when challenged, add clarification
  const hasChallenge = identityChallenges.some((pattern) =>
    pattern.test(context.callContext.lastUserUtterance)
  );

  if (hasChallenge && !text.match(/\b(ai|assistant|virtual|aloha)\b/i)) {
    const businessName = context.businessName || "our business";
    return `I'm Aloha, a virtual assistant for ${businessName}, and I'm here to help. ${text}`;
  }

  return text;
}

/**
 * Rule 7: Respect caller boundaries
 * Handle exit requests and human follow-up requests
 */
function respectCallerBoundaries(
  text: string,
  context: PersonalityRuleContext
): string {
  // If exit requested, ensure polite acknowledgment
  if (context.callContext.exitRequested) {
    if (!text.match(/\b(thank you|appreciate|goodbye|have a great)\b/i)) {
      text += " Thank you for your time. Have a great day!";
    }
  }

  // If human follow-up requested, ensure confirmation
  if (context.callContext.needsHumanFollowup) {
    if (!text.match(/\b(call back|follow up|someone will|get back to you)\b/i)) {
      text += " Someone from our team will follow up with you soon.";
    }
  }

  return text;
}

/**
 * Rule 8: Clean closing
 * Ensure proper sign-off in CLOSING state
 */
function ensureCleanClosing(
  text: string,
  context: PersonalityRuleContext
): string {
  // Check if closing phrase exists
  const closingPhrases = [
    /\b(thank you for your time|thanks again|have a great day|appreciate your time)\b/i,
  ];

  const hasClosing = closingPhrases.some((phrase) => phrase.test(text));

  if (!hasClosing) {
    // Add clean closing
    const closings = [
      "That's everything on my side. Thanks again for your time and have a great day!",
      "Thank you for calling. Have a wonderful day!",
      "I appreciate your time. Take care!",
    ];
    const closing =
      closings[Math.floor(Math.random() * closings.length)];
    text += ` ${closing}`;
  }

  return text;
}

/**
 * Remove banned phrases
 */
function removeBannedPhrases(text: string): string {
  // Phrases that should never appear
  const bannedPhrases = [
    /\bas an AI\b/gi,
    /\bas an artificial intelligence\b/gi,
    /\bI'm just a robot\b/gi,
    /\bI'm just a bot\b/gi,
  ];

  let cleaned = text;
  bannedPhrases.forEach((phrase) => {
    cleaned = cleaned.replace(phrase, "I'm Aloha");
  });

  return cleaned;
}














