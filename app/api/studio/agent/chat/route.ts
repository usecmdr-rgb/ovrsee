/**
 * Studio Agent Chat API
 * 
 * POST /api/studio/agent/chat
 * 
 * LLM-powered Studio agent for branding and content questions
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getMemoryFacts } from "@/lib/insight/memory";
import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";

export async function POST(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const body = await request.json();
    const { message, assetId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { ok: false, error: "Message is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Get memory facts for brand information
    const memoryFacts = await getMemoryFacts(workspaceId, 0.5);

    // Extract brand context from memory
    const brandContext: any = {};
    memoryFacts.forEach((fact) => {
      if (fact.key.includes("brand") || fact.key.includes("tone") || fact.key.includes("style")) {
        brandContext[fact.key] = fact.value;
      }
    });

    // Fetch asset if assetId is provided
    let assetContext: any = null;
    if (assetId) {
      const { data: asset } = await supabaseClient
        .from("studio_assets")
        .select("*")
        .eq("id", assetId)
        .eq("workspace_id", workspaceId)
        .single();

      if (asset) {
        assetContext = {
          id: asset.id,
          name: asset.name || asset.filename,
          type: asset.asset_type,
          mime_type: asset.mime_type,
          url: asset.url || asset.preview_url,
          width: asset.width,
          height: asset.height,
        };
      }
    }

    // Fetch recent studio assets for context
    let recentAssets: any[] = [];
    try {
      const { data: assets } = await supabaseClient
        .from("studio_assets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (assets) {
        recentAssets = assets;
      }
    } catch (e) {
      // Table might not exist
    }

    // Build context
    const context = {
      brandFacts: brandContext,
      assetContext,
      recentAssets: recentAssets.slice(0, 5).map((a) => ({
        name: a.name || a.filename,
        type: a.asset_type,
        createdAt: a.created_at,
      })),
    };

    // Generate answer using LLM
    const systemPrompt = `You are the Studio Agent, a branding and content intelligence coach. You help users understand their brand identity, maintain consistent tone and style, create effective content, and optimize their visual assets.

You have access to:
- Brand facts (tone, keywords, colors, audience)
- Recent content assets
- Memory about brand preferences and style
${assetContext ? "- Current asset being edited" : ""}

Be creative, insightful, and brand-focused. When suggesting actions, format them as JSON with type and label. When suggesting assets, include relevant details.`;

    const userPrompt = `User message: ${message}

Context:
${JSON.stringify(context, null, 2)}

Provide a helpful answer and suggest 2-3 actionable next steps or content ideas. Return JSON with:
- answer: string
- suggestedAssets: array of {type: string, label: string, description?: string, tone?: string}`;

    const completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.studio.primaryModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content from LLM");
    }

    const parsed = JSON.parse(content);

    return NextResponse.json(
      {
        ok: true,
        data: {
          answer: parsed.answer || "I couldn't generate an answer.",
          suggestedAssets: parsed.suggestedAssets || [],
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio agent chat endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
