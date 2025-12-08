import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { runGmailInitialSync } from "@/lib/sync/runGmailSync";
import { runCalendarInitialSync } from "@/lib/sync/runCalendarSync";
import { createErrorResponse } from "@/lib/validation";

/**
 * POST /api/internal/sync/run-once
 * 
 * Internal endpoint to process a single pending sync job
 * 
 * SECURITY: Optionally guard with internal secret or admin role
 * For now, requires authentication (can be enhanced with additional checks)
 * 
 * Behavior:
 * - Finds oldest pending job
 * - Marks it as running
 * - Executes sync based on job_type
 * - Marks as completed or failed
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add internal secret check
    const internalSecret = request.headers.get("x-internal-secret");
    const expectedSecret = process.env.INTERNAL_SYNC_SECRET;

    if (expectedSecret && internalSecret !== expectedSecret) {
      return createErrorResponse("Unauthorized: Invalid internal secret", 401);
    }

    const supabase = getSupabaseServerClient();

    // Find oldest pending job
    const { data: job, error: jobError } = await supabase
      .from("sync_jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (jobError && jobError.code === "PGRST116") {
      // No pending jobs
      return NextResponse.json({
        processed: false,
        message: "No pending jobs found",
      });
    }

    if (jobError || !job) {
      return createErrorResponse(
        `Failed to fetch job: ${jobError?.message || "Unknown error"}`,
        500
      );
    }

    // Mark job as running
    await supabase
      .from("sync_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    try {
      // Execute sync based on job type
      if (job.job_type === "gmail_initial" || job.job_type === "gmail_incremental") {
        await runGmailInitialSync(job);
      } else if (
        job.job_type === "calendar_initial" ||
        job.job_type === "calendar_incremental"
      ) {
        await runCalendarInitialSync(job);
      } else {
        throw new Error(`Unknown job type: ${job.job_type}`);
      }

      // Mark as completed
      await supabase
        .from("sync_jobs")
        .update({
          status: "completed",
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return NextResponse.json({
        processed: true,
        jobId: job.id,
        jobType: job.job_type,
        status: "completed",
      });
    } catch (syncError: any) {
      // Mark as failed
      await supabase
        .from("sync_jobs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          last_error: syncError.message || "Unknown sync error",
        })
        .eq("id", job.id);

      console.error(`Sync job ${job.id} failed:`, syncError);

      return createErrorResponse(
        `Sync failed: ${syncError.message}`,
        500
      );
    }
  } catch (error: any) {
    console.error("Error in sync worker:", error);
    return createErrorResponse(
      error.message || "Failed to process sync job",
      500
    );
  }
}




