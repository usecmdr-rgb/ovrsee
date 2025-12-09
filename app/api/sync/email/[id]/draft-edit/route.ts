import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { updateDraftWithInstructions } from "@/lib/sync/updateDraftWithInstructions";
import { z } from "zod";

const draftEditSchema = z.object({
  instructions: z.string().min(1, "Instructions are required"),
  draftBody: z.string().min(1, "Draft body is required"),
});

/**
 * POST /api/sync/email/[id]/draft-edit
 * Update an email draft based on user instructions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const { id: emailId } = await params;
    const supabase = getSupabaseServerClient();

    // Parse and validate request body
    const body = await request.json();
    const parsed = draftEditSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 }
      );
    }

    const { instructions, draftBody } = parsed.data;

    // Verify email ownership
    const { data: email, error: emailError } = await supabase
      .from("email_queue")
      .select("id, subject, body_text, body_html, gmail_thread_id, from_address, from_name")
      .eq("id", emailId)
      .eq("user_id", userId)
      .single();

    if (emailError || !email) {
      return NextResponse.json(
        { error: "Email not found or access denied" },
        { status: 404 }
      );
    }

    // Update draft with instructions
    const result = await updateDraftWithInstructions({
      userId,
      emailId: email.id,
      threadId: email.gmail_thread_id || undefined,
      currentDraft: draftBody,
      instructions,
      emailSubject: email.subject || undefined,
      fromAddress: email.from_address || undefined,
    });

    return NextResponse.json({
      ok: true,
      draftBody: result.draftBody,
      explanation: result.explanation,
    });
  } catch (error: any) {
    console.error("[Draft Edit] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update draft" },
      { status: 500 }
    );
  }
}


