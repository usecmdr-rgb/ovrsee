/**
 * POST /api/sync/email/categorize
 * 
 * Categorize emails on-demand using AI
 * Only categorizes emails where category is null
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { classifyEmail } from "@/lib/sync/classifyEmail";

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "ids must be a non-empty array" },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (ids.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 emails per request" },
        { status: 400 }
      );
    }

    // Fetch emails that need categorization
    const { data: emails, error: fetchError } = await supabase
      .from("email_queue")
      .select("id, from_address, subject, body_text, category")
      .eq("user_id", userId)
      .in("id", ids)
      .is("deleted_at", null);

    if (fetchError) {
      console.error("[Categorize] Error fetching emails:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch emails" },
        { status: 500 }
      );
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({
        items: [],
      });
    }

    // Categorize emails (only those without category)
    const results: Array<{ id: string; category: string }> = [];
    const updates: Array<{
      id: string;
      category: string;
      classification_raw: any;
    }> = [];

    for (const email of emails) {
      // Skip if already categorized
      if (email.category) {
        results.push({
          id: email.id,
          category: email.category,
        });
        continue;
      }

      try {
        // Classify the email
        const classification = await classifyEmail(
          email.from_address || "",
          email.subject || "(No subject)",
          email.body_text || null
        );

        // Store update
        updates.push({
          id: email.id,
          category: classification.category,
          classification_raw: classification.rawResponse,
        });

        results.push({
          id: email.id,
          category: classification.category,
        });
      } catch (error: any) {
        console.error(`[Categorize] Error classifying email ${email.id}:`, error);
        // On error, default to "other"
        updates.push({
          id: email.id,
          category: "other",
          classification_raw: { error: error.message || "classification_failed" },
        });
        results.push({
          id: email.id,
          category: "other",
        });
      }
    }

    // Batch update emails in database
    if (updates.length > 0) {
      // Use Promise.all for parallel updates (Supabase doesn't support batch update easily)
      const updatePromises = updates.map((update) =>
        supabase
          .from("email_queue")
          .update({
            category: update.category,
            classification_raw: update.classification_raw,
            updated_at: new Date().toISOString(),
          })
          .eq("id", update.id)
          .eq("user_id", userId)
      );

      const updateResults = await Promise.all(updatePromises);
      
      // Check for errors
      const hasErrors = updateResults.some((result) => result.error);
      if (hasErrors) {
        console.error("[Categorize] Some updates failed:", updateResults);
        // Continue anyway - we'll return what we have
      }
    }

    return NextResponse.json({
      items: results,
    });
  } catch (error: any) {
    console.error("[Categorize] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to categorize emails" },
      { status: 500 }
    );
  }
}


