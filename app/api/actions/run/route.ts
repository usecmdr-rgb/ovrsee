/**
 * Action Runner API
 * 
 * POST /api/actions/run
 * 
 * Executes an action and returns redirect URL if needed
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIdFromAuth } from "@/lib/workspace-helpers";
import type { InsightActionType } from "@/lib/insight/actions";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { actionId, type, payload } = body;

    if (!actionId || !type) {
      return NextResponse.json(
        { error: "Missing actionId or type" },
        { status: 400 }
      );
    }

    let redirectUrl: string | undefined;

    switch (type as InsightActionType) {
      case "draft_email": {
        // Redirect to sync page with email pre-selected
        const emailId = payload?.emailId;
        redirectUrl = emailId ? `/sync?email=${emailId}` : "/sync";
        break;
      }

      case "create_task": {
        // Create task in database (if tasks table exists)
        // For now, just redirect to insight page
        redirectUrl = "/insight";
        break;
      }

      case "create_event": {
        // Redirect to sync calendar tab
        redirectUrl = "/sync?tab=calendar";
        break;
      }

      case "start_call": {
        // Redirect to Aloha page
        redirectUrl = "/aloha";
        break;
      }

      case "open_contact": {
        // Redirect to Aloha contacts
        const contactId = payload?.contactId;
        redirectUrl = contactId ? `/aloha/contacts?contact=${contactId}` : "/aloha/contacts";
        break;
      }

      case "open_email": {
        // Redirect to sync with email
        const emailId = payload?.emailId;
        redirectUrl = emailId ? `/sync?email=${emailId}` : "/sync";
        break;
      }

      case "open_workflow": {
        // Redirect to insight workflows
        redirectUrl = "/insight";
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unknown action type" },
          { status: 400 }
        );
    }

    // Mark insight as read if action came from insight
    if (actionId.startsWith("insight-")) {
      const insightId = actionId.split("-")[1];
      if (insightId) {
        await supabase
          .from("insights")
          .update({ is_read: true })
          .eq("id", insightId)
          .eq("user_id", user.id);
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      redirectUrl,
    });
  } catch (error: any) {
    console.error("Error in actions run endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}




