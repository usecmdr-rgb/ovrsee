import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { runSyncChat } from "@/lib/sync/copilotChat";
import { z } from "zod";

const chatRequestSchema = z.object({
  message: z.string().min(1, "Message is required"),
  draftBody: z.string().nullable().optional(),
});

/**
 * POST /api/sync/email/[id]/chat
 * Conversational agent for email context
 * Can answer questions, provide suggestions, and optionally update drafts
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const emailId = params.id;
    const supabase = getSupabaseServerClient();

    // Parse and validate request body
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors },
        { status: 400 }
      );
    }

    const { message, draftBody: providedDraftBody } = parsed.data;

    // Get email details and verify ownership
    const { data: email, error: emailError } = await supabase
      .from("email_queue")
      .select("id, subject, body_text, body_html, gmail_thread_id, from_address, from_name, ai_draft")
      .eq("id", emailId)
      .eq("user_id", userId)
      .single();

    if (emailError || !email) {
      return NextResponse.json(
        { error: "Email not found or access denied" },
        { status: 404 }
      );
    }

    // Use provided draftBody or fall back to email's ai_draft
    const currentDraft = providedDraftBody !== undefined ? providedDraftBody : (email.ai_draft || null);

    // Run the copilot chat
    const chatResponse = await runSyncChat({
      userId,
      emailId: email.id,
      userMessage: message,
      draftBody: currentDraft,
      threadId: email.gmail_thread_id || undefined,
      emailSubject: email.subject || undefined,
      fromAddress: email.from_address || undefined,
    });

    // Return the structured response
    return NextResponse.json({
      ok: true,
      ...chatResponse,
    });
  } catch (error: any) {
    console.error("[Email Chat] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process chat message" },
      { status: 500 }
    );
  }
}
