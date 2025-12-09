/**
 * Pricing configuration for OVRSEE
 * Maps plans and add-ons to Stripe Price IDs and amounts
 * 
 * This is the single source of truth for pricing structure.
 * Update this file when Stripe prices change.
 * 
 * YEARLY BILLING MODEL:
 * - Yearly prices = 11 × monthly price (1 month free)
 * - Monthly: Essentials $39.99, Professional $79.99, Executive $129.99
 * - Yearly: Essentials $439/year, Professional $879/year, Executive $1,429/year
 */

// Core consumer plans exposed in the UI
export type CorePlanCode = 'essentials' | 'professional' | 'executive';

// Plan codes matching the database enum (includes teams for future/enterprise use)
export type PlanCode = CorePlanCode | 'teams';
export type AddonCode = 'aloha_addon' | 'studio_addon';

export type BillingInterval = 'monthly' | 'yearly';

// Backwards-compatible alias used in some existing code
export type BillingCycle = BillingInterval;

export type PlanPricing = {
  label: string; // “Essentials”, “Professional”, “Executive”
  /**
   * Monthly price amount in cents (e.g. 39_99 = $39.99).
   * Keep UI formatting at 2 decimals.
   */
  monthlyAmount: number;
  /**
   * Yearly price amount in cents.
   * Should always be 11 × monthlyAmount (1 month free).
   */
  yearlyAmount: number;
  stripePriceIds: Record<BillingInterval, string>;
};

/**
 * Pricing configuration for plans
 * Includes both monthly and yearly pricing (yearly = 11 × monthly = 1 month free)
 * 
 * TRIAL POLICY:
 * - Essentials is the only plan with a 3-day free trial
 * - Professional and Executive have NO free trial (paid immediately)
 */
export const PRICING_CONFIG = {
  plans: {
    essentials: {
      label: 'Essentials',
      // Individual plan price IDs (Essentials)
      monthlyPriceId: process.env.STRIPE_PRICE_ID_ESSENTIALS_MONTHLY || '',
      yearlyPriceId: process.env.STRIPE_PRICE_ID_ESSENTIALS_YEARLY || '',
      monthlyAmount: 39_99, // $39.99 in cents
      yearlyAmount: 439_00, // $439.00 in cents (11 × $39.99 = 1 month free)
      currency: 'usd',
      hasTrial: true, // Essentials includes 3-day free trial
      trialDays: 3, // 3-day free trial
    },
    professional: {
      label: 'Professional',
      // Individual plan price IDs (Professional)
      monthlyPriceId: process.env.STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY || '',
      yearlyPriceId: process.env.STRIPE_PRICE_ID_PROFESSIONAL_YEARLY || '',
      monthlyAmount: 79_99, // $79.99 in cents
      yearlyAmount: 879_00, // $879.00 in cents (11 × $79.99 = 1 month free)
      currency: 'usd',
      hasTrial: false, // Professional has NO free trial
      trialDays: 0,
    },
    executive: {
      label: 'Executive',
      // Individual plan price IDs (Executive)
      monthlyPriceId: process.env.STRIPE_PRICE_ID_EXECUTIVE_MONTHLY || '',
      yearlyPriceId: process.env.STRIPE_PRICE_ID_EXECUTIVE_YEARLY || '',
      monthlyAmount: 129_99, // $129.99 in cents
      yearlyAmount: 1429_00, // $1,429.00 in cents (11 × $129.99 = 1 month free)
      currency: 'usd',
      hasTrial: false, // Executive has NO free trial
      trialDays: 0,
    },
  },
  addons: {
    aloha_addon: {
      label: 'Aloha Add-On',
      stripePriceId: process.env.STRIPE_PRICE_ID_ALOHA_ADDON || '',
      amount: 30_00, // $30.00 in cents
      currency: 'usd',
      allowedBasePlans: ['essentials'] as PlanCode[], // Only for Essentials
    },
    studio_addon: {
      label: 'Studio Add-On',
      stripePriceId: process.env.STRIPE_PRICE_ID_STUDIO_ADDON || '',
      amount: 20_00, // $20.00 in cents
      currency: 'usd',
      allowedBasePlans: ['essentials'] as PlanCode[], // Only for Essentials
    },
  },
} as const;

/**
 * Canonical plan pricing definition used by new codepaths (UI + Stripe).
 * This mirrors PRICING_CONFIG.plans but in a simpler shape.
 */
