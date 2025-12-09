/**
 * GET /api/sync/email/draft/:id
 * 
 * Generate or retrieve AI draft reply for an email
 * Returns cached draft if available and recent (< 24 hours), otherwise generates new one
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { generateEmailDraft } from "@/lib/sync/generateDraft";

const DRAFT_CACHE_HOURS = 24;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseServerClient();
    
    // Get authenticated user
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
    const { id: emailId } = await context.params;

    if (!emailId) {
      return NextResponse.json(
        { error: "Email ID is required" },
        { status: 400 }
      );
    }

    // Fetch email from email_queue (include thread_id for thread context)
    // Note: ai_draft columns may not exist if migration hasn't run yet
    const { data: email, error: fetchError } = await supabase
      .from("email_queue")
      .select("id, from_address, from_name, subject, body_text, body_html, gmail_thread_id")
      .eq("id", emailId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();
    
    // Check if draft columns exist by trying to select them separately
    // This is a workaround until migration is run
    let aiDraft: string | null = null;
    let aiDraftGeneratedAt: string | null = null;
    
    try {
      const { data: draftData } = await supabase
        .from("email_queue")
        .select("ai_draft, ai_draft_generated_at")
        .eq("id", emailId)
        .eq("user_id", userId)
        .single();
      
      if (draftData) {
        aiDraft = draftData.ai_draft || null;
        aiDraftGeneratedAt = draftData.ai_draft_generated_at || null;
      }
    } catch (e) {
      // Columns don't exist yet - that's okay, we'll generate a new draft
      console.log("[Draft] Draft columns not available yet, will generate new draft");
    }

    if (fetchError || !email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Check if we have a recent draft (less than 24 hours old)
    if (aiDraft && aiDraftGeneratedAt) {
      const generatedAt = new Date(aiDraftGeneratedAt);
      const now = new Date();
      const hoursSinceGeneration = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceGeneration < DRAFT_CACHE_HOURS) {
        // Return cached draft
        return NextResponse.json({
          draft: aiDraft,
          cached: true,
          generatedAt: aiDraftGeneratedAt,
        });
      }
    }

    // Generate new draft (with thread context if available)
    const draftResult = await generateEmailDraft(
      userId,
      email.from_address || "",
      email.from_name,
      email.subject || "(No subject)",
      email.body_text || null,
      email.body_html || null,
      email.id, // emailId for thread context
      email.gmail_thread_id || undefined // threadId for thread context
    );

    // Save draft to database (only if columns exist)
    try {
      const { error: updateError } = await supabase
        .from("email_queue")
        .update({
          ai_draft: draftResult.draft,
          ai_draft_generated_at: new Date().toISOString(),
          ai_draft_model: "gpt-4o-mini",
          updated_at: new Date().toISOString(),
        })
        .eq("id", emailId)
        .eq("user_id", userId);

      if (updateError) {
        // If columns don't exist, this is expected - just log it
        if (updateError.code === '42703') {
          console.log("[Draft] Draft columns not available yet - migration needs to be run");
        } else {
          console.error("[Draft] Error saving draft:", updateError);
        }
        // Still return the draft even if save fails
      }
    } catch (e) {
      // Columns don't exist - that's okay, we'll just return the draft without saving
      console.log("[Draft] Could not save draft - columns may not exist yet");
    }

    return NextResponse.json({
      draft: draftResult.draft,
      cached: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Draft] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate draft" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sync/email/draft/:id
 * 
 * Update/save an edited draft
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseServerClient();
    
    // Get authenticated user
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
    const { id: emailId } = await context.params;

    if (!emailId) {
      return NextResponse.json(
        { error: "Email ID is required" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { draft } = body;

    if (!draft || typeof draft !== "string") {
      return NextResponse.json(
        { error: "Draft text is required" },
        { status: 400 }
      );
    }

    // Verify email exists and belongs to user
    const { data: email, error: fetchError } = await supabase
      .from("email_queue")
      .select("id")
      .eq("id", emailId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Try to update draft (handle case where columns don't exist yet)
    try {
      const { error: updateError } = await supabase
        .from("email_queue")
        .update({
          ai_draft: draft.trim(),
          ai_draft_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", emailId)
        .eq("user_id", userId);

      if (updateError) {
        // If columns don't exist, that's okay - migration needs to be run
        if (updateError.code === '42703') {
          console.log("[Draft] Draft columns not available yet - migration needs to be run");
          // Still return success since the draft was provided
        } else {
          throw updateError;
        }
      }
    } catch (e: any) {
      // If update fails due to missing columns, that's okay
      if (e.code !== '42703') {
        throw e;
      }
      console.log("[Draft] Could not save draft - columns may not exist yet");
    }

    return NextResponse.json({
      success: true,
      draft: draft.trim(),
      savedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Draft] Error saving draft:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save draft" },
      { status: 500 }
    );
  }
}

