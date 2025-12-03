/**
 * GET /api/sync/calendar/alerts
 * POST /api/sync/calendar/alerts
 * 
 * Get and create calendar alerts
 * 
 * Note: This assumes a sync_calendar_alerts table exists. If it doesn't,
 * create it with:
 * - id (UUID, primary key)
 * - workspace_id (UUID, foreign key to workspaces)
 * - label (TEXT)
 * - rule (JSONB)
 * - enabled (BOOLEAN)
 * - created_at, updated_at (TIMESTAMPTZ)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";

export async function GET(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Try to query sync_calendar_alerts table
    // If table doesn't exist, return empty array
    const { data: alerts, error: alertsError } = await supabaseClient
      .from("sync_calendar_alerts")
      .select("id, label, rule, enabled")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (alertsError) {
      // If table doesn't exist, return empty array
      if (alertsError.code === "42P01" || alertsError.message?.includes("does not exist")) {
        return NextResponse.json({
          items: [],
        }, { headers: responseHeaders });
      }
      
      console.error("[Sync Calendar Alerts GET] Error:", alertsError);
      return NextResponse.json(
        { error: "Failed to fetch alerts" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Map to response format
    const items = (alerts || []).map((alert) => ({
      id: alert.id,
      label: alert.label,
      rule: alert.rule,
      enabled: alert.enabled,
    }));

    return NextResponse.json({
      items,
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Sync Calendar Alerts GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
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
        { error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const body = await request.json();

    const { label, rule, enabled } = body;

    if (!label || typeof label !== "string") {
      return NextResponse.json(
        { error: "label is required and must be a string" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (rule === undefined) {
      return NextResponse.json(
        { error: "rule is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Try to insert into sync_calendar_alerts table
    const { data: alert, error: insertError } = await supabaseClient
      .from("sync_calendar_alerts")
      .insert({
        workspace_id: workspaceId,
        label: label.trim(),
        rule: rule,
        enabled: enabled !== undefined ? !!enabled : true,
      })
      .select()
      .single();

    if (insertError) {
      // If table doesn't exist, return error with helpful message
      if (insertError.code === "42P01" || insertError.message?.includes("does not exist")) {
        return NextResponse.json(
          { 
            error: "Calendar alerts table does not exist. Please create sync_calendar_alerts table first.",
            code: "TABLE_NOT_FOUND"
          },
          { status: 500, headers: responseHeaders }
        );
      }

      console.error("[Sync Calendar Alerts POST] Error:", insertError);
      return NextResponse.json(
        { error: "Failed to create alert" },
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json({
      id: alert.id,
      label: alert.label,
      rule: alert.rule,
      enabled: alert.enabled,
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Sync Calendar Alerts POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to create alert" },
      { status: 500 }
    );
  }
}
