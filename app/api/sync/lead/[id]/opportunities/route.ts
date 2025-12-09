import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/sync/lead/[id]/opportunities
 * Get opportunities for a lead
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const { id: leadId } = await params;
    const supabase = getSupabaseServerClient();

    const { data: opportunities, error } = await supabase
      .from("lead_opportunities")
      .select("*")
      .eq("user_id", userId)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[Opportunities] Error fetching opportunities:", error);
      return NextResponse.json(
        { error: "Failed to fetch opportunities" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      opportunities: opportunities || [],
    });
  } catch (error: any) {
    console.error("[Opportunities] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch opportunities" },
      { status: 500 }
    );
  }
}


