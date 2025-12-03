import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { createErrorResponse } from "@/lib/validation";
import { getOpenKnowledgeGaps, resolveKnowledgeGap } from "@/lib/knowledge-gap-logger";

/**
 * GET /api/knowledge-gaps
 * 
 * Get all knowledge gaps for the authenticated user
 * 
 * Query params:
 * - status: Filter by status ('open', 'resolved', 'ignored')
 * - agent: Filter by agent
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "open";
    const agent = searchParams.get("agent");

    const supabase = getSupabaseServerClient();

    let query = supabase
      .from("agent_knowledge_gaps")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (agent) {
      query = query.eq("agent", agent);
    }

    const { data: gaps, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ gaps: gaps || [] });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }
    return createErrorResponse("Failed to fetch knowledge gaps", 500, error);
  }
}

/**
 * POST /api/knowledge-gaps
 * 
 * Create a knowledge gap (typically called by agents)
 * 
 * Body:
 * - agent, source, question, requestedInfo, suggestedCategory, contextId, contextMetadata
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const body = await request.json();

    // Import the logger function
    const { logKnowledgeGap } = await import("@/lib/knowledge-gap-logger");

    const gapId = await logKnowledgeGap({
      userId: user.id,
      agent: body.agent,
      source: body.source,
      question: body.question,
      requestedInfo: body.requestedInfo,
      suggestedCategory: body.suggestedCategory,
      contextId: body.contextId,
      contextMetadata: body.contextMetadata,
    });

    return NextResponse.json({
      success: true,
      gapId,
      message: "Knowledge gap logged successfully",
    });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }
    return createErrorResponse("Failed to log knowledge gap", 500, error);
  }
}













