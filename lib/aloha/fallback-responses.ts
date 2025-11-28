/**
 * Aloha Fallback Response Snippet Library
 * 
 * Provides contextually appropriate fallback responses for various scenarios.
 * Responses are designed to be polite, professional, and consistent with
 * Aloha's voice and persona.
 */

import type {
  ScenarioCategory,
  AudioIssueType,
  CallerBehaviorType,
  EmotionalType,
  IdentityIssueType,
  BusinessLogicType,
  DetectedScenario,
} from "./scenario-detection";

export interface FallbackResponse {
  primary: string;
  alternatives: string[];
  tone: "calm" | "empathetic" | "professional" | "polite" | "neutral";
  shouldLogKnowledgeGap?: boolean;
  shouldOfferCallback?: boolean;
  shouldExit?: boolean;
}

/**
 * Audio & Technical Issue Responses
 */
const AUDIO_RESPONSES: Record<AudioIssueType, FallbackResponse> = {
  bad_connection: {
    primary:
      "I'm having trouble hearing you clearly. Could you speak a bit louder, or would you prefer if I call you back?",
    alternatives: [
      "The connection seems a bit unclear. Could you repeat that?",
      "I'm experiencing some connection issues. Would you like me to call you back?",
    ],
    tone: "polite",
    shouldOfferCallback: true,
  },
  static_robotic: {
    primary:
      "I'm hearing some static on the line. Could you try speaking a bit more clearly?",
    alternatives: [
      "There seems to be some interference. Could you repeat that?",
      "The audio quality isn't great. Would you prefer to continue or schedule a callback?",
    ],
    tone: "polite",
    shouldOfferCallback: true,
  },
  caller_cannot_hear: {
    primary:
      "Can you hear me okay? If not, let me know and I can adjust or call you back.",
    alternatives: [
      "Are you able to hear me clearly?",
      "If you're having trouble hearing me, I can call you back on a better line.",
    ],
    tone: "polite",
    shouldOfferCallback: true,
  },
  aloha_cannot_hear: {
    primary:
      "I'm having trouble understanding you. Could you repeat that a bit slower?",
    alternatives: [
      "I didn't catch that. Could you say that again?",
      "Could you speak a bit more clearly? I'm having trouble hearing you.",
    ],
    tone: "polite",
  },
  distorted_audio: {
    primary:
      "The audio seems a bit distorted. Could you try speaking more clearly?",
    alternatives: [
      "I'm having trouble understanding due to audio quality. Could you repeat that?",
      "The sound quality isn't great. Would you like to continue or schedule a callback?",
    ],
    tone: "polite",
    shouldOfferCallback: true,
  },
  background_noise: {
    primary:
      "I'm hearing some background noise. Could you find a quieter spot, or would you prefer to call back?",
    alternatives: [
      "There's quite a bit of background noise. Could you move to a quieter location?",
      "I'm having trouble hearing you over the background noise. Would you like to call back?",
    ],
    tone: "polite",
    shouldOfferCallback: true,
  },
  echo_feedback: {
    primary:
      "I'm hearing some echo on the line. Could you try moving to a different location?",
    alternatives: [
      "There seems to be some feedback. Could you adjust your phone or move to a different spot?",
    ],
    tone: "polite",
  },
  call_lag: {
    primary:
      "I'm experiencing some delay on the line. Let me wait a moment for your response.",
    alternatives: [
      "There seems to be some lag. Please take your time responding.",
    ],
    tone: "polite",
  },
  conference_call: {
    primary:
      "I can hear multiple voices. Could you have one person speak at a time so I can help you better?",
    alternatives: [
      "I'm hearing several people. Could one person take the lead on this call?",
    ],
    tone: "professional",
  },
  voicemail: {
    primary:
      "Hi, this is {displayName} from {businessName}. I'm calling to {purpose}. Please call us back at {phone} at your convenience, or I'll try calling again later. Thank you!",
    alternatives: [
      "Hello, this is {displayName} from {businessName}. I wanted to {purpose}. Please return my call at {phone} when you have a moment. Thank you!",
    ],
    tone: "professional",
    shouldExit: true,
  },
};

/**
 * Caller Behavior Responses
 */
