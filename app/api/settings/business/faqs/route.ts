import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getBusinessProfileByUserId, upsertBusinessFAQ } from "@/lib/sync/businessInfo";

/**
 * POST /api/settings/business/faqs
 * Create or update a FAQ
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const body = await request.json();
    const { id, question, answer } = body;

    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    if (!answer || !answer.trim()) {
      return NextResponse.json(
        { error: "Answer is required" },
        { status: 400 }
      );
    }

    const profile = await getBusinessProfileByUserId(userId);
    if (!profile) {
      return NextResponse.json(
        { error: "Business profile not found. Please create a business profile first." },
        { status: 404 }
      );
    }

    const faq = await upsertBusinessFAQ(profile.id, id, {
      question: question.trim(),
      answer: answer.trim(),
    });

    return NextResponse.json({ faq });
  } catch (error: any) {
    console.error("[Business Settings] Error managing FAQ:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save FAQ" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/business/faqs?id=...
 * Delete a FAQ
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const searchParams = request.nextUrl.searchParams;
    const faqId = searchParams.get("id");

    if (!faqId) {
      return NextResponse.json(
        { error: "FAQ ID is required" },
        { status: 400 }
      );
    }

    const profile = await getBusinessProfileByUserId(userId);
    if (!profile) {
      return NextResponse.json(
        { error: "Business profile not found" },
        { status: 404 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from("business_faqs")
      .delete()
      .eq("id", faqId)
      .eq("business_id", profile.id);

    if (error) {
      throw new Error(`Failed to delete FAQ: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Business Settings] Error deleting FAQ:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete FAQ" },
      { status: 500 }
    );
  }
}


