/**
 * Studio Report Detail API
 * 
 * GET /api/studio/reports/[reportId]
 * Get a specific report by ID
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getReport } from "@/lib/studio/report-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
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

    const { reportId } = await params;

    const report = await getReport(reportId, supabaseClient);

    if (!report) {
      return NextResponse.json(
        { ok: false, error: "Report not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Verify report belongs to workspace
    if (report.workspace_id !== workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Report not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: { report },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio report detail endpoint:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

