/**
 * Aloha Tone Preset System
 * 
 * Defines voice style presets that modify HOW Aloha speaks,
 * not WHAT it says. Applied after content generation but before TTS.
 */

export type TonePresetKey = "friendly" | "professional" | "empathetic" | "energetic";

export type SpeakingRate = "slow" | "medium" | "fast";
export type Pitch = "low" | "normal" | "high";
export type DisfluencyFrequency = "low" | "medium" | "high";

export interface TonePreset {
  key: TonePresetKey;
  label: string;
  description: string;

  // TTS settings
  speakingRate: SpeakingRate;
  pitch: Pitch;

  // Conversational style
  allowDisfluencies: boolean;
  disfluencyFrequency: DisfluencyFrequency;
  fillerWords: string[];
  confirmPhrases: string[];
  softeners: string[];

  // Response adjustments
  preferShortSentences: boolean;
  maxSentenceLength: number;
  useContractions: boolean;
}

/**
 * Tone Preset Definitions
 */
export const TONE_PRESETS: Record<TonePresetKey, TonePreset> = {
  friendly: {
    key: "friendly",
    label: "Friendly",
    description: "Warm, approachable, conversational tone",
    speakingRate: "medium",
    pitch: "normal",
    allowDisfluencies: true,
    disfluencyFrequency: "low",
    fillerWords: ["um", "uh", "well", "you know"],
    confirmPhrases: [
      "yeah, that makes sense",
      "gotcha",
      "sure thing",
      "absolutely",
      "of course",
    ],
    softeners: [
      "no worries at all",
      "happy to help",
      "not a problem",
      "my pleasure",
    ],
    preferShortSentences: true,
    maxSentenceLength: 20,
    useContractions: true,
  },

  professional: {
    key: "professional",
    label: "Professional",
    description: "Formal, polished, business-appropriate tone",
    speakingRate: "medium",
    pitch: "low",
    allowDisfluencies: false,
    disfluencyFrequency: "low",
    fillerWords: [],
    confirmPhrases: [
      "understood",
      "that's clear",
      "I understand",
      "certainly",
      "very well",
    ],
    softeners: [
      "I appreciate your patience",
      "thank you for your understanding",
      "I understand your concern",
    ],
    preferShortSentences: false,
    maxSentenceLength: 25,
    useContractions: false,
  },

  empathetic: {
    key: "empathetic",
    label: "Empathetic",
    description: "Gentle, understanding, supportive tone",
    speakingRate: "slow",
    pitch: "normal",
    allowDisfluencies: true,
    disfluencyFrequency: "medium",
    fillerWords: ["um", "well", "I see"],
    confirmPhrases: [
      "I'm really sorry you're dealing with this",
      "I hear you",
      "I understand",
      "that sounds really tough",
      "I can imagine how that feels",
    ],
    softeners: [
      "that sounds really difficult",
      "thank you for telling me",
      "I'm here to help",
      "take your time",
    ],
    preferShortSentences: true,
    maxSentenceLength: 18,
    useContractions: true,
  },

  energetic: {
    key: "energetic",
    label: "Energetic",
    description: "Upbeat, enthusiastic, positive tone",
    speakingRate: "fast",
    pitch: "high",
    allowDisfluencies: true,
    disfluencyFrequency: "low",
    fillerWords: ["um", "so", "like"],
    confirmPhrases: [
      "awesome",
      "perfect",
      "sounds great",
      "excellent",
      "fantastic",
    ],
    softeners: [
      "no problem at all",
      "happy to help out",
      "glad to assist",
      "my pleasure",
    ],
    preferShortSentences: true,
    maxSentenceLength: 22,
    useContractions: true,
  },
};

/**
 * Get tone preset by key
 */
export function getTonePreset(key: TonePresetKey): TonePreset {
  return TONE_PRESETS[key];
}

/**
 * Get default tone preset
 */
export function getDefaultTonePreset(): TonePreset {
  return TONE_PRESETS.friendly;
}

/**
 * Apply tone preset to response text
 */
export function applyTonePreset(
  text: string,
  preset: TonePreset,
  context?: {
    isFirstResponse?: boolean;
    isClarification?: boolean;
    isClosing?: boolean;
  }
): string {
  let enhanced = text;

  // Add softeners at the beginning if appropriate
  if (preset.softeners.length > 0 && !context?.isClosing) {
    // 30% chance to add a softener at the start
    if (Math.random() < 0.3) {
      const softener =
        preset.softeners[Math.floor(Math.random() * preset.softeners.length)];
      enhanced = `${softener}. ${enhanced}`;
    }
  }

  // Add confirmations after statements (if appropriate)
  if (preset.confirmPhrases.length > 0 && !context?.isClosing) {
    // Check if response contains statements that could use confirmation
    const hasStatement = /[.!?]\s+[A-Z]/.test(enhanced);
    if (hasStatement && Math.random() < 0.2) {
      const confirm =
        preset.confirmPhrases[
          Math.floor(Math.random() * preset.confirmPhrases.length)
        ];
      // Add confirmation after first sentence
      enhanced = enhanced.replace(
        /([.!?])\s+([A-Z])/,
        `$1 ${confirm}. $2`
      );
    }
  }

  // Add filler words if allowed and frequency permits
  if (
    preset.allowDisfluencies &&
    preset.fillerWords.length > 0 &&
    !context?.isClosing
  ) {
    const frequency =
      preset.disfluencyFrequency === "high"
        ? 0.3
        : preset.disfluencyFrequency === "medium"
        ? 0.15
        : 0.05;

    if (Math.random() < frequency) {
      const filler =
        preset.fillerWords[
          Math.floor(Math.random() * preset.fillerWords.length)
        ];
      // Add filler at the beginning or after first sentence
      if (Math.random() < 0.5) {
        enhanced = `${filler}, ${enhanced}`;
      } else {
        enhanced = enhanced.replace(
          /([.!?])\s+([A-Z])/,
          `$1 ${filler}, $2`
        );
      }
    }
  }

  // Adjust sentence length
  if (preset.preferShortSentences) {
    enhanced = shortenSentences(enhanced, preset.maxSentenceLength);
  }

  // Apply contractions if needed
  if (preset.useContractions) {
    enhanced = applyContractions(enhanced);
  } else {
    enhanced = removeContractions(enhanced);
  }

  return enhanced.trim();
}