const BEHAVIOR_RESPONSES: Record<CallerBehaviorType, FallbackResponse> = {
  interruption: {
    primary: "I'll let you finish. Go ahead.",
    alternatives: ["Please continue.", "I'm listening."],
    tone: "polite",
  },
  talking_over: {
    primary: "I'll wait for you to finish. Take your time.",
    alternatives: ["Please go ahead. I'm here to listen."],
    tone: "polite",
  },
  silence_pause: {
    primary:
      "Take your time. I'm here when you're ready to continue.",
    alternatives: [
      "No rush. I'll wait for your response.",
      "I'm still here. Take your time.",
    ],
    tone: "calm",
  },
  fast_talker: {
    primary:
      "I want to make sure I understand everything. Could you slow down just a bit?",
    alternatives: [
      "Could you speak a bit slower so I can catch all the details?",
    ],
    tone: "polite",
  },
  slow_talker: {
    primary: "Take your time. I'm here to listen.",
    alternatives: ["No rush. I'm listening."],
    tone: "calm",
  },
  topic_switch: {
    primary:
      "I understand. Let me make sure I have all the information. What else would you like to discuss?",
    alternatives: [
      "Got it. Is there anything else you'd like to cover?",
    ],
    tone: "polite",
  },
  thinks_human: {
    primary:
      "I'm actually an AI assistant, but I'm here to help you just the same. How can I assist you today?",
    alternatives: [
      "I'm an AI assistant helping {businessName}. How can I help you?",
    ],
    tone: "professional",
  },
  testing_ai: {
    primary:
      "Yes, I'm an AI assistant. I'm here to help you with {businessName}. How can I assist you today?",
    alternatives: [
      "I'm an AI assistant. Is there something specific I can help you with?",
    ],
    tone: "professional",
  },
  strong_accent: {
    primary:
      "I want to make sure I understand you correctly. Could you repeat that a bit slower?",
    alternatives: [
      "I'm having a bit of trouble understanding. Could you say that again?",
    ],
    tone: "polite",
  },
  unrelated_question: {
    primary:
      "I'm here to help with {businessName} matters. Could you tell me how I can assist you with that?",
    alternatives: [
      "I focus on helping with {businessName}. How can I help you with that?",
    ],
    tone: "polite",
  },
};

/**
 * Emotional/Social Scenario Responses
 */
const EMOTIONAL_RESPONSES: Record<EmotionalType, FallbackResponse> = {
  angry: {
    primary:
      "I understand you're frustrated, and I want to help. Let's work through this together. What can I do to assist you?",
    alternatives: [
      "I hear that you're upset, and I'm sorry for any inconvenience. How can I help resolve this?",
      "I understand this is frustrating. Let me see how I can help you.",
    ],
    tone: "empathetic",
  },
  rude: {
    primary:
      "I'm here to help you. Let's focus on how I can assist you today.",
    alternatives: [
      "I understand. How can I help you with what you need?",
    ],
    tone: "calm",
  },
  upset_frustrated: {
    primary:
      "I understand you're frustrated, and I'm sorry to hear that. Let me see how I can help resolve this for you.",
    alternatives: [
      "I hear your concern, and I want to help. What can I do to assist you?",
      "I'm sorry you're experiencing this. Let's work together to find a solution.",
    ],
    tone: "empathetic",
  },
  crying: {
    primary:
      "I can hear that you're upset. I'm here to help. Take your time, and let me know how I can assist you.",
    alternatives: [
      "I understand this is difficult. I'm here to help when you're ready.",
    ],
    tone: "empathetic",
  },
  emergency: {
    primary:
      "I understand this is an emergency. For immediate assistance, please hang up and dial 911. If this is a medical emergency, call emergency services right away. I cannot provide emergency services.",
    alternatives: [
      "This sounds like an emergency. Please hang up and call 911 immediately for help.",
    ],
    tone: "calm",
    shouldExit: true,
  },
  grief_loss: {
    primary:
      "I'm so sorry for your loss. I understand this is a difficult time. How can I help you today?",
    alternatives: [
      "I'm sorry to hear that. I'm here to help in any way I can.",
    ],
    tone: "empathetic",
  },
};

/**
 * Identity Issue Responses
 */
const IDENTITY_RESPONSES: Record<IdentityIssueType, FallbackResponse> = {
  not_intended_customer: {
    primary:
      "I apologize for the confusion. It seems I may have reached the wrong person. Thank you for your time, and have a great day.",
    alternatives: [
      "I'm sorry, it looks like I may have the wrong number. Thank you for your time.",
    ],
    tone: "polite",
    shouldExit: true,
  },
  refuses_identity: {
    primary:
      "I understand. I'm here to help with general information about {businessName}. How can I assist you?",
    alternatives: [
      "No problem. How can I help you with {businessName} today?",
    ],
    tone: "polite",
  },
  pretending_identity: {
    primary:
      "I need to verify some information to help you. Could you provide your name or account information?",
    alternatives: [
      "For security purposes, I'll need to verify some details. Can you help me with that?",
    ],
    tone: "professional",
  },
  child: {
    primary:
      "I'd like to speak with a parent or guardian. Could you have an adult come to the phone?",
    alternatives: [
      "Is there a parent or guardian available I could speak with?",
    ],
    tone: "polite",
    shouldExit: true,
  },
};

/**
 * Business Logic Responses
 */
