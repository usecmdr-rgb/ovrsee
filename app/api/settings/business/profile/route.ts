import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { upsertBusinessProfile } from "@/lib/sync/businessInfo";

/**
 * POST /api/settings/business/profile
 * Create or update business profile
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const body = await request.json();
    const { business_name, website_url, description, default_currency, brand_voice } = body;

    // Validate required fields
    if (!business_name || !business_name.trim()) {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    const profile = await upsertBusinessProfile({
      userId,
      business_name: business_name.trim(),
      website_url: website_url?.trim() || null,
      description: description?.trim() || null,
      default_currency: default_currency || "USD",
      brand_voice: brand_voice || "professional",
    });

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error("[Business Settings] Error upserting profile:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save business profile" },
      { status: 500 }
    );
  }
}


