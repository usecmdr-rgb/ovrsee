import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/sync/sequences
 * Get all follow-up sequences for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const supabase = getSupabaseServerClient();

    const { data: sequences, error } = await supabase
      .from("follow_up_sequences")
      .select(`
        id,
        name,
        description,
        is_default,
        created_at,
        updated_at,
        follow_up_sequence_steps (
          id,
          step_order,
          days_after_last_activity,
          label,
          intensity
        )
      `)
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Sequences] Error fetching sequences:", error);
      return NextResponse.json(
        { error: "Failed to fetch sequences" },
        { status: 500 }
      );
    }

    // Format response
    const formattedSequences = (sequences || []).map((seq: any) => ({
      id: seq.id,
      name: seq.name,
      description: seq.description,
      is_default: seq.is_default,
      created_at: seq.created_at,
      updated_at: seq.updated_at,
      step_count: (seq.follow_up_sequence_steps || []).length,
      steps: (seq.follow_up_sequence_steps || []).sort((a: any, b: any) => a.step_order - b.step_order),
    }));

    return NextResponse.json({
      ok: true,
      sequences: formattedSequences,
    });
  } catch (error: any) {
    console.error("[Sequences] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sequences" },
      { status: 500 }
    );
  }
}


