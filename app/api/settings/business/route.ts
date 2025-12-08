import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getBusinessContextForUser } from "@/lib/sync/businessInfo";

/**
 * GET /api/settings/business
 * Get business context for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const businessContext = await getBusinessContextForUser(userId);

    if (!businessContext) {
      return NextResponse.json({
        profile: null,
        services: [],
        pricingTiers: [],
        hours: [],
        faqs: [],
      });
    }

    return NextResponse.json({
      profile: businessContext.profile,
      services: businessContext.services,
      pricingTiers: businessContext.pricingTiers,
      hours: businessContext.hours,
      faqs: businessContext.faqs,
    });
  } catch (error: any) {
    console.error("[Business Settings] Error fetching business context:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch business settings" },
      { status: 500 }
    );
  }
}


