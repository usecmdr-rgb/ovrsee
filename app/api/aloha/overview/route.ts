/**
 * Aloha Overview API
 * 
 * GET /api/aloha/overview
 * 
 * Returns call intelligence overview
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIdFromAuth } from "@/lib/workspace-helpers";
import { getImportantRelationships } from "@/lib/insight/memory";

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

    const relationships = await getImportantRelationships(workspaceId, 60);

    // Calculate date ranges
    const now = new Date();
    const last7Days = new Date(now);
    last7Days.setDate(last7Days.getDate() - 7);
    const prev7Days = new Date(last7Days);
    prev7Days.setDate(prev7Days.getDate() - 7);

    // Fetch calls from last 7 days
    const { data: recentCalls } = await supabase
      .from("calls")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", last7Days.toISOString())
      .order("created_at", { ascending: false });

    // Fetch calls from previous 7 days for comparison
    const { data: previousCalls } = await supabase
      .from("calls")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", prev7Days.toISOString())
      .lt("created_at", last7Days.toISOString())
      .order("created_at", { ascending: false });

    // Calculate sentiment trend
    const last7Sentiments = (recentCalls || [])
      .map((c) => c.sentiment_score)
      .filter((s) => s != null) as number[];
    const prev7Sentiments = (previousCalls || [])
      .map((c) => c.sentiment_score)
      .filter((s) => s != null) as number[];

    const last7Avg =
      last7Sentiments.length > 0
        ? last7Sentiments.reduce((a, b) => a + b, 0) / last7Sentiments.length
        : 0;
    const prev7Avg =
      prev7Sentiments.length > 0
        ? prev7Sentiments.reduce((a, b) => a + b, 0) / prev7Sentiments.length
        : 0;

    // Find missed calls from important contacts
    const missedCallsImportant = (recentCalls || []).filter((call) => {
      if (call.outcome !== "missed") return false;
      const contactId = call.caller_phone_number || call.caller_email;
      const relationship = relationships.find(
        (r) => r.entityIdentifier === contactId
      );
      return relationship && relationship.importanceScore >= 70;
    });

    // Build important calls list
    const importantCalls = (recentCalls || [])
      .map((call) => {
        const contactId = call.caller_phone_number || call.caller_email;
        const relationship = relationships.find(
          (r) => r.entityIdentifier === contactId
        );
        return {
          ...call,
          importanceScore: relationship?.importanceScore || 0,
        };
      })
      .filter((call) => call.importanceScore >= 60 || call.outcome === "missed")
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .slice(0, 10);

    // Build top contacts
    const contactMap = new Map<string, any>();
    (recentCalls || []).forEach((call) => {
      const contactId = call.caller_phone_number || call.caller_email;
      const relationship = relationships.find(
        (r) => r.entityIdentifier === contactId
      );
      if (relationship) {
        if (!contactMap.has(contactId)) {
          contactMap.set(contactId, {
            contactIdentifier: contactId,
            contactName: relationship.displayName || call.caller_name,
            callCount: 0,
            importanceScore: relationship.importanceScore,
            lastCallAt: call.created_at,
          });
        }
        const entry = contactMap.get(contactId);
        entry.callCount++;
        if (new Date(call.created_at) > new Date(entry.lastCallAt)) {
          entry.lastCallAt = call.created_at;
        }
      }
    });

    const topContacts = Array.from(contactMap.values())
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      data: {
        missedCallsImportant: missedCallsImportant.length,
        sentimentTrend: {
          last7: last7Avg,
          prev7: prev7Avg,
        },
        importantCalls: importantCalls.map((call) => ({
          id: call.id,
          contactIdentifier: call.caller_phone_number || call.caller_email,
          contactName: call.caller_name,
          missed: call.outcome === "missed",
          sentiment: call.sentiment_score,
          importanceScore: call.importanceScore,
          time: call.created_at,
          summary: call.summary,
        })),
        topContacts,
      },
    });
  } catch (error: any) {
    console.error("Error in aloha overview endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}



