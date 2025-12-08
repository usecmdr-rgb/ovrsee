import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getBusinessProfileByUserId, upsertBusinessPricingTier, deleteBusinessPricingTier } from "@/lib/sync/businessInfo";

/**
 * POST /api/settings/business/pricing-tiers
 * Create or update a pricing tier
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const body = await request.json();
    const { id, service_id, name, description, price_amount, price_currency, billing_interval, is_default, is_active } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Pricing tier name is required" },
        { status: 400 }
      );
    }

    if (price_amount === undefined || price_amount === null || isNaN(Number(price_amount))) {
      return NextResponse.json(
        { error: "Price amount is required and must be a number" },
        { status: 400 }
      );
    }

    const profile = await getBusinessProfileByUserId(userId);
    if (!profile) {
      return NextResponse.json(
        { error: "Business profile not found. Please create a business profile first." },
        { status: 404 }
      );
    }

    const tier = await upsertBusinessPricingTier(profile.id, id, {
      service_id: service_id || null,
      name: name.trim(),
      description: description?.trim() || null,
      price_amount: Number(price_amount),
      price_currency: price_currency || profile.default_currency,
      billing_interval: billing_interval || "one_time",
      is_default: is_default || false,
      is_active: is_active !== false,
    });

    return NextResponse.json({ tier });
  } catch (error: any) {
    console.error("[Business Settings] Error managing pricing tier:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save pricing tier" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/business/pricing-tiers?id=...
 * Delete a pricing tier
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const searchParams = request.nextUrl.searchParams;
    const tierId = searchParams.get("id");

    if (!tierId) {
      return NextResponse.json(
        { error: "Pricing tier ID is required" },
        { status: 400 }
      );
    }

    const profile = await getBusinessProfileByUserId(userId);
    if (!profile) {
      return NextResponse.json(
        { error: "Business profile not found" },
        { status: 404 }
      );
    }

    await deleteBusinessPricingTier(profile.id, tierId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Business Settings] Error deleting pricing tier:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete pricing tier" },
      { status: 500 }
    );
  }
}


