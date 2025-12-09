/**
 * Gmail Sync Cron Job
 * 
 * GET /api/cron/sync/gmail
 * 
 * Automatically sync Gmail for all active integrations
 * Runs periodically (e.g., every 5-15 minutes)
 * 
 * This endpoint can be called by:
 * - Vercel Cron (configured in vercel.json)
 * - Supabase cron
 * - External scheduler
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { incrementalGmailSync } from "@/lib/gmail/sync";
import { logInfo, logError, logWarn } from "@/lib/studio/logging";

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    await logInfo("cron_gmail_sync_start", {});

    // Verify cron secret (if configured)
    const { searchParams } = new URL(request.url);
    const providedSecret = searchParams.get("secret");

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      await logWarn("cron_gmail_sync_unauthorized", {});
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Get all active Gmail integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from("integrations")
      .select("id, workspace_id, user_id, metadata, last_synced_at, sync_status")
      .eq("provider", "gmail")
      .eq("is_active", true)
      .in("sync_status", ["connected", "idle", "error"]); // Only sync active/connected integrations

    if (integrationsError) {
      await logError("cron_gmail_sync_fetch_error", {
        error: integrationsError.message,
      });
      return NextResponse.json(
        { error: "Failed to fetch integrations", details: integrationsError.message },
        { status: 500 }
      );
    }

    if (!integrations || integrations.length === 0) {
      await logInfo("cron_gmail_sync_no_integrations", {});
      return NextResponse.json({
        success: true,
        message: "No active Gmail integrations to sync",
        synced: 0,
      });
    }

    await logInfo("cron_gmail_sync_found_integrations", {
      count: integrations.length,
    });

    const results: Array<{
      userId: string;
      workspaceId: string;
      success: boolean;
      synced?: number;
      updated?: number;
      errors?: number;
      error?: string;
    }> = [];

    // Sync each integration
    for (const integration of integrations) {
      const userId = integration.user_id;
      const workspaceId = integration.workspace_id;

      if (!userId) {
        await logWarn("cron_gmail_sync_missing_user_id", {
          integrationId: integration.id,
        });
        continue;
      }

      try {
        await logInfo("cron_gmail_sync_integration_start", {
          integrationId: integration.id,
          userId,
          workspaceId,
        });

        // Run incremental sync
        const result = await incrementalGmailSync(userId);

        results.push({
          userId,
          workspaceId,
          success: true,
          synced: result.synced,
          updated: result.updated,
          errors: result.errors,
        });

        await logInfo("cron_gmail_sync_integration_success", {
          integrationId: integration.id,
          userId,
          workspaceId,
          synced: result.synced,
          updated: result.updated,
          errors: result.errors,
        });
      } catch (error: any) {
        const errorMessage = error.message || "Unknown error";
        results.push({
          userId,
          workspaceId,
          success: false,
          error: errorMessage,
        });

        await logError("cron_gmail_sync_integration_error", {
          integrationId: integration.id,
          userId,
          workspaceId,
          error: errorMessage,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalSynced = results.reduce((sum, r) => sum + (r.synced || 0), 0);
    const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0);

    await logInfo("cron_gmail_sync_complete", {
      total: integrations.length,
      successful,
      failed,
      totalSynced,
      totalUpdated,
    });

    return NextResponse.json({
      success: true,
      total: integrations.length,
      successful,
      failed,
      totalSynced,
      totalUpdated,
      results,
    });
  } catch (error: any) {
    await logError("cron_gmail_sync_exception", {
      error: error.message || "Unknown error",
      stack: error.stack,
    });

    console.error("Error in Gmail sync cron job:", error);
    return NextResponse.json(
      {
        error: "Cron job failed",
        details: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

