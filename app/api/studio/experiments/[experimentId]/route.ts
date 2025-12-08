/**
 * Studio Experiment Detail API
 * 
 * GET /api/studio/experiments/[experimentId]
 * Get experiment details with results
 * 
 * POST /api/studio/experiments/[experimentId]/finalize
 * Mark experiment as completed
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import {
  getExperiment,
  computeExperimentResults,
  summarizeExperimentResults,
} from "@/lib/studio/experiment-service";

export async function GET(
  request: NextRequest,
  { params }: { params: { experimentId: string } }
) {
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

    const experimentId = params.experimentId;

    // Get experiment
    const experiment = await getExperiment(experimentId, supabaseClient);
    if (!experiment) {
      return NextResponse.json(
        { ok: false, error: "Experiment not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Verify workspace ownership
    if (experiment.workspace_id !== workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Experiment not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Get variant posts
    const { data: posts, error: postsError } = await supabaseClient
      .from("studio_social_posts")
      .select(`
        id,
        platform,
        caption,
        status,
        scheduled_for,
        published_at,
        experiment_variant_label,
        predicted_score_label,
        predicted_score_numeric
      `)
      .eq("experiment_id", experimentId)
      .eq("workspace_id", workspaceId)
      .order("experiment_variant_label", { ascending: true });

    if (postsError) {
      console.error("Error fetching experiment posts:", postsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch experiment posts" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Compute results
    const results = await computeExperimentResults(experimentId, supabaseClient);

    // Generate summary if not already stored
    let summary = experiment.summary_markdown;
    if (!summary && results.total_impressions >= 500) {
      try {
        summary = await summarizeExperimentResults(experimentId, supabaseClient);
        // Optionally save summary (for now, just return it)
      } catch (error) {
        console.error("Error generating summary:", error);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          experiment,
          variant_posts: posts || [],
          results,
          summary,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio experiment detail endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { experimentId: string } }
) {
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

    const experimentId = params.experimentId;
    const body = await request.json();
    const { action } = body;

    // Get experiment
    const experiment = await getExperiment(experimentId, supabaseClient);
    if (!experiment || experiment.workspace_id !== workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Experiment not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    if (action === "finalize") {
      // Compute final results
      const results = await computeExperimentResults(experimentId, supabaseClient);

      // Generate summary
      let summary: string | null = null;
      try {
        summary = await summarizeExperimentResults(experimentId, supabaseClient);
      } catch (error) {
        console.error("Error generating summary:", error);
      }

      // Update experiment
      const { data: updatedExperiment, error: updateError } = await supabaseClient
        .from("studio_experiments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          winner_variant_label: results.winner_variant_label,
          summary_markdown: summary,
        })
        .eq("id", experimentId)
        .eq("workspace_id", workspaceId)
        .select()
        .single();

      if (updateError || !updatedExperiment) {
        return NextResponse.json(
          { ok: false, error: "Failed to finalize experiment" },
          { status: 500, headers: responseHeaders }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          data: {
            experiment: updatedExperiment,
            results,
            summary,
          },
        },
        { headers: responseHeaders }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action" },
      { status: 400, headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio experiment finalize endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

