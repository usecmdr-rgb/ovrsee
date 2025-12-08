/**
 * Subscription guardrails and validation logic
 * Prevents unsafe or confusing subscription changes
 */

import type { SeatSelection, TierId } from "@/lib/pricing";
import { calculateTeamPricing } from "@/lib/pricing";

export interface GuardrailContext {
  currentSeats: SeatSelection[];
  proposedSeats: SeatSelection[];
  currentFeatures: {
    hasInsight: boolean;
    hasAloha: boolean;
    hasStudio: boolean;
  };
  usageFlags: {
    usesEliteOnlyFeatures: boolean;
    usesAdvancedOnlyFeatures: boolean;
  };
  activeMemberCount?: number; // Current number of active team members
}

export interface GuardrailCheckResult {
  blockingIssues: string[];
  warnings: string[];
  priceChange?: {
    current: number;
    proposed: number;
    difference: number;
    percentChange: number;
  };
  featuresLost: string[];
}

/**
 * Run guardrail checks on a proposed seat configuration change
 */
export function runGuardrailChecks(context: GuardrailContext): GuardrailCheckResult {
  const { currentSeats, proposedSeats, currentFeatures, usageFlags, activeMemberCount } = context;

  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const featuresLost: string[] = [];

  // Calculate current and proposed totals
  const currentTotal = currentSeats.reduce((sum, seat) => sum + seat.count, 0);
  const proposedTotal = proposedSeats.reduce((sum, seat) => sum + seat.count, 0);

  // Calculate pricing changes
  const currentPricing = calculateTeamPricing(currentSeats);
  const proposedPricing = calculateTeamPricing(proposedSeats);
  const priceChange = {
    current: currentPricing.finalTotal,
    proposed: proposedPricing.finalTotal,
    difference: proposedPricing.finalTotal - currentPricing.finalTotal,
    percentChange: currentPricing.finalTotal > 0
      ? ((proposedPricing.finalTotal - currentPricing.finalTotal) / currentPricing.finalTotal) * 100
      : 0,
  };

  // Check 1: Cannot have fewer seats than active members
  if (activeMemberCount !== undefined && proposedTotal < activeMemberCount) {
    blockingIssues.push(
      `You cannot have fewer seats (${proposedTotal}) than active team members (${activeMemberCount}). Remove members first before reducing seat count.`
    );
  }

  // Check 2: Cannot remove all Elite seats if using Elite-only features
  const currentEliteCount = currentSeats.find((s) => s.tier === "elite")?.count || 0;
  const proposedEliteCount = proposedSeats.find((s) => s.tier === "elite")?.count || 0;
  
  if (currentEliteCount > 0 && proposedEliteCount === 0 && usageFlags.usesEliteOnlyFeatures) {
    blockingIssues.push(
      "You're using Elite-only features (Insight Agent, advanced analytics). Remove or migrate these before downgrading all Elite seats."
    );
    featuresLost.push("Insight Agent");
    featuresLost.push("Advanced analytics & business intelligence");
  }

  // Check 3: Downgrading from Elite removes Insight access
  if (currentEliteCount > 0 && proposedEliteCount < currentEliteCount && currentFeatures.hasInsight) {
    if (proposedEliteCount === 0) {
      warnings.push(
        "Downgrading will remove access to the Insight Agent. You'll lose historical insights and briefs."
      );
    } else {
      warnings.push(
        `Downgrading from ${currentEliteCount} to ${proposedEliteCount} Elite seat(s) will reduce Insight Agent access.`
      );
    }
    if (!featuresLost.includes("Insight Agent")) {
      featuresLost.push("Insight Agent");
    }
  }

  // Check 4: Downgrading from Advanced removes Aloha/Studio access
  const currentAdvancedCount = currentSeats.find((s) => s.tier === "advanced")?.count || 0;
  const proposedAdvancedCount = proposedSeats.find((s) => s.tier === "advanced")?.count || 0;
  const proposedEliteCountForAdvanced = proposedEliteCount; // Elite includes Advanced features

  if (
    (currentAdvancedCount > 0 || currentEliteCount > 0) &&
    proposedAdvancedCount === 0 &&
    proposedEliteCountForAdvanced === 0 &&
    (currentFeatures.hasAloha || currentFeatures.hasStudio)
  ) {
    warnings.push(
      "Downgrading to Basic will remove access to Aloha (AI voice answering) and Studio (media management)."
    );
    if (!featuresLost.includes("Aloha Agent")) {
      featuresLost.push("Aloha Agent");
    }
    if (!featuresLost.includes("Studio Agent")) {
      featuresLost.push("Studio Agent");
    }
  }

  // Check 5: Large price increase warning (>30%)
  if (priceChange.percentChange > 30) {
    warnings.push(
      `Your subscription cost will increase by ${Math.round(priceChange.percentChange)}% (from $${priceChange.current.toFixed(2)} to $${priceChange.proposed.toFixed(2)} per month).`
    );
  }

  // Check 6: Large price decrease - confirm it's intentional
  if (priceChange.percentChange < -30 && currentPricing.finalTotal > 0) {
    warnings.push(
      `Your subscription cost will decrease by ${Math.round(Math.abs(priceChange.percentChange))}% (from $${priceChange.current.toFixed(2)} to $${priceChange.proposed.toFixed(2)} per month). Make sure this aligns with your needs.`
    );
  }

  // Check 7: Removing all seats
  if (proposedTotal === 0 && currentTotal > 0) {
    warnings.push(
      "You're removing all seats. Your subscription will be canceled and you'll lose access to all features."
    );
  }

  // Check 8: Cannot use Advanced-only features if downgrading all Advanced seats
  if (
    (currentAdvancedCount > 0 || currentEliteCount > 0) &&
    proposedAdvancedCount === 0 &&
    proposedEliteCountForAdvanced === 0 &&
    usageFlags.usesAdvancedOnlyFeatures
  ) {
    const hasAnyAdvanced = proposedEliteCount > 0;
    if (!hasAnyAdvanced) {
      blockingIssues.push(
        "You're using Advanced-only features (Aloha, Studio). Remove or migrate these before downgrading all Advanced seats."
      );
    }
  }

  return {
    blockingIssues,
    warnings,
    priceChange,
    featuresLost: Array.from(new Set(featuresLost)), // Remove duplicates
  };
}

