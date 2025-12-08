/**
 * Billing configuration for OVRSEE
 * 
 * This file defines the plan structure and Stripe price IDs.
 * Update the price IDs with actual Stripe price IDs from your Stripe dashboard.
 * 
 * TRIAL POLICY:
 * - Essentials is the only plan with a 3-day free trial
 * - Professional and Executive have NO free trial (paid immediately)
 */

export type PlanCode = "essentials" | "professional" | "executive";

type PlanConfig = {
  code: PlanCode;
  label: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
  hasTrial: boolean; // only true for essentials
};

export const PLANS: Record<PlanCode, PlanConfig> = {
  essentials: {
    code: "essentials",
    label: "Essentials",
    monthlyPriceId: process.env.STRIPE_PRICE_ID_ESSENTIALS || process.env.STRIPE_PRICE_ID_BASIC || "price_ESSENTIALS_MONTHLY", // TODO: replace with actual Stripe price ID
    yearlyPriceId: process.env.STRIPE_PRICE_ID_ESSENTIALS_YEARLY || "price_ESSENTIALS_YEARLY", // TODO: replace with actual Stripe price ID
    hasTrial: true,
  },
  professional: {
    code: "professional",
    label: "Professional",
    monthlyPriceId: process.env.STRIPE_PRICE_ID_PROFESSIONAL || process.env.STRIPE_PRICE_ID_ADVANCED || "price_PROFESSIONAL_MONTHLY", // TODO: replace with actual Stripe price ID
    yearlyPriceId: process.env.STRIPE_PRICE_ID_PROFESSIONAL_YEARLY || "price_PROFESSIONAL_YEARLY", // TODO: replace with actual Stripe price ID
    hasTrial: false,
  },
  executive: {
    code: "executive",
    label: "Executive",
    monthlyPriceId: process.env.STRIPE_PRICE_ID_EXECUTIVE || process.env.STRIPE_PRICE_ID_ELITE || "price_EXECUTIVE_MONTHLY", // TODO: replace with actual Stripe price ID
    yearlyPriceId: process.env.STRIPE_PRICE_ID_EXECUTIVE_YEARLY || "price_EXECUTIVE_YEARLY", // TODO: replace with actual Stripe price ID
    hasTrial: false,
  },
};



