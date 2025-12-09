import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { generateCopilotInsights, type CopilotMode } from "@/lib/sync/copilot";
import { isAiCopilotEnabled } from "@/lib/sync/featureFlags";
import { z } from "zod";

const copilotRequestSchema = z.object({
  mode: z.enum(["summary", "next_step", "proposal_hint", "risk_analysis"]),
});

/**
 * POST /api/sync/email/[id]/copilot
 * Generate AI copilot insights for an email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isAiCopilotEnabled()) {
      return NextResponse.json(
        { error: "AI Copilot feature is disabled" },
        { status: 403 }
      );
    }

    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const { id: emailId } = await params;
    const supabase = getSupabaseServerClient();

    const body = await request.json();
    const parsed = copilotRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 }
      );
    }

    const { mode } = parsed.data;

    // Get email details
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

    // Get lead if available
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", userId)
      .eq("last_email_id", emailId)
      .maybeSingle();

    const emailContent = email.body_text || email.body_html?.replace(/<[^>]*>/g, " ") || "";

    // Generate insights
    const insights = await generateCopilotInsights(
      {
        userId,
        emailId: email.id,
        threadId: email.gmail_thread_id || undefined,
        emailContent,
        emailSubject: email.subject || "",
        lead: lead || undefined,
        contactName: email.from_name || undefined,
      },
      mode as CopilotMode
    );

    return NextResponse.json({
      ok: true,
      insights,
    });
  } catch (error: any) {
    console.error("[Copilot] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate copilot insights" },
      { status: 500 }
    );
  }
}


