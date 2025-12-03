import { NextRequest, NextResponse } from "next/server";
import {
  SeatSelection,
  calculateTeamPricing,
  TierId,
} from "@/lib/pricing";

/**
 * POST /api/pricing/team-quote
 * 
 * Calculate team pricing breakdown for a given seat configuration.
 * Used by both frontend UI and backend services.
 * 
 * Request body:
 * {
 *   seats: SeatSelection[]
 * }
 * 
 * Response:
 * PricingBreakdown
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seats, billingInterval } = body as {
      seats: SeatSelection[];
      billingInterval?: 'monthly' | 'yearly';
    };

    // Validate input
    if (!Array.isArray(seats)) {
      return NextResponse.json(
        { error: "Invalid request: 'seats' must be an array" },
        { status: 400 }
      );
    }

    // Validate each seat selection
    const validTiers: TierId[] = ["basic", "advanced", "elite"];
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
    const pricing = calculateTeamPricing(seats as SeatSelection[], billingInterval || 'monthly');

    return NextResponse.json(pricing);
  } catch (error: any) {
    console.error("Error calculating team pricing:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}



