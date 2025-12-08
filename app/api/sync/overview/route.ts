/**
 * Sync Overview API
 * 
 * GET /api/sync/overview
 * 
 * Returns email and calendar intelligence overview
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIdFromAuth } from "@/lib/workspace-helpers";
import { getMemoryFacts, getImportantRelationships } from "@/lib/insight/memory";

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

    // Get memory facts for email patterns
    const memoryFacts = await getMemoryFacts(workspaceId, 0.5);
    const relationships = await getImportantRelationships(workspaceId, 60);

    // Fetch unread important emails
    const { data: importantEmails } = await supabase
      .from("email_summaries")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_important", true)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(20);

    // Calculate stale threads (emails with no reply in 7+ days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: allEmails } = await supabase
      .from("email_summaries")
      .select("*")
      .eq("user_id", user.id)
      .lte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    const staleThreads = (allEmails || []).filter((email) => {
      // Consider stale if no reply and older than 7 days
      return !email.is_read && new Date(email.created_at) < sevenDaysAgo;
    });

    // Find follow-ups (emails that need response)
    const followUps = (importantEmails || []).filter(
      (email) => !email.is_read && email.is_important
    );

    // Build priority inbox (emails from important contacts)
    const priorityInbox = (importantEmails || [])
      .map((email) => {
        const sender = email.sender || email.from_address;
        const relationship = relationships.find(
          (r) => r.entityIdentifier === sender || r.displayName === sender
        );
        return {
          ...email,
          importanceScore: relationship?.importanceScore || 50,
        };
      })
      .sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0))
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      data: {
        unreadImportantCount: importantEmails?.length || 0,
        staleThreads: staleThreads.slice(0, 10).map((email) => ({
          id: email.id,
          subject: email.subject || "No subject",
          from: email.sender || email.from_address,
          receivedAt: email.created_at,
          daysOld: Math.floor(
            (Date.now() - new Date(email.created_at).getTime()) /
              (1000 * 60 * 60 * 24)
          ),
        })),
        followUps: followUps.slice(0, 10).map((email) => ({
          id: email.id,
          subject: email.subject || "No subject",
          from: email.sender || email.from_address,
          receivedAt: email.created_at,
          category: email.category,
        })),
        priorityInbox: priorityInbox.map((email) => ({
          id: email.id,
          subject: email.subject || "No subject",
          from: email.sender || email.from_address,
          receivedAt: email.created_at,
          importanceScore: email.importanceScore,
        })),
      },
    });
  } catch (error: any) {
    console.error("Error in sync overview endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}