export const PLAN_PRICING: Record<CorePlanCode, PlanPricing> = {
  essentials: {
    label: PRICING_CONFIG.plans.essentials.label,
    monthlyAmount: PRICING_CONFIG.plans.essentials.monthlyAmount,
    yearlyAmount: PRICING_CONFIG.plans.essentials.yearlyAmount,
    stripePriceIds: {
      monthly: PRICING_CONFIG.plans.essentials.monthlyPriceId,
      yearly: PRICING_CONFIG.plans.essentials.yearlyPriceId,
    },
  },
  professional: {
    label: PRICING_CONFIG.plans.professional.label,
    monthlyAmount: PRICING_CONFIG.plans.professional.monthlyAmount,
    yearlyAmount: PRICING_CONFIG.plans.professional.yearlyAmount,
    stripePriceIds: {
      monthly: PRICING_CONFIG.plans.professional.monthlyPriceId,
      yearly: PRICING_CONFIG.plans.professional.yearlyPriceId,
    },
  },
  executive: {
    label: PRICING_CONFIG.plans.executive.label,
    monthlyAmount: PRICING_CONFIG.plans.executive.monthlyAmount,
    yearlyAmount: PRICING_CONFIG.plans.executive.yearlyAmount,
    stripePriceIds: {
      monthly: PRICING_CONFIG.plans.executive.monthlyPriceId,
      yearly: PRICING_CONFIG.plans.executive.yearlyPriceId,
    },
  },
};

/**
 * Reverse lookup from Stripe price ID → { planCode, billingInterval }.
 * This is used by webhooks to infer the plan + interval from subscription items.
 */
export const PRICE_ID_TO_PLAN_AND_INTERVAL: Record<
  string,
  { planCode: CorePlanCode; billingInterval: BillingInterval }
> = (() => {
  const mapping: Record<string, { planCode: CorePlanCode; billingInterval: BillingInterval }> = {};

  (Object.entries(PLAN_PRICING) as [CorePlanCode, PlanPricing][]).forEach(([planCode, config]) => {
    (['monthly', 'yearly'] as BillingInterval[]).forEach((interval) => {
      const priceId = config.stripePriceIds[interval];
      if (priceId) {
        mapping[priceId] = { planCode, billingInterval: interval };
      }
    });
  });

  return mapping;
})();

/**
 * Get plan configuration by plan code
 */
export function getPlanConfig(plan: PlanCode) {
  return PRICING_CONFIG.plans[plan as CorePlanCode];
}

/**
 * Get Stripe price ID for a plan based on billing interval
 */
export function getStripePriceId(plan: PlanCode, billingCycle: BillingCycle): string {
  const planConfig = PRICING_CONFIG.plans[plan as CorePlanCode];
  return billingCycle === 'yearly' ? planConfig.yearlyPriceId : planConfig.monthlyPriceId;
}

/**
 * Get price amount for a plan based on billing interval (in cents)
 */
export function getPlanAmount(plan: PlanCode, billingCycle: BillingCycle): number {
  const planConfig = PRICING_CONFIG.plans[plan as CorePlanCode];
  return billingCycle === 'yearly' ? planConfig.yearlyAmount : planConfig.monthlyAmount;
}

/**
 * Get addon configuration by addon code
 */
export function getAddonConfig(addon: AddonCode) {
  return PRICING_CONFIG.addons[addon];
}

/**
 * Check if an addon is allowed for a given plan
 */
export function isAddonAllowedForPlan(addon: AddonCode, plan: PlanCode): boolean {
  const addonConfig = PRICING_CONFIG.addons[addon];
  return addonConfig.allowedBasePlans.includes(plan);
}

/**
 * Get all addons allowed for a plan
 */
export function getAddonsForPlan(plan: PlanCode): AddonCode[] {
  return Object.keys(PRICING_CONFIG.addons).filter(
    (addon) => isAddonAllowedForPlan(addon as AddonCode, plan)
  ) as AddonCode[];
}

/**
 * Map old tier IDs to new plan codes (for backward compatibility)
 */
export function mapTierToPlanCode(tier: 'basic' | 'advanced' | 'elite'): PlanCode {
  switch (tier) {
    case 'basic':
      return 'essentials';
    case 'advanced':
      return 'professional';
    case 'elite':
      return 'executive';
    default:
      return 'essentials';
  }
}

/**
 * Map plan code to old tier ID (for backward compatibility)
 */
export function mapPlanCodeToTier(plan: PlanCode): 'basic' | 'advanced' | 'elite' | null {
  switch (plan) {
    case 'essentials':
      return 'basic';
    case 'professional':
      return 'advanced';
    case 'executive':
      return 'elite';
    case 'teams':
      return null; // Teams doesn't map to old tier system
    default:
      return null;
  }
}

