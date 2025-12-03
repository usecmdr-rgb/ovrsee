/**
 * GET /api/sync/email/stats
 * 
 * Returns email statistics for the authenticated user's workspace
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

    // Get time range (default to last 30 days)
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const now = new Date();
    const to = toParam ? new Date(toParam) : now;
    const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Query sync_email_messages
    const { data: messages, error: messagesError } = await supabaseClient
      .from("sync_email_messages")
      .select("labels, subject, snippet, is_read, internal_date")
      .eq("workspace_id", workspaceId)
      .gte("internal_date", from.toISOString())
      .lte("internal_date", to.toISOString());

    if (messagesError) {
      console.error("[Sync Email Stats] Error:", messagesError);
      return NextResponse.json(
        { error: "Failed to fetch email statistics" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Calculate stats
    let importantEmails = 0;
    let paymentsBills = 0;
    let invoices = 0;
    let missedEmails = 0;

    (messages || []).forEach((msg) => {
      // Check for important label
      if (msg.labels && Array.isArray(msg.labels)) {
        if (msg.labels.includes("IMPORTANT") || msg.labels.some((l: string) => l.toLowerCase().includes("important"))) {
          importantEmails++;
        }
      }

      // Heuristic for payments/bills
      const subjectLower = (msg.subject || "").toLowerCase();
      const snippetLower = (msg.snippet || "").toLowerCase();
      const searchText = `${subjectLower} ${snippetLower}`;
      
      if (searchText.includes("invoice") || searchText.includes("bill") || searchText.includes("payment")) {
        if (searchText.includes("invoice")) {
          invoices++;
        } else {
          paymentsBills++;
        }
      }

      // Missed emails = unread and older than 24 hours
      if (!msg.is_read && msg.internal_date) {
        const messageDate = new Date(msg.internal_date);
        const hoursAgo = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);
        if (hoursAgo > 24) {
          missedEmails++;
        }
      }
    });

    return NextResponse.json({
      importantEmails,
      paymentsBills,
      invoices,
      missedEmails,
      timeRange: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Sync Email Stats] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch email statistics" },
      { status: 500 }
    );
  }
}