/**
 * Shorten sentences to preferred length
 */
function shortenSentences(text: string, maxLength: number): string {
  const sentences = text.split(/([.!?]+)/);
  const shortened: string[] = [];

  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i].trim();
    const punctuation = sentences[i + 1] || "";

    if (sentence.length > maxLength) {
      // Try to split on commas or conjunctions
      const parts = sentence.split(/[,;]\s+/);
      if (parts.length > 1) {
        shortened.push(parts[0] + punctuation);
        for (let j = 1; j < parts.length; j++) {
          shortened.push(parts[j] + punctuation);
        }
      } else {
        // Just truncate if can't split nicely
        shortened.push(
          sentence.substring(0, maxLength - 3) + "..." + punctuation
        );
      }
    } else {
      shortened.push(sentence + punctuation);
    }
  }

  return shortened.join(" ").trim();
}

/**
 * Apply contractions to text
 */
function applyContractions(text: string): string {
  return text
    .replace(/\bI am\b/gi, "I'm")
    .replace(/\byou are\b/gi, "you're")
    .replace(/\bwe are\b/gi, "we're")
    .replace(/\bthey are\b/gi, "they're")
    .replace(/\bit is\b/gi, "it's")
    .replace(/\bthat is\b/gi, "that's")
    .replace(/\bwhat is\b/gi, "what's")
    .replace(/\bwhere is\b/gi, "where's")
    .replace(/\bwho is\b/gi, "who's")
    .replace(/\bhow is\b/gi, "how's")
    .replace(/\bI will\b/gi, "I'll")
    .replace(/\byou will\b/gi, "you'll")
    .replace(/\bwe will\b/gi, "we'll")
    .replace(/\bthey will\b/gi, "they'll")
    .replace(/\bit will\b/gi, "it'll")
    .replace(/\bthat will\b/gi, "that'll")
    .replace(/\bI have\b/gi, "I've")
    .replace(/\byou have\b/gi, "you've")
    .replace(/\bwe have\b/gi, "we've")
    .replace(/\bthey have\b/gi, "they've")
    .replace(/\bI would\b/gi, "I'd")
    .replace(/\byou would\b/gi, "you'd")
    .replace(/\bdo not\b/gi, "don't")
    .replace(/\bdoes not\b/gi, "doesn't")
    .replace(/\bdid not\b/gi, "didn't")
    .replace(/\bcan not\b/gi, "can't")
    .replace(/\bcannot\b/gi, "can't")
    .replace(/\bcould not\b/gi, "couldn't")
    .replace(/\bshould not\b/gi, "shouldn't")
    .replace(/\bwould not\b/gi, "wouldn't")
    .replace(/\bwill not\b/gi, "won't");
}

/**
 * Remove contractions from text
 */
function removeContractions(text: string): string {
  return text
    .replace(/\bI'm\b/gi, "I am")
    .replace(/\byou're\b/gi, "you are")
    .replace(/\bwe're\b/gi, "we are")
    .replace(/\bthey're\b/gi, "they are")
    .replace(/\bit's\b/gi, "it is")
    .replace(/\bthat's\b/gi, "that is")
    .replace(/\bwhat's\b/gi, "what is")
    .replace(/\bwhere's\b/gi, "where is")
    .replace(/\bwho's\b/gi, "who is")
    .replace(/\bhow's\b/gi, "how is")
    .replace(/\bI'll\b/gi, "I will")
    .replace(/\byou'll\b/gi, "you will")
    .replace(/\bwe'll\b/gi, "we will")
    .replace(/\bthey'll\b/gi, "they will")
    .replace(/\bit'll\b/gi, "it will")
    .replace(/\bthat'll\b/gi, "that will")
    .replace(/\bI've\b/gi, "I have")
    .replace(/\byou've\b/gi, "you have")
    .replace(/\bwe've\b/gi, "we have")
    .replace(/\bthey've\b/gi, "they have")
    .replace(/\bI'd\b/gi, "I would")
    .replace(/\byou'd\b/gi, "you would")
    .replace(/\bdon't\b/gi, "do not")
    .replace(/\bdoesn't\b/gi, "does not")
    .replace(/\bdidn't\b/gi, "did not")
    .replace(/\bcan't\b/gi, "cannot")
    .replace(/\bcouldn't\b/gi, "could not")
    .replace(/\bshouldn't\b/gi, "should not")
    .replace(/\bwouldn't\b/gi, "would not")
    .replace(/\bwon't\b/gi, "will not");
}

/**
 * Get TTS settings from tone preset
 */
export function getTTSSettingsFromPreset(preset: TonePreset): {
  rate?: number;
  pitch?: number;
} {
  // Map speaking rate to TTS rate (0.5 to 2.0, where 1.0 is normal)
  const rateMap: Record<SpeakingRate, number> = {
    slow: 0.85,
    medium: 1.0,
    fast: 1.25,
  };

  // Map pitch to TTS pitch (-20 to +20 semitones, where 0 is normal)
  const pitchMap: Record<Pitch, number> = {
    low: -2,
    normal: 0,
    high: +2,
  };

  return {
    rate: rateMap[preset.speakingRate],
    pitch: pitchMap[preset.pitch],
  };
}