const BUSINESS_LOGIC_RESPONSES: Record<BusinessLogicType, FallbackResponse> = {
  unavailable_service: {
    primary:
      "I'm sorry, but that service isn't currently available. I can help you with our available services, or I can have someone follow up with you about this.",
    alternatives: [
      "Unfortunately, that service isn't available right now. Would you like information about our other services?",
    ],
    tone: "polite",
    shouldLogKnowledgeGap: true,
  },
  outside_hours: {
    primary:
      "I understand you're calling outside our business hours. Our hours are {hours}. Would you like me to have someone call you back during business hours?",
    alternatives: [
      "We're currently outside business hours. I can arrange for someone to call you back when we're open.",
    ],
    tone: "polite",
    shouldOfferCallback: true,
  },
  conflicting_info: {
    primary:
      "I want to make sure I have the correct information. Let me have someone follow up with you to clarify this.",
    alternatives: [
      "I need to verify this information. I'll have someone get back to you with the correct details.",
    ],
    tone: "professional",
    shouldLogKnowledgeGap: true,
  },
  unsubscribe_dnc: {
    primary:
      "I understand. I'll make sure you're removed from our calling list. You won't receive any more calls from us. Is there anything else I can help you with today?",
    alternatives: [
      "Absolutely. I'll remove you from our calling list immediately. Thank you for letting me know.",
    ],
    tone: "polite",
    shouldExit: true,
  },
  legal_concern: {
    primary:
      "I understand you have legal concerns. I'm not able to provide legal advice. I'd recommend speaking with a legal professional. Is there anything else I can help you with regarding {businessName}?",
    alternatives: [
      "For legal matters, I'd suggest consulting with an attorney. I'm here to help with general {businessName} questions.",
    ],
    tone: "professional",
  },
  pricing_unavailable: {
    primary:
      "I don't have that pricing information available right now. I'll make sure someone follows up with you about this.",
    alternatives: [
      "I'm sorry, I don't have those pricing details. I'll have someone get back to you with that information.",
    ],
    tone: "polite",
    shouldLogKnowledgeGap: true,
  },
};

/**
 * Get fallback response for a detected scenario
 */
export function getFallbackResponse(
  scenario: DetectedScenario,
  context?: {
    displayName?: string;
    businessName?: string;
    phone?: string;
    purpose?: string;
    hours?: string;
  }
): FallbackResponse {
  const { category, type } = scenario;

  let response: FallbackResponse | undefined;

  switch (category) {
    case "audio_technical":
      if (type && type in AUDIO_RESPONSES) {
        response = AUDIO_RESPONSES[type as AudioIssueType];
      }
      break;
    case "caller_behavior":
      if (type && type in BEHAVIOR_RESPONSES) {
        response = BEHAVIOR_RESPONSES[type as CallerBehaviorType];
      }
      break;
    case "emotional_social":
      if (type && type in EMOTIONAL_RESPONSES) {
        response = EMOTIONAL_RESPONSES[type as EmotionalType];
      }
      break;
    case "identity_issues":
      if (type && type in IDENTITY_RESPONSES) {
        response = IDENTITY_RESPONSES[type as IdentityIssueType];
      }
      break;
    case "business_logic":
      if (type && type in BUSINESS_LOGIC_RESPONSES) {
        response = BUSINESS_LOGIC_RESPONSES[type as BusinessLogicType];
      }
      break;
    case "normal":
      // No fallback needed for normal scenarios
      return {
        primary: "",
        alternatives: [],
        tone: "neutral",
      };
  }

  if (!response) {
    // Default fallback
    return {
      primary:
        "I'm here to help. Could you tell me more about what you need?",
      alternatives: ["How can I assist you today?"],
      tone: "polite",
    };
  }

  // Replace placeholders in response
  const replacePlaceholders = (text: string): string => {
    return text
      .replace(/{displayName}/g, context?.displayName || "Aloha")
      .replace(/{businessName}/g, context?.businessName || "our business")
      .replace(/{phone}/g, context?.phone || "our main number")
      .replace(/{purpose}/g, context?.purpose || "assist you")
      .replace(/{hours}/g, context?.hours || "our regular business hours");
  };

  return {
    ...response,
    primary: replacePlaceholders(response.primary),
    alternatives: response.alternatives.map(replacePlaceholders),
  };
}

/**
 * Get a random alternative response (for variety)
 */
export function getRandomFallbackResponse(
  scenario: DetectedScenario,
  context?: {
    displayName?: string;
    businessName?: string;
    phone?: string;
    purpose?: string;
    hours?: string;
  }
): string {
  const response = getFallbackResponse(scenario, context);
  const allResponses = [response.primary, ...response.alternatives].filter(
    (r) => r.length > 0
  );
  if (allResponses.length === 0) return "";
  return allResponses[Math.floor(Math.random() * allResponses.length)];
}








