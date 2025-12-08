import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { calculateTeamPricing, type SeatSelection, type TierId } from "@/lib/pricing";
import { describeTeamPricing } from "@/lib/pricingExplain";
import { TIERS } from "@/lib/pricing";

export interface PlanSeatSuggestion {
  tier: TierId;
  count: number;
}

export interface PlanRecommendationResponse {
  suggestedSeats: PlanSeatSuggestion[];
  reasoning: string;
  altOptions: {
    label: string;
    suggestedSeats: PlanSeatSuggestion[];
    pros: string[];
    cons: string[];
  }[];
  pricing: {
    breakdown: ReturnType<typeof calculateTeamPricing>;
    explanation: string;
  };
}

interface AnonymousRequest {
  mode: "anonymous";
  teamSize: number;
  callVolume: "low" | "medium" | "high";
  emailVolume: "low" | "medium" | "high";
  mediaVolume?: "low" | "medium" | "high"; // Optional: media generation volume
  analyticsVolume?: "low" | "medium" | "high"; // Optional: analytics volume
  needsVoice: boolean;
  needsInsights: boolean;
  budgetSensitivity: "low" | "medium" | "high";
  billingInterval?: "monthly" | "yearly"; // Optional: billing interval, defaults to monthly
}

interface WorkspaceRequest {
  mode: "workspace";
  billingInterval?: "monthly" | "yearly"; // Optional: billing interval, defaults to monthly
}

type RecommendRequest = AnonymousRequest | WorkspaceRequest;

/**
 * POST /api/pricing/recommend
 * 
 * Recommends a plan configuration based on usage patterns or anonymous questionnaire
 * 
 * Modes:
 * - anonymous: Based on questionnaire answers
 * - workspace: Based on existing workspace usage
 */
