// Centralized pricing configuration and calculation logic
// Used by both frontend UI and backend APIs

export type TierId = 'basic' | 'advanced' | 'elite';

export interface SeatSelection {
  tier: TierId;
  count: number;
}

export interface PricingBreakdown {
  totalSeats: number;
  perTier: {
    [tier in TierId]: {
      count: number;
      unitPrice: number;
      subtotal: number;
    };
  };
  discountPercent: number;
  listSubtotal: number;
  discountAmount: number;
  finalTotal: number;
}

// Base tier configuration - prices in USD per month
// Updated pricing model:
// - Essentials ($39.99): Includes Sync (email + calendar), standard support
// - Professional ($79.99): Includes Essentials + Aloha (AI receptionist) + Studio (AI media creation), priority support
// - Executive ($129.99): Includes Professional + Insight (business intelligence), all features unlocked, weekly reports + analytics
export const TIERS = {
  basic: {
    id: 'basic' as TierId,
    name: 'Essentials', // Display name updated to match new pricing model
    priceMonthly: 39.99,
    agents: 1, // 1 agent total (Sync)
  },
  advanced: {
    id: 'advanced' as TierId,
    name: 'Professional', // Display name updated to match new pricing model
    priceMonthly: 79.99, // Updated price: was 99.99
    agents: 3, // 3 agents total (Sync + Aloha + Studio)
  },
  elite: {
    id: 'elite' as TierId,
    name: 'Executive', // Display name updated to match new pricing model
    priceMonthly: 129.99, // Updated price: was 159.99
    agents: 4, // 4 agents total (Sync + Aloha + Studio + Insight)
  },
} as const;

/**
 * Get team discount percentage based on total number of seats
 * 
 * Discount rules:
 * - 1-4 seats: 0% discount
 * - 5-9 seats: 10% discount
 * - 10-19 seats: 20% discount
 * - 20+ seats: 25% discount
 */
export function getTeamDiscountPercent(totalSeats: number): number {
  if (totalSeats >= 20) return 0.25;
  if (totalSeats >= 10) return 0.20;
  if (totalSeats >= 5) return 0.10;
  return 0;
}

/**
 * Calculate team pricing breakdown
 *
 * @param seats Array of seat selections with tier and count
 * @param billingInterval Billing interval for team pricing (currently only monthly is implemented)
 * @returns Complete pricing breakdown including discounts
 */
export function calculateTeamPricing(
  seats: SeatSelection[],
  billingInterval: 'monthly' | 'yearly' = 'monthly'
): PricingBreakdown {
  // Initialize per-tier tracking
  const perTier: PricingBreakdown['perTier'] = {
    // TODO: when enabling yearly team billing, switch unitPrice to a yearly per-seat
    // amount (11 × monthly) when billingInterval === "yearly". For now we always
    // use monthly pricing so behavior matches existing production.
    basic: { count: 0, unitPrice: TIERS.basic.priceMonthly, subtotal: 0 },
    advanced: { count: 0, unitPrice: TIERS.advanced.priceMonthly, subtotal: 0 },
    elite: { count: 0, unitPrice: TIERS.elite.priceMonthly, subtotal: 0 },
  };

  // Aggregate seats by tier
  let totalSeats = 0;
  for (const seat of seats) {
    if (seat.count > 0 && perTier[seat.tier]) {
      perTier[seat.tier].count += seat.count;
      totalSeats += seat.count;
    }
  }

  // Calculate subtotals per tier
  perTier.basic.subtotal = perTier.basic.count * perTier.basic.unitPrice;
  perTier.advanced.subtotal = perTier.advanced.count * perTier.advanced.unitPrice;
  perTier.elite.subtotal = perTier.elite.count * perTier.elite.unitPrice;

  // Calculate list price subtotal (before discount)
  const listSubtotal = perTier.basic.subtotal + perTier.advanced.subtotal + perTier.elite.subtotal;

  // Determine discount percentage
  const discountPercent = getTeamDiscountPercent(totalSeats);

  // Calculate discount amount and final total
  const discountAmount = listSubtotal * discountPercent;
  const finalTotal = listSubtotal - discountAmount;

  return {
    totalSeats,
    perTier,
    discountPercent,
    listSubtotal,
    discountAmount,
    finalTotal,
  };
}

/**
 * Internal cost percentages (for margin calculations)
 * These represent the cost as a percentage of list price
 */
const TIER_COSTS = {
  basic: 0.20, // 20% cost → 80% base margin
  advanced: 0.35, // 35% cost → 65% base margin
  elite: 0.45, // 45% cost → 55% base margin
} as const;

/**
 * Target minimum margins after discounts
 */
const MIN_MARGINS = {
  basic: 0.70, // 70% minimum margin
  advanced: 0.50, // 50% minimum margin
  elite: 0.40, // 40% minimum margin
} as const;

/**
 * Validate that pricing configuration maintains minimum margins
 * 
 * This ensures that even with maximum discount (25%), we maintain:
 * - Basic: ≥ 70% margin
 * - Advanced: ≥ 50% margin
 * - Elite: ≥ 40% margin
 * 
 * @returns true if margins are valid, false otherwise
 */
export function validatePricingMargins(): boolean {
  const maxDiscount = 0.25; // 25% maximum discount

  for (const [tierId, tier] of Object.entries(TIERS)) {
    const costPercent = TIER_COSTS[tierId as TierId];
    const minMargin = MIN_MARGINS[tierId as TierId];

    // Calculate margin after max discount
    // Margin = (price - cost) / price
    // After discount: effectivePrice = price * (1 - discount)
    // effectiveMargin = (effectivePrice - cost) / effectivePrice
    const effectivePrice = tier.priceMonthly * (1 - maxDiscount);
    const cost = tier.priceMonthly * costPercent;
    const effectiveMargin = (effectivePrice - cost) / effectivePrice;

    if (effectiveMargin < minMargin) {
      console.error(
        `Margin validation failed for ${tierId}: ` +
        `effective margin ${(effectiveMargin * 100).toFixed(2)}% ` +
        `is below minimum ${(minMargin * 100).toFixed(2)}%`
      );
      return false;
    }
  }

  return true;
}

/**
 * Get tier by ID
 */
export function getTier(tierId: TierId) {
  return TIERS[tierId];
}

/**
 * Get all tiers as array
 */
export function getAllTiers() {
  return Object.values(TIERS);
}

