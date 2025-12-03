/**
 * Localization utilities for converting locale codes to language names
 * for use in LLM prompts and agent outputs.
 */

export type LanguageCode = "en" | "es" | "fr" | "de" | "it" | "pt" | "nl" | "ja" | "zh" | "ko";

/**
 * Maps locale codes to human-readable language names suitable for LLM prompts.
 * Normalizes locale codes (e.g., "en-US" -> "en", "es-ES" -> "es") and returns
 * the language name in English.
 * 
 * @param locale - A locale code (e.g., "en", "en-US", "es", "es-ES", "fr")
 * @returns A human-readable language name (e.g., "English", "Spanish", "French")
 */
export function getLanguageFromLocale(locale: string | undefined | null): string {
  if (!locale) {
    return "English";
  }

  // Normalize locale code: extract base language code (e.g., "en-US" -> "en")
  const baseCode = locale.toLowerCase().split("-")[0] as LanguageCode;

  const languageMap: Record<LanguageCode, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    nl: "Dutch",
    ja: "Japanese",
    zh: "Chinese",
    ko: "Korean",
  };

  return languageMap[baseCode] || "English";
}

/**
 * Gets the current user's language code from the locale.
 * Normalizes locale codes and returns the base language code.
 * 
 * @param locale - A locale code (e.g., "en", "en-US", "es", "es-ES")
 * @returns A normalized language code (e.g., "en", "es", "fr")
 */
export function normalizeLocale(locale: string | undefined | null): LanguageCode {
  if (!locale) {
    return "en";
  }

  const baseCode = locale.toLowerCase().split("-")[0] as LanguageCode;
  const supportedCodes: LanguageCode[] = ["en", "es", "fr", "de", "it", "pt", "nl", "ja", "zh", "ko"];
  
  return supportedCodes.includes(baseCode) ? baseCode : "en";
}






