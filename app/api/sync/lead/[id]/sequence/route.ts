import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { z } from "zod";

const sequenceUpdateSchema = z.object({
  sequenceId: z.string().uuid().nullable(),
});

/**
 * PATCH /api/sync/lead/[id]/sequence
 * Update lead's follow-up sequence
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const { id: leadId } = await params;
    const supabase = getSupabaseServerClient();

    const json = await request.json();
    const parsed = sequenceUpdateSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { sequenceId } = parsed.data;

    // Update lead with sequence_id and next_sequence_step_order
    const updateData: any = {
      sequence_id: sequenceId,
      updated_at: new Date().toISOString(),
    };

    if (sequenceId) {
      // Set next step to 1 when sequence is assigned
      updateData.next_sequence_step_order = 1;
    } else {
      // Clear sequence step when sequence is removed
      updateData.next_sequence_step_order = null;
    }

    const { data: updatedLead, error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", leadId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("[Sequence] Error updating lead sequence:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update sequence" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: updatedLead,
    });
  } catch (error: any) {
    console.error("[Sequence] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update sequence" },
      { status: 500 }
    );
  }
}


