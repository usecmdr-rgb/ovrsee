import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getOrCreateWorkspace, getWorkspaceIntegration } from "@/lib/sync/integrations";
import { createErrorResponse } from "@/lib/validation";

/**
 * POST /api/sync/gmail/start
 * 
 * Creates a Gmail sync job
 * 
 * Returns:
 * - jobId: string
 * - status: string
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    // Get or create workspace
    const workspace = await getOrCreateWorkspace(userId);

    // Get Gmail integration
    const integration = await getWorkspaceIntegration(workspace.id, "gmail");

    if (!integration) {
      return createErrorResponse(
        "Gmail integration not found. Please connect Gmail first.",
        404
      );
    }

    // Create sync job
    const supabase = getSupabaseServerClient();
    const { data: job, error: jobError } = await supabase
      .from("sync_jobs")
      .insert({
        workspace_id: workspace.id,
        integration_id: integration.id,
        job_type: "gmail_initial",
        status: "pending",
      })
      .select("id, status")
      .single();

    if (jobError || !job) {
      return createErrorResponse(
        `Failed to create sync job: ${jobError?.message || "Unknown error"}`,
        500
      );
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
    });
  } catch (error: any) {
    console.error("Error starting Gmail sync:", error);
    return createErrorResponse(
      error.message || "Failed to start Gmail sync",
      500
    );
  }
}




