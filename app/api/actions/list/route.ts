/**
 * Action Registry API
 * 
 * GET /api/actions/list
 * 
 * Returns available actions from insights, sync, aloha, and studio
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIdFromAuth } from "@/lib/workspace-helpers";
import { getImportantRelationships } from "@/lib/insight/memory";
import type { InsightAction } from "@/lib/insight/actions";

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

    const actions: InsightAction[] = [];

    // 1. Actions from insights
    const { data: insights } = await supabase
      .from("insights")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(20);

    insights?.forEach((insight) => {
      if (insight.actions && Array.isArray(insight.actions)) {
        insight.actions.forEach((actionData: any, idx: number) => {
          actions.push({
            id: `insight-${insight.id}-${idx}`,
            type: actionData.type || "create_task",
            label: actionData.label || "Take action",
            description: actionData.description,
            payload: { ...actionData.payload, insightId: insight.id },
            source: "insight",
          });
        });
      }
    });

    // 2. Actions from Sync (important emails needing reply)
    const { data: emails } = await supabase
      .from("email_summaries")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_important", true)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10);

    emails?.forEach((email) => {
      actions.push({
        id: `sync-email-${email.id}`,
        type: "draft_email",
        label: `Reply to ${email.sender || email.from_address}`,
        description: email.subject || "Important email needs response",
        payload: { emailId: email.id, subject: email.subject, from: email.sender },
        source: "sync",
      });
    });

    // 3. Actions from Aloha (missed calls from important contacts)
    const relationships = await getImportantRelationships(workspaceId, 60);
    const { data: calls } = await supabase
      .from("calls")
      .select("*")
      .eq("user_id", user.id)
      .eq("outcome", "missed")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10);

    calls?.forEach((call) => {
      const contactId = call.caller_phone_number || call.caller_email;
      const relationship = relationships.find(
        (r) => r.entityIdentifier === contactId
      );
      
      // Only include if from important contact or recent
      if (relationship || new Date(call.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
        actions.push({
          id: `aloha-call-${call.id}`,
          type: "start_call",
          label: `Return call to ${call.caller_name || "caller"}`,
          description: call.summary || "Missed call requires follow-up",
          payload: {
            callId: call.id,
            phoneNumber: call.caller_phone_number,
            contactName: call.caller_name,
          },
          source: "aloha",
        });
      }
    });

    // 4. Actions from Studio (workflow candidates)
    // This would come from studio assets that need workflows
    // For now, we'll skip this as it requires studio-specific logic

    // Sort by priority (insights first, then by recency)
    actions.sort((a, b) => {
      if (a.source === "insight" && b.source !== "insight") return -1;
      if (a.source !== "insight" && b.source === "insight") return 1;
      return 0;
    });

    return NextResponse.json({ ok: true, data: actions.slice(0, 20) });
  } catch (error: any) {
    console.error("Error in actions list endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}




