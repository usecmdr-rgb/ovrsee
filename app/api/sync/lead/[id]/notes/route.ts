import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/sync/lead/[id]/notes
 * Get notes for a lead
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

    // Verify ownership and get contact_id
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("contact_id, user_id")
      .eq("id", leadId)
      .eq("user_id", userId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    // Get notes for this contact
    const { data: notes, error: notesError } = await supabase
      .from("contact_notes")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_id", lead.contact_id)
      .order("created_at", { ascending: false });

    if (notesError) {
      throw notesError;
    }

    return NextResponse.json({ notes: notes || [] });
  } catch (error: any) {
    console.error("[Lead Management] Error fetching notes:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/lead/[id]/notes
 * Create a note for a lead
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const { id: leadId } = await params;

    const body = await request.json();
    const { body: noteBody } = body;

    if (!noteBody || !noteBody.trim()) {
      return NextResponse.json(
        { error: "Note body is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Verify ownership and get contact_id
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("contact_id, user_id")
      .eq("id", leadId)
      .eq("user_id", userId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { error: "Lead not found or access denied" },
        { status: 404 }
      );
    }

    // Create note
    const { data: note, error: noteError } = await supabase
      .from("contact_notes")
      .insert({
        user_id: userId,
        contact_id: lead.contact_id,
        body: noteBody.trim(),
      })
      .select()
      .single();

    if (noteError) {
      throw noteError;
    }

    return NextResponse.json({ note });
  } catch (error: any) {
    console.error("[Lead Management] Error creating note:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create note" },
      { status: 500 }
    );
  }
}


