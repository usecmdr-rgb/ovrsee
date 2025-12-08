import { NextRequest, NextResponse } from "next/server";
import { calculateTeamPricing } from "@/lib/pricing";
import { describeTeamPricing } from "@/lib/pricingExplain";
import type { SeatSelection, PricingBreakdown } from "@/lib/pricing";

/**
 * POST /api/pricing/explain
 * 
 * Explain team pricing in natural language for AI agents
 * 
 * Request body: { seats: SeatSelection[] }
 * Response: { breakdown: PricingBreakdown, explanation: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seats } = body;

    if (!Array.isArray(seats)) {
      return NextResponse.json(
        { error: "Invalid request: 'seats' must be an array" },
        { status: 400 }
      );
    }

    // Validate seat selections
    const validTiers = ["basic", "advanced", "elite"];
    for (const seat of seats) {
      if (!seat.tier || !validTiers.includes(seat.tier)) {
        return NextResponse.json(
          {
            error: `Invalid tier: ${seat.tier}. Must be one of: ${validTiers.join(", ")}`,
          },
          { status: 400 }
        );
      }

      if (typeof seat.count !== "number" || seat.count < 0) {
        return NextResponse.json(
          { error: `Invalid count for tier ${seat.tier}: must be a non-negative number` },
          { status: 400 }
        );
      }
    }

    // Calculate pricing
    const breakdown = calculateTeamPricing(seats as SeatSelection[]);

    // Generate explanation
    const explanation = describeTeamPricing(breakdown);

    return NextResponse.json({
      ok: true,
      breakdown,
      explanation,
    });
  } catch (error: any) {
    console.error("Error explaining pricing:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}




