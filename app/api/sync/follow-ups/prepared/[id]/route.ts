import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * PATCH /api/sync/follow-ups/prepared/[id]
 * Mark a prepared draft as consumed
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const draftId = params.id;

    const supabase = getSupabaseServerClient();

    // Verify ownership and update
    const { error } = await supabase
      .from("prepared_follow_up_drafts")
      .update({
        consumed: true,
        consumed_at: new Date().toISOString(),
      })
      .eq("id", draftId)
      .eq("user_id", userId);

    if (error) {
      console.error("[Prepared Follow-ups] Error marking draft as consumed:", error);
      return NextResponse.json(
        { error: "Failed to update draft" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Prepared Follow-ups] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update draft" },
      { status: 500 }
    );
  }
}


