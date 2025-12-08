import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getOrCreateWorkspace, getWorkspaceIntegration } from "@/lib/sync/integrations";
import { createErrorResponse } from "@/lib/validation";

/**
 * POST /api/sync/calendar/start
 * 
 * Creates a Calendar sync job
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

    // Get Calendar integration
    const integration = await getWorkspaceIntegration(
      workspace.id,
      "google_calendar"
    );

    if (!integration) {
      return createErrorResponse(
        "Calendar integration not found. Please connect Google Calendar first.",
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
        job_type: "calendar_initial",
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
    console.error("Error starting Calendar sync:", error);
    return createErrorResponse(
      error.message || "Failed to start Calendar sync",
      500
    );
  }
}




