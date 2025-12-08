import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getBusinessProfileByUserId, upsertBusinessService, deleteBusinessService } from "@/lib/sync/businessInfo";

/**
 * POST /api/settings/business/services
 * Create or update a business service
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const body = await request.json();
    const { id, name, description, category, is_active } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Service name is required" },
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

    const service = await upsertBusinessService(profile.id, id, {
      name: name.trim(),
      description: description?.trim() || null,
      category: category?.trim() || null,
      is_active: is_active !== false,
    });

    return NextResponse.json({ service });
  } catch (error: any) {
    console.error("[Business Settings] Error managing service:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save service" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/business/services?id=...
 * Delete a business service
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const searchParams = request.nextUrl.searchParams;
    const serviceId = searchParams.get("id");

    if (!serviceId) {
      return NextResponse.json(
        { error: "Service ID is required" },
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

    await deleteBusinessService(profile.id, serviceId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Business Settings] Error deleting service:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete service" },
      { status: 500 }
    );
  }
}


