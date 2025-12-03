/**
 * Studio Overview API
 * 
 * GET /api/studio/overview
 * 
 * Returns branding and content intelligence overview
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIdFromAuth } from "@/lib/workspace-helpers";
import { getMemoryFacts } from "@/lib/insight/memory";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const workspaceId = await getWorkspaceIdFromAuth();
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get memory facts for brand information
    const memoryFacts = await getMemoryFacts(workspaceId, 0.5);

    // Extract brand facts from memory
    const brandFacts: {
      tone?: string;
      keywords?: string[];
      colors?: string[];
      audience?: string;
    } = {};

    memoryFacts.forEach((fact) => {
      if (fact.key.includes("brand") || fact.key.includes("tone")) {
        if (fact.key.includes("tone")) {
          brandFacts.tone = fact.value.tone || fact.value.value;
        }
        if (fact.key.includes("keyword")) {
          brandFacts.keywords = fact.value.keywords || fact.value.value;
        }
        if (fact.key.includes("color")) {
          brandFacts.colors = fact.value.colors || fact.value.value;
        }
        if (fact.key.includes("audience")) {
          brandFacts.audience = fact.value.audience || fact.value.value;
        }
      }
    });

    // Fetch recent studio assets (if studio_assets table exists)
    // For now, we'll use a placeholder
    const recentAssets: any[] = [];

    // Try to fetch from studio_assets if it exists
    try {
      const { data: assets } = await supabase
        .from("studio_assets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (assets) {
        recentAssets.push(...assets);
      }
    } catch (e) {
      // Table might not exist, that's okay
    }

    return NextResponse.json({
      ok: true,
      data: {
        recentAssets: recentAssets.map((asset) => ({
          id: asset.id,
          name: asset.name || asset.filename,
          type: asset.type,
          createdAt: asset.created_at,
          previewUrl: asset.preview_url || asset.url,
        })),
        brandFacts,
      },
    });
  } catch (error: any) {
    console.error("Error in studio overview endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}



