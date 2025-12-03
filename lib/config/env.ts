/**
 * Centralized Environment Configuration with Runtime Validation
 * 
 * This module provides type-safe access to environment variables with Zod validation.
 * All environment variables should be accessed through this module rather than
 * directly from process.env to ensure consistency and validation.
 * 
 * Usage:
 *   import { env } from '@/lib/config/env';
 *   const supabaseUrl = env.SUPABASE_URL;
 */

import { z } from "zod";

/**
 * Environment variable schema with validation rules
 */
const envSchema = z.object({
  // Database (Supabase)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("Invalid Supabase URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "Supabase anon key is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "Supabase service role key is required"),

  // Authentication & Security
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters").optional(),

  // Application URLs
  NEXT_PUBLIC_APP_URL: z.string().url("Invalid app URL").default("http://localhost:3000"),

  // Telephony (Twilio)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_API_KEY: z.string().optional(),
  TWILIO_API_SECRET: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),

  // Google OAuth (Unified - for Sync)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URL: z.string().url().optional(),

  // Google OAuth (Gmail - legacy, kept for backward compatibility)
  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REDIRECT_URI: z.string().url().optional(),

  // Google OAuth (Calendar - legacy, kept for backward compatibility)
  GOOGLE_CALENDAR_CLIENT_ID: z.string().optional(),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().url().optional(),

  // AI Services
  OPENAI_API_KEY: z.string().optional(),

  // Payment & Billing (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID_BASIC: z.string().optional(),
  STRIPE_PRICE_ID_ADVANCED: z.string().optional(),
  STRIPE_PRICE_ID_ELITE: z.string().optional(),

  // Analytics & Monitoring (Optional)
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  LOGTAIL_SOURCE_TOKEN: z.string().optional(),

  // Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Feature Flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: z.string().transform((val) => val === "true").optional(),
  NEXT_PUBLIC_ENABLE_ERROR_TRACKING: z.string().transform((val) => val === "true").optional(),
  DEMO_MODE: z.string().transform((val) => val === "true").optional(),
});

/**
 * Validated environment variables
 * Throws an error at module load time if validation fails
 */
function getEnv() {
  try {
    return envSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      AUTH_SECRET: process.env.AUTH_SECRET,
      JWT_SECRET: process.env.JWT_SECRET,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY: process.env.TWILIO_API_KEY,
      TWILIO_API_SECRET: process.env.TWILIO_API_SECRET,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_OAUTH_REDIRECT_URL: process.env.GOOGLE_OAUTH_REDIRECT_URL,
      GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
      GMAIL_REDIRECT_URI: process.env.GMAIL_REDIRECT_URI,
      GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      GOOGLE_CALENDAR_REDIRECT_URI: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      STRIPE_PRICE_ID_BASIC: process.env.STRIPE_PRICE_ID_BASIC,
      STRIPE_PRICE_ID_ADVANCED: process.env.STRIPE_PRICE_ID_ADVANCED,
      STRIPE_PRICE_ID_ELITE: process.env.STRIPE_PRICE_ID_ELITE,
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      SENTRY_DSN: process.env.SENTRY_DSN,
      SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      LOGTAIL_SOURCE_TOKEN: process.env.LOGTAIL_SOURCE_TOKEN,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
      NEXT_PUBLIC_ENABLE_ERROR_TRACKING: process.env.NEXT_PUBLIC_ENABLE_ERROR_TRACKING,
      DEMO_MODE: process.env.DEMO_MODE,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join("\n");
      throw new Error(
        `❌ Invalid environment variables:\n${missingVars}\n\n` +
        `Please check your .env.local file and ensure all required variables are set.`
      );
    }
    throw error;
  }
}

/**
 * Validated environment configuration
 * Access environment variables through this object
 */
export const env = getEnv();

/**
 * Type-safe environment configuration
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Helper functions for common environment checks
 */
export const isDevelopment = env.NODE_ENV === "development";
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

/**
 * Check if a service is configured
 */
export const isTwilioConfigured = !!(
  env.TWILIO_ACCOUNT_SID &&
  env.TWILIO_API_KEY &&
  env.TWILIO_API_SECRET
);

export const isGmailConfigured = !!(
  env.GMAIL_CLIENT_ID &&
  env.GMAIL_CLIENT_SECRET
);

export const isCalendarConfigured = !!(
  env.GOOGLE_CALENDAR_CLIENT_ID &&
  env.GOOGLE_CALENDAR_CLIENT_SECRET
);

export const isOpenAIConfigured = !!env.OPENAI_API_KEY;
export const isStripeConfigured = !!env.STRIPE_SECRET_KEY;

/**
 * Google OAuth configuration for Sync
 * Uses unified GOOGLE_* vars, falls back to legacy GMAIL_* vars for backward compatibility
 */
export const googleConfig = {
  clientId: env.GOOGLE_CLIENT_ID || env.GMAIL_CLIENT_ID || "",
  clientSecret: env.GOOGLE_CLIENT_SECRET || env.GMAIL_CLIENT_SECRET || "",
  redirectUrl: env.GOOGLE_OAUTH_REDIRECT_URL || env.GMAIL_REDIRECT_URI || "",
};

export const isGoogleConfigured = !!(
  googleConfig.clientId && googleConfig.clientSecret
);

