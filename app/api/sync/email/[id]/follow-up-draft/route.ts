import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { generateFollowUpDraft } from "@/lib/sync/generateFollowUpDraft";
import { getLeadByContactEmail } from "@/lib/sync/crm";
import { isFollowUpSuggestionsEnabled } from "@/lib/sync/featureFlags";

/**
 * POST /api/sync/email/[id]/follow-up-draft
 * Generate a follow-up draft for an email/lead
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!isFollowUpSuggestionsEnabled()) {
      return NextResponse.json(
        { error: "Follow-up suggestions are disabled" },
        { status: 403 }
      );
    }

    const supabase = getSupabaseServerClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken || accessToken === "dev-token") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = userResult.user.id;
    const emailId = params.id;

    // Get email
    const { data: email, error: emailError } = await supabase
      .from("email_queue")
      .select("id, from_address, gmail_thread_id")
      .eq("id", emailId)
      .eq("user_id", userId)
      .single();

    if (emailError || !email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Get lead by contact email
    const lead = await getLeadByContactEmail(userId, email.from_address);
    if (!lead) {
      return NextResponse.json(
        { error: "No lead found for this email" },
        { status: 404 }
      );
    }

    // Get contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", lead.contact_id)
      .eq("user_id", userId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    // Get follow-up reason if available
    const { data: followUpSuggestion } = await supabase
      .from("lead_follow_up_suggestions")
      .select("reason")
      .eq("lead_id", lead.id)
      .eq("status", "pending")
      .maybeSingle();

    // Generate draft
    const draft = await generateFollowUpDraft({
      userId,
      emailId,
      threadId: email.gmail_thread_id || undefined,
      lead,
      contact,
      followUpReason: followUpSuggestion?.reason,
    });

    return NextResponse.json({
      success: true,
      draft,
    });
  } catch (error: any) {
    console.error("[FollowUpDraft] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate follow-up draft" },
      { status: 500 }
    );
  }
}


