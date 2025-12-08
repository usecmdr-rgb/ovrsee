/**
 * Pricing explanation helper
 * Converts pricing breakdowns into human-readable text for AI agents
 */

import type { PricingBreakdown } from './pricing';
import { TIERS } from './pricing';

/**
 * Describe team pricing in natural language
 */
export function describeTeamPricing(breakdown: PricingBreakdown): string {
  const { totalSeats, perTier, listSubtotal, discountPercent, discountAmount, finalTotal } = breakdown;

  const tierLines = Object.entries(perTier)
    .filter(([, v]) => v.count > 0)
    .map(([tier, v]) => {
      const tierName = TIERS[tier as keyof typeof TIERS].name;
      return `${v.count} × ${tierName} ($${v.unitPrice.toFixed(2)}/user)`;
    });

  const discountLine =
    discountPercent > 0
      ? `A team discount of ${(discountPercent * 100).toFixed(0)}% saves you $${discountAmount.toFixed(2)} per month.`
      : `No team discount applies yet (add more seats to unlock discounts).`;

  return [
    `You currently have ${totalSeats} seat${totalSeats === 1 ? '' : 's'}: ${tierLines.join(', ')}.`,
    `At list price this would be $${listSubtotal.toFixed(2)} per month.`,
    discountLine,
    `Your final total is $${finalTotal.toFixed(2)} per month.`,
  ].join(' ');
}




