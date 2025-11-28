import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { createErrorResponse } from "@/lib/validation";
import { crawlBusinessWebsite } from "@/lib/website-crawler";

/**
 * POST /api/business-profile/crawl
 * 
 * Manually trigger website crawl for the authenticated user's business profile
 * 
 * Query params:
 * - force: If true, crawl even if recently crawled (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") !== "false"; // Default to true

    const supabase = getSupabaseServerClient();

    // Get user's business profile
    const { data: profile, error: profileError } = await supabase
      .from("business_profiles")
      .select("id, primary_website_url")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return createErrorResponse("Business profile not found", 404);
    }

    if (!profile.primary_website_url) {
      return createErrorResponse("No website URL configured", 400);
    }

    // Trigger crawl
    const result = await crawlBusinessWebsite(
      profile.id,
      profile.primary_website_url,
      force
    );

    if (!result.success) {
      return createErrorResponse(
        result.error || "Failed to crawl website",
        500
      );
    }

    return NextResponse.json({
      success: true,
      chunksCreated: result.chunksCreated,
      message: result.chunksCreated > 0
        ? `Successfully crawled website and created ${result.chunksCreated} knowledge chunks`
        : "Website crawl completed (no new chunks created)",
    });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }
    return createErrorResponse("Failed to crawl website", 500, error);
  }
}








