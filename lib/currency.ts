// Currency conversion utility
// Base currency is USD, converts to local currency based on language

export type LanguageCode = "en" | "es" | "fr" | "de" | "it" | "pt" | "nl" | "ja" | "zh" | "ko";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  exchangeRate: number; // Rate from USD
}

// Currency mapping by language
const currencyByLanguage: Record<LanguageCode, CurrencyInfo> = {
  en: { code: "USD", symbol: "$", exchangeRate: 1.0 }, // US English
  es: { code: "EUR", symbol: "€", exchangeRate: 0.92 }, // Spanish -> Euro (Spain)
  fr: { code: "EUR", symbol: "€", exchangeRate: 0.92 }, // French -> Euro (France)
  de: { code: "EUR", symbol: "€", exchangeRate: 0.92 }, // German -> Euro (Germany)
  it: { code: "EUR", symbol: "€", exchangeRate: 0.92 }, // Italian -> Euro (Italy)
  pt: { code: "EUR", symbol: "€", exchangeRate: 0.92 }, // Portuguese -> Euro (Portugal)
  nl: { code: "EUR", symbol: "€", exchangeRate: 0.92 }, // Dutch -> Euro (Netherlands)
  ja: { code: "JPY", symbol: "¥", exchangeRate: 150.0 }, // Japanese -> Yen
  zh: { code: "CNY", symbol: "¥", exchangeRate: 7.2 }, // Chinese -> Yuan
  ko: { code: "KRW", symbol: "₩", exchangeRate: 1300.0 }, // Korean -> Won
};

// Base prices in USD
export const BASE_PRICES = {
  basic: 29.99,
  advanced: 79.99,
  elite: 129.99,
};

/**
 * Get currency info for a given language
 */
export function getCurrencyInfo(language: LanguageCode): CurrencyInfo {
  return currencyByLanguage[language] || currencyByLanguage.en;
}

/**
 * Convert USD price to local currency based on language
 */
export function convertPrice(usdPrice: number, language: LanguageCode): number {
  const currency = getCurrencyInfo(language);
  return usdPrice * currency.exchangeRate;
}

/**
 * Format price with currency symbol
 */
export function formatPrice(usdPrice: number, language: LanguageCode): string {
  const currency = getCurrencyInfo(language);
  const localPrice = convertPrice(usdPrice, language);
  
  // For currencies with large exchange rates (JPY, KRW), don't show decimals
  if (currency.exchangeRate >= 100) {
    return `${currency.symbol}${Math.round(localPrice).toLocaleString()}`;
  }
  
  // For other currencies, show 2 decimal places
  return `${currency.symbol}${localPrice.toFixed(2)}`;
}

/**
 * Format money amount (for savings, etc.) with currency symbol
 */
export function formatMoney(amount: number, language: LanguageCode): string {
  const currency = getCurrencyInfo(language);
  const localAmount = amount * currency.exchangeRate;
  
  // For currencies with large exchange rates (JPY, KRW), don't show decimals
  if (currency.exchangeRate >= 100) {
    return `${currency.symbol}${Math.round(localAmount).toLocaleString()}`;
  }
  
  // For other currencies, show 2 decimal places
  return `${currency.symbol}${localAmount.toFixed(2)}`;
}












