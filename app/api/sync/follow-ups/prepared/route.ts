import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { isAutoSequenceFollowUpsEnabled } from "@/lib/sync/featureFlags";

/**
 * GET /api/sync/follow-ups/prepared
 * Get prepared follow-up drafts for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    if (!isAutoSequenceFollowUpsEnabled()) {
      return NextResponse.json({ drafts: [] });
    }

    const supabase = getSupabaseServerClient();

    // Get unconsumed prepared drafts with related info
    const { data: drafts, error } = await supabase
      .from("prepared_follow_up_drafts")
      .select(
        `
        id,
        lead_id,
        email_id,
        draft_body,
        created_at,
        leads!inner(
          id,
          lead_stage,
          lead_score,
          contacts!inner(
            id,
            email,
            name,
            company
          )
        ),
        email_queue!inner(
          id,
          subject,
          from_address,
          from_name,
          gmail_thread_id
        )
      `
      )
      .eq("user_id", userId)
      .eq("consumed", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Prepared Follow-ups] Error fetching drafts:", error);
      return NextResponse.json(
        { error: "Failed to fetch prepared drafts" },
        { status: 500 }
      );
    }

    // Format response
    const formattedDrafts = (drafts || []).map((draft: any) => ({
      id: draft.id,
      leadId: draft.lead_id,
      emailId: draft.email_id,
      draftBody: draft.draft_body,
      createdAt: draft.created_at,
      lead: {
        stage: draft.leads.lead_stage,
        score: draft.leads.lead_score,
      },
      contact: {
        email: draft.leads.contacts.email,
        name: draft.leads.contacts.name,
        company: draft.leads.contacts.company,
      },
      email: {
        subject: draft.email_queue.subject,
        fromAddress: draft.email_queue.from_address,
        fromName: draft.email_queue.from_name,
        threadId: draft.email_queue.gmail_thread_id,
      },
    }));

    return NextResponse.json({ drafts: formattedDrafts });
  } catch (error: any) {
    console.error("[Prepared Follow-ups] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch prepared drafts" },
      { status: 500 }
    );
  }
}