/**
 * Determine feature usage flags from seat configuration
 */
export function deriveFeatureUsage(seats: SeatSelection[]): {
  hasInsight: boolean;
  hasAloha: boolean;
  hasStudio: boolean;
  usesEliteOnlyFeatures: boolean;
  usesAdvancedOnlyFeatures: boolean;
} {
  const hasElite = seats.some((s) => s.tier === "elite" && s.count > 0);
  const hasAdvanced = seats.some((s) => s.tier === "advanced" && s.count > 0);

  return {
    hasInsight: hasElite,
    hasAloha: hasAdvanced || hasElite,
    hasStudio: hasAdvanced || hasElite,
    usesEliteOnlyFeatures: hasElite,
    usesAdvancedOnlyFeatures: hasAdvanced || hasElite,
  };
}

/**
 * Detect if workspace is actively using features (for blocking downgrades)
 * This is a simplified version - in production, you'd check actual usage stats
 */
export function detectFeatureUsage(
  seats: SeatSelection[]
): {
  usesEliteOnlyFeatures: boolean;
  usesAdvancedOnlyFeatures: boolean;
} {
  const hasElite = seats.some((s) => s.tier === "elite" && s.count > 0);
  const hasAdvanced = seats.some((s) => s.tier === "advanced" && s.count > 0);

  // For now, if they have the seats, assume they're using the features
  // In production, you'd check:
  // - Insight Agent usage (insights generated, briefs created)
  // - Aloha usage (calls handled, voicemails)
  // - Studio usage (media created, campaigns)
  return {
    usesEliteOnlyFeatures: hasElite,
    usesAdvancedOnlyFeatures: hasAdvanced || hasElite,
  };
}




