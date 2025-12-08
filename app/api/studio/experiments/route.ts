/**
 * Studio Experiments API
 * 
 * GET /api/studio/experiments
 * List experiments for the workspace
 * 
 * POST /api/studio/experiments
 * Create a new experiment
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import {
  createExperiment,
  getWorkspaceExperiments,
  type ExperimentType,
} from "@/lib/studio/experiment-service";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as any;
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const experiments = await getWorkspaceExperiments(workspaceId, {
      status: status || undefined,
      limit,
      supabaseClient,
    });

    // Get variant counts for each experiment
    const experimentsWithCounts = await Promise.all(
      experiments.map(async (exp) => {
        const { count } = await supabaseClient
          .from("studio_social_posts")
          .select("*", { count: "exact", head: true })
          .eq("experiment_id", exp.id);

        return {
          ...exp,
          variant_count: count || 0,
        };
      })
    );

    return NextResponse.json(
      {
        ok: true,
        data: { experiments: experimentsWithCounts },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio experiments GET endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

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
    const { name, type, description, post_ids } = body;

    // Validation
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { ok: false, error: "name is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (!type || !["caption", "hook", "time", "hashtags", "media", "other"].includes(type)) {
      return NextResponse.json(
        { ok: false, error: "type must be one of: caption, hook, time, hashtags, media, other" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (!post_ids || !Array.isArray(post_ids) || post_ids.length < 2) {
      return NextResponse.json(
        { ok: false, error: "post_ids array with at least 2 posts is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Create experiment
    const experiment = await createExperiment(
      workspaceId,
      user.id,
      {
        name,
        type: type as ExperimentType,
        description,
        post_ids,
      },
      supabaseClient
    );

    // Get variant mapping
    const { data: posts } = await supabaseClient
      .from("studio_social_posts")
      .select("id, experiment_variant_label")
      .eq("experiment_id", experiment.id)
      .in("id", post_ids);

    const variantMap: Record<string, string> = {};
    posts?.forEach((post) => {
      if (post.experiment_variant_label) {
        variantMap[post.id] = post.experiment_variant_label;
      }
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          experiment,
          variant_map: variantMap,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio experiments POST endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

