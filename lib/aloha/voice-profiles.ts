/**
 * Aloha Voice Profiles System
 * 
 * Defines 4 distinct voice profiles for Aloha. Each profile represents:
 * - A unique OpenAI voice name/model
 * - A tone preset key (friendly/professional/empathetic/energetic)
 * - A label & description for the UI
 * 
 * Aloha's personality and behavior stay the same; only the voice changes.
 */

import type { TonePresetKey } from "./tone-presets";

export type AlohaVoiceKey =
  | "aloha_voice_friendly_female_us"
  | "aloha_voice_professional_male_us"
  | "aloha_voice_energetic_female_uk"
  | "aloha_voice_empathetic_male_neutral";

export interface AlohaVoiceProfile {
  key: AlohaVoiceKey;
  label: string; // What the user sees on the button
  description: string; // Short description
  openaiVoiceId: string; // Which OpenAI voice we use in TTS/Realtime
  tonePreset: TonePresetKey;
  gender: "female" | "male";
  accent: string; // e.g., "US", "UK", "Neutral"
}

/**
 * Aloha Voice Profiles
 * 
 * These are the 4 voice options users can choose from.
 * Each maps to an OpenAI TTS voice and a tone preset.
 */
export const ALOHA_VOICE_PROFILES: AlohaVoiceProfile[] = [
  {
    key: "aloha_voice_friendly_female_us",
    label: "Friendly (Female, US)",
    description: "Warm and approachable, ideal for feedback and general calls.",
    openaiVoiceId: "nova", // OpenAI TTS voice: nova (female, warm, US accent)
    tonePreset: "friendly",
    gender: "female",
    accent: "US",
  },
  {
    key: "aloha_voice_professional_male_us",
    label: "Professional (Male, US)",
    description: "Clear and confident, great for confirmations and updates.",
    openaiVoiceId: "onyx", // OpenAI TTS voice: onyx (male, professional, US accent)
    tonePreset: "professional",
    gender: "male",
    accent: "US",
  },
  {
    key: "aloha_voice_energetic_female_uk",
    label: "Energetic (Female, US)",
    description: "Lively and upbeat, perfect for sales or promotions.",
    openaiVoiceId: "nova", // OpenAI TTS voice: nova (female, energetic, US accent)
    tonePreset: "energetic",
    gender: "female",
    accent: "US",
  },
  {
    key: "aloha_voice_empathetic_male_neutral",
    label: "Empathetic (Male, Neutral)",
    description: "Calm and reassuring, ideal for sensitive or support calls.",
    openaiVoiceId: "echo", // OpenAI TTS voice: echo (male, calm, neutral accent)
    tonePreset: "empathetic",
    gender: "male",
    accent: "Neutral",
  },
];

/**
 * Default voice profile (used when user hasn't selected one)
 */
export const DEFAULT_VOICE_KEY: AlohaVoiceKey = "aloha_voice_friendly_female_us";

const VOICE_PREVIEW_TEMPLATES: Record<AlohaVoiceKey, (name: string) => string> = {
  aloha_voice_friendly_female_us: (name) =>
    `Hi there! I'm ${name}. I'm here to help and make every call feel friendly and easy.`,
  aloha_voice_professional_male_us: (name) =>
    `Hello, this is ${name}. You can count on me for clear communication and reliable updates.`,
  aloha_voice_energetic_female_uk: (name) =>
    `Hey! I'm ${name}. Let's jump in and make things happen with energy and momentum!`,
  aloha_voice_empathetic_male_neutral: (name) =>
    `Hi, I'm ${name}. I'm here to listen, support you, and make every call feel understood.`,
};

/**
 * Get voice profile by key
 */
export function getVoiceProfileByKey(
  key: AlohaVoiceKey | string | null | undefined
): AlohaVoiceProfile {
  if (!key) {
    return getVoiceProfileByKey(DEFAULT_VOICE_KEY);
  }

  const profile = ALOHA_VOICE_PROFILES.find((p) => p.key === key);
  if (!profile) {
    console.warn(`Invalid voice key: ${key}, using default`);
    return getVoiceProfileByKey(DEFAULT_VOICE_KEY);
  }

  return profile;
}

/**
 * Get all voice profiles
 */
export function getAllVoiceProfiles(): AlohaVoiceProfile[] {
  return ALOHA_VOICE_PROFILES;
}

/**
 * Validate voice key
 */
export function isValidVoiceKey(key: string): key is AlohaVoiceKey {
  return ALOHA_VOICE_PROFILES.some((p) => p.key === key);
}

export function getVoicePreviewScript(
  voiceKey: AlohaVoiceKey,
  displayName: string
): string {
  const sanitizedName = displayName.trim() || "Aloha";
  const template =
    VOICE_PREVIEW_TEMPLATES[voiceKey] ||
    VOICE_PREVIEW_TEMPLATES[DEFAULT_VOICE_KEY];
  return template(sanitizedName);
}

/**
 * Get the translation key for a voice preview text
 */
export function getVoicePreviewTranslationKey(voiceKey: AlohaVoiceKey): string {
  const mapping: Record<AlohaVoiceKey, string> = {
    aloha_voice_friendly_female_us: "voicePreviewFriendly",
    aloha_voice_professional_male_us: "voicePreviewProfessional",
    aloha_voice_energetic_female_uk: "voicePreviewEnergetic",
    aloha_voice_empathetic_male_neutral: "voicePreviewEmpathetic",
  };
  return mapping[voiceKey] || mapping[DEFAULT_VOICE_KEY];
}

const VOICE_PREVIEW_ASSETS: Record<AlohaVoiceKey, string> = {
  aloha_voice_friendly_female_us: "friendly-us.mp3",
  aloha_voice_professional_male_us: "professional-us.mp3",
  aloha_voice_energetic_female_uk: "energetic-uk.mp3",
  aloha_voice_empathetic_male_neutral: "empathetic-neutral.mp3",
};

/**
 * Local fallback asset for preview playback
 */
export function getVoicePreviewAssetPath(voiceKey: AlohaVoiceKey): string {
  const fileName = VOICE_PREVIEW_ASSETS[voiceKey] || VOICE_PREVIEW_ASSETS[DEFAULT_VOICE_KEY];
  return `/previews/${fileName}`;
}