export async function POST(request: NextRequest) {
  try {
    const body: RecommendRequest = await request.json();

    if (body.mode === "anonymous") {
      return handleAnonymousRecommendation(body);
    } else if (body.mode === "workspace") {
      return handleWorkspaceRecommendation(body.billingInterval || "monthly");
    } else {
      return NextResponse.json(
        { error: "Invalid mode. Must be 'anonymous' or 'workspace'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error generating plan recommendation:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleAnonymousRecommendation(req: AnonymousRequest): Promise<NextResponse> {
  // Extract all parameters including mediaVolume and analyticsVolume for updated recommendation logic
  const { teamSize, callVolume, emailVolume, mediaVolume, analyticsVolume, needsVoice, needsInsights, budgetSensitivity, billingInterval = "monthly" } = req;

  // Recommendation logic
  let suggestedSeats: PlanSeatSuggestion[] = [];
  let reasoning = "";

  // Solo or very small teams
  // Updated recommendation logic for new pricing model: Essentials, Professional, Executive
  if (teamSize <= 2) {
    if (needsInsights) {
      suggestedSeats = [{ tier: "elite" as TierId, count: 1 }];
      reasoning = `For a solo operator or small team of ${teamSize} with insight needs, we recommend 1 Executive seat. This gives you full access to all agents including the Insight Agent for business intelligence.`;
    } else if (needsVoice) {
      suggestedSeats = [{ tier: "advanced" as TierId, count: 1 }];
      reasoning = `For a small team of ${teamSize} with AI voice needs, we recommend 1 Professional seat. This unlocks Aloha for call handling and Studio for media management.`;
    } else {
      suggestedSeats = [{ tier: "basic" as TierId, count: teamSize }];
      reasoning = `For a small team of ${teamSize} focused on email and calendar management, we recommend ${teamSize} Essentials seat(s). This gives you access to the Sync Agent at an affordable price.`;
    }
  }
  // Medium teams (3-10)
  // Updated recommendation logic per new pricing model:
  // - call volume > Medium → Professional
  // - media volume > Medium → Professional
  // - analytics volume > Medium → Executive
  // - "I need AI voice answering" → Professional or higher
  // - "I care about deep analytics" → Executive
  else if (teamSize <= 10) {
    // Check for Executive requirements first (analytics volume > Medium or deep analytics need)
    if (needsInsights || analyticsVolume === "high" || analyticsVolume === "medium") {
      // Mix of Executive and Professional
      const eliteCount = Math.min(2, Math.ceil(teamSize * 0.3));
      const advancedCount = teamSize - eliteCount;
      suggestedSeats = [
        { tier: "elite" as TierId, count: eliteCount },
        { tier: "advanced" as TierId, count: advancedCount },
      ];
      reasoning = `For a team of ${teamSize} with high-volume usage and insight needs, we recommend ${eliteCount} Executive seat(s) for leadership/analytics and ${advancedCount} Professional seat(s) for team members. This balances cost with full feature access.`;
    } 
    // Check for Professional requirements (call volume > Medium, media volume > Medium, or AI voice need)
    else if (needsVoice || callVolume === "high" || callVolume === "medium" || mediaVolume === "high" || mediaVolume === "medium") {
      suggestedSeats = [{ tier: "advanced", count: teamSize }];
      reasoning = `For a team of ${teamSize} with voice or media needs, we recommend ${teamSize} Professional seat(s). This gives everyone access to Aloha for call handling and Studio for media management.`;
    } else {
      suggestedSeats = [{ tier: "basic" as TierId, count: teamSize }];
      reasoning = `For a team of ${teamSize} focused primarily on email management, we recommend ${teamSize} Essentials seat(s). You can always upgrade individual seats later if needs change.`;
    }
  }
  // Larger teams (11+)
  else {
    // For larger teams, suggest a mix
    const eliteCount = Math.min(3, Math.ceil(teamSize * 0.2));
    const advancedCount = Math.ceil((teamSize - eliteCount) * 0.6);
    const basicCount = teamSize - eliteCount - advancedCount;
    suggestedSeats = [
      { tier: "elite" as TierId, count: eliteCount },
      { tier: "advanced" as TierId, count: advancedCount },
      { tier: "basic" as TierId, count: basicCount },
    ].filter((s) => s.count > 0);
    reasoning = `For a larger team of ${teamSize}, we recommend a tiered approach: ${eliteCount} Executive seat(s) for leadership/analytics, ${advancedCount} Professional seat(s) for core team members, and ${basicCount} Essentials seat(s) for occasional users. This optimizes cost while ensuring the right features for each role.`;
  }

  // Apply budget sensitivity adjustments
  if (budgetSensitivity === "high" && suggestedSeats.length > 0) {
    // Downgrade suggestions
    const hasElite = suggestedSeats.some((s) => s.tier === "elite");
    const hasAdvanced = suggestedSeats.some((s) => s.tier === "advanced");
    
    if (hasElite) {
      // Convert some Elite to Advanced
      const eliteSeat = suggestedSeats.find((s) => s.tier === "elite");
      if (eliteSeat && eliteSeat.count > 0) {
        const convertCount = Math.min(eliteSeat.count, 1);
        eliteSeat.count -= convertCount;
        const advancedSeat = suggestedSeats.find((s) => s.tier === "advanced") || { tier: "advanced" as TierId, count: 0 };
        advancedSeat.count += convertCount;
        if (!suggestedSeats.includes(advancedSeat)) {
          suggestedSeats.push(advancedSeat);
        }
        reasoning += " We've adjusted for budget sensitivity by prioritizing Professional over Executive seats where possible.";
      }
    }
    if (hasAdvanced && teamSize > 5) {
      // Convert some Advanced to Basic
      const advancedSeat = suggestedSeats.find((s) => s.tier === "advanced");
      if (advancedSeat && advancedSeat.count > 2) {
        const convertCount = Math.floor(advancedSeat.count * 0.3);
        advancedSeat.count -= convertCount;
        const basicSeat = suggestedSeats.find((s) => s.tier === "basic") || { tier: "basic" as TierId, count: 0 };
        basicSeat.count += convertCount;
        if (!suggestedSeats.includes(basicSeat)) {
          suggestedSeats.push(basicSeat);
        }
        reasoning += " Some seats were adjusted to Essentials tier for cost optimization.";
      }
    }
    
    // Remove empty seats
    suggestedSeats = suggestedSeats.filter((s) => s.count > 0);
  } else if (budgetSensitivity === "low" && needsInsights) {
    // Upgrade suggestions if budget allows
    const hasAdvanced = suggestedSeats.some((s) => s.tier === "advanced");
    if (hasAdvanced && !suggestedSeats.some((s) => s.tier === "elite")) {
      // Convert one Advanced to Elite
      const advancedSeat = suggestedSeats.find((s) => s.tier === "advanced");
      if (advancedSeat && advancedSeat.count > 0) {
        advancedSeat.count -= 1;
        const eliteSeat = suggestedSeats.find((s) => s.tier === "elite") || { tier: "elite" as TierId, count: 0 };
        eliteSeat.count += 1;
        if (!suggestedSeats.includes(eliteSeat)) {
          suggestedSeats.push(eliteSeat);
        }
      }
    }
  }

  // Calculate pricing with billing interval
  const pricingBreakdown = calculateTeamPricing(suggestedSeats, billingInterval);
  const pricingExplanation = describeTeamPricing(pricingBreakdown);

  // Generate alternative options
  const altOptions = generateAlternativeOptions(teamSize, needsVoice, needsInsights, suggestedSeats, undefined, billingInterval);

  return NextResponse.json({
    ok: true,
    suggestedSeats,
    reasoning,
    altOptions,
    pricing: {
      breakdown: pricingBreakdown,
      explanation: pricingExplanation,
    },
  });
}

async function handleWorkspaceRecommendation(billingInterval: "monthly" | "yearly" = "monthly"): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  // Get authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Get workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_user_id", user.id)
    .single();

  if (workspaceError || !workspace) {
    return NextResponse.json(
      { error: "Workspace not found" },
      { status: 404 }
    );
  }

  // Get current seats
  const { data: seats, error: seatsError } = await supabase
    .from("workspace_seats")
    .select("tier, status")
    .eq("workspace_id", workspace.id)
    .in("status", ["active", "pending"]);

  if (seatsError) {
    throw seatsError;
  }

  // Aggregate current seat counts
  const currentSeatCounts: Record<TierId, number> = {
    basic: 0,
    advanced: 0,
    elite: 0,
  };

  (seats || []).forEach((seat: any) => {
    if (seat.tier in currentSeatCounts) {
      currentSeatCounts[seat.tier as TierId]++;
    }
  });

  const totalCurrentSeats = currentSeatCounts.basic + currentSeatCounts.advanced + currentSeatCounts.elite;

  // Get usage stats from agent_stats_daily
  const { data: stats } = await supabase
    .from("agent_stats_daily")
    .select("*")
    .order("date", { ascending: false })
    .limit(30); // Last 30 days

  // Calculate usage patterns
  const totalCalls = stats?.reduce((sum, s: any) => sum + (s.alpha_calls_total || 0), 0) || 0;
  const totalEmails = stats?.reduce((sum, s: any) => sum + (s.xi_important_emails || 0), 0) || 0;
  const totalInsights = stats?.reduce((sum, s: any) => sum + (s.beta_insights_count || 0), 0) || 0;

  const avgCallsPerDay = totalCalls / 30;
  const avgEmailsPerDay = totalEmails / 30;

  // Determine usage levels
  const callVolume: "low" | "medium" | "high" = 
    avgCallsPerDay < 5 ? "low" : avgCallsPerDay < 20 ? "medium" : "high";
  const emailVolume: "low" | "medium" | "high" = 
    avgEmailsPerDay < 10 ? "low" : avgEmailsPerDay < 50 ? "medium" : "high";
  const needsInsights = totalInsights > 10 || currentSeatCounts.elite > 0;
  const needsVoice = avgCallsPerDay > 0 || currentSeatCounts.advanced > 0 || currentSeatCounts.elite > 0;

  // Generate recommendation based on usage
  let suggestedSeats: PlanSeatSuggestion[] = [];
  let reasoning = "";

  if (totalCurrentSeats === 0) {
    // No seats yet - recommend based on usage
    // Updated for new pricing model: Essentials, Professional, Executive
    if (needsInsights) {
      suggestedSeats = [{ tier: "elite" as TierId, count: 1 }];
      reasoning = "Based on your usage patterns, we recommend starting with 1 Executive seat to access all agents including insights.";
    } else if (needsVoice) {
      suggestedSeats = [{ tier: "advanced" as TierId, count: 1 }];
      reasoning = "Based on your call handling needs, we recommend 1 Professional seat for Aloha and Studio access.";
    } else {
      suggestedSeats = [{ tier: "basic" as TierId, count: 1 }];
      reasoning = "Based on your usage, we recommend 1 Essentials seat to get started with the Sync Agent.";
    }
  } else {
    // Already have seats - analyze if current setup is optimal
    const currentTotal = totalCurrentSeats;
    
    // Check if we should recommend changes
    if (needsInsights && currentSeatCounts.elite === 0) {
      // Need insights but no Executive seats
      suggestedSeats = [
        { tier: "elite" as TierId, count: Math.max(1, Math.ceil(currentTotal * 0.2)) },
        { tier: "advanced" as TierId, count: Math.max(0, currentSeatCounts.advanced) },
        { tier: "basic" as TierId, count: currentSeatCounts.basic },
      ].filter((s) => s.count > 0);
      reasoning = `You're currently on ${totalCurrentSeats} seat(s) but are using insights features. We recommend adding at least 1 Executive seat for Insight Agent access.`;
    } else if (callVolume === "high" && currentSeatCounts.advanced === 0 && currentSeatCounts.elite === 0) {
      // High call volume but no Professional/Executive
      suggestedSeats = [
        { tier: "advanced" as TierId, count: Math.ceil(currentTotal * 0.5) },
        { tier: "basic" as TierId, count: Math.floor(currentTotal * 0.5) },
      ];
      reasoning = `You're handling high call volume (${Math.round(avgCallsPerDay)} calls/day). We recommend upgrading some seats to Professional for Aloha Agent access.`;
    } else if (callVolume === "low" && emailVolume === "low" && currentSeatCounts.basic < currentTotal) {
      // Low usage - could downgrade
      suggestedSeats = [{ tier: "basic" as TierId, count: currentTotal }];
      reasoning = `Your usage is relatively low. Consider consolidating to ${currentTotal} Essentials seat(s) to optimize costs while maintaining essential features.`;
    } else {
      // Current setup seems good
      suggestedSeats = [
        { tier: "basic" as TierId, count: currentSeatCounts.basic },
        { tier: "advanced" as TierId, count: currentSeatCounts.advanced },
        { tier: "elite" as TierId, count: currentSeatCounts.elite },
      ].filter((s) => s.count > 0);
      reasoning = `Your current configuration of ${totalCurrentSeats} seat(s) aligns well with your usage patterns. No changes recommended at this time.`;
    }
  }

  // Calculate pricing for suggested seats
  const pricingBreakdown = calculateTeamPricing(suggestedSeats, billingInterval);
  const pricingExplanation = describeTeamPricing(pricingBreakdown);

  // Calculate current pricing for comparison
  const currentSeats: SeatSelection[] = [
    { tier: "basic" as TierId, count: currentSeatCounts.basic },
    { tier: "advanced" as TierId, count: currentSeatCounts.advanced },
    { tier: "elite" as TierId, count: currentSeatCounts.elite },
  ].filter((s) => s.count > 0);
  const currentPricing = calculateTeamPricing(currentSeats, billingInterval);

  // Generate alternative options
  const altOptions = generateAlternativeOptions(
    totalCurrentSeats || 1,
    needsVoice,
    needsInsights,
    suggestedSeats,
    currentSeats,
    billingInterval
  );

  return NextResponse.json({
    ok: true,
    suggestedSeats,
    reasoning,
    altOptions,
    pricing: {
      breakdown: pricingBreakdown,
      explanation: pricingExplanation,
    },
    currentPricing: {
      breakdown: currentPricing,
      explanation: describeTeamPricing(currentPricing),
    },
  });
}

function generateAlternativeOptions(
  teamSize: number,
  needsVoice: boolean,
  needsInsights: boolean,
  primarySuggestion: PlanSeatSuggestion[],
  currentSeats?: SeatSelection[],
  billingInterval: "monthly" | "yearly" = "monthly"
): PlanRecommendationResponse["altOptions"] {
  const options: PlanRecommendationResponse["altOptions"] = [];

  const primaryTotal = primarySuggestion.reduce((sum, s) => sum + s.count, 0);
  const primaryPrice = calculateTeamPricing(primarySuggestion, billingInterval).finalTotal;

  // Cheaper option
  if (primarySuggestion.some((s) => s.tier === "elite" || s.tier === "advanced")) {
    const cheaperSeats: PlanSeatSuggestion[] = [
      { tier: "basic" as TierId, count: Math.max(1, Math.floor(primaryTotal * 0.8)) },
    ];
    const cheaperPrice = calculateTeamPricing(cheaperSeats, billingInterval).finalTotal;
    
    if (cheaperPrice < primaryPrice * 0.9) {
      options.push({
        label: "Cheaper Option",
        suggestedSeats: cheaperSeats,
        pros: [
          "Lower monthly cost",
          "Access to Sync Agent for email/calendar",
          "Good starting point for small teams",
        ],
        cons: [
          "No AI voice answering (Aloha)",
          "No media management (Studio)",
          "No business insights (Insight Agent)",
        ],
      });
    }
  }

  // Higher-performance option
  if (!needsInsights || primarySuggestion.every((s) => s.tier !== "elite")) {
    const premiumSeats: PlanSeatSuggestion[] = [
      { tier: "elite" as TierId, count: Math.max(1, Math.ceil(primaryTotal * 0.5)) },
      { tier: "advanced" as TierId, count: Math.max(0, Math.floor(primaryTotal * 0.5)) },
    ].filter((s) => s.count > 0);
    const premiumPrice = calculateTeamPricing(premiumSeats, billingInterval).finalTotal;
    
    if (premiumPrice > primaryPrice * 1.1) {
      options.push({
        label: "Higher-Performance Option",
        suggestedSeats: premiumSeats,
        pros: [
          "Full access to all agents including Insight",
          "Advanced analytics and business intelligence",
          "Best for data-driven teams",
        ],
        cons: [
          "Higher monthly cost",
          "May be more than needed for small teams",
        ],
      });
    }
  }

  return options;
}

