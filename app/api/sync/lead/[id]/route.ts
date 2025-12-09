import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { z } from "zod";

const leadUpdateSchema = z.object({
  lead_stage: z.enum(['new', 'cold', 'qualified', 'warm', 'negotiating', 'ready_to_close', 'won', 'lost']).optional(),
  potential_value: z.number().nullable().optional(),
  currency: z.string().length(3).optional(),
  closed_value: z.number().nullable().optional(),
  closed_at: z.string().nullable().optional(),
});

/**
 * PATCH /api/sync/lead/[id]
 * Update lead fields (stage, revenue, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const { id: leadId } = await params;

    const body = await request.json();
    const parsed = leadUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Verify ownership
    const { data: existingLead, error: fetchError } = await supabase
      .from("leads")
      .select("user_id, lead_stage, closed_value")
      .eq("id", leadId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json(
        { error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.lead_stage !== undefined) {
      updateData.lead_stage = parsed.data.lead_stage;
      
      // Auto-set closed_value & closed_at when stage transitions to 'won' (only if closed_value was empty)
      if (parsed.data.lead_stage === "won" && !existingLead.closed_value) {
        // Get potential_value if available
        const { data: leadWithValue } = await supabase
          .from("leads")
          .select("potential_value")
          .eq("id", leadId)
          .single();
        
        if (leadWithValue?.potential_value && !parsed.data.closed_value) {
          updateData.closed_value = leadWithValue.potential_value;
          updateData.closed_at = new Date().toISOString();
        }
      }
    }

    if (parsed.data.potential_value !== undefined) {
      updateData.potential_value = parsed.data.potential_value;
    }

    if (parsed.data.currency !== undefined) {
      updateData.currency = parsed.data.currency;
    }

    if (parsed.data.closed_value !== undefined) {
      updateData.closed_value = parsed.data.closed_value;
      if (parsed.data.closed_value && !parsed.data.closed_at) {
        // Auto-set closed_at if closed_value is set and closed_at is not provided
        updateData.closed_at = new Date().toISOString();
      }
    }

    if (parsed.data.closed_at !== undefined) {
      updateData.closed_at = parsed.data.closed_at;
    }

    // Update lead
    const { data: updated, error: updateError } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", leadId)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ lead: updated });
  } catch (error: any) {
    console.error("[Lead Management] Error updating lead:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update lead" },
      { status: 500 }
    );
  }
}

