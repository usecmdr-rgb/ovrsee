/**
 * Sync Ask API
 * 
 * POST /api/sync/ask
 * 
 * LLM-powered Sync agent for email and calendar questions
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getWorkspaceIdFromAuth } from "@/lib/workspace-helpers";
import { getMemoryFacts, getImportantRelationships } from "@/lib/insight/memory";
import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";
import { getOrCreateWorkspace } from "@/lib/sync/integrations";

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

    const workspaceId = await getWorkspaceIdFromAuth();
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { question } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Fetch email and calendar data
    const { data: emails } = await supabase
      .from("email_summaries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: calendarEvents } = await supabase
      .from("sync_calendar_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(10);

    // Get memory facts and relationships
    const [memoryFacts, relationships] = await Promise.all([
      getMemoryFacts(workspaceId, 0.5),
      getImportantRelationships(workspaceId, 60),
    ]);

    // Build context
    const context = {
      emails: (emails || []).slice(0, 10).map((e) => ({
        subject: e.subject,
        sender: e.sender || e.from_address,
        isImportant: e.is_important,
        isRead: e.is_read,
        receivedAt: e.created_at,
      })),
      calendar: (calendarEvents || []).map((e) => ({
        title: e.summary,
        start: e.start_at,
        location: e.location,
      })),
      memory: {
        emailPatterns: memoryFacts
          .filter((f) => f.key.includes("email") || f.key.includes("response"))
          .slice(0, 5),
        importantContacts: relationships.slice(0, 10),
      },
    };

    // Generate answer using LLM
    const systemPrompt = `You are the **Sync Agent**, an AI assistant specialized in email and calendar management for business users.

You help users:
- Understand what is happening in their inbox.
- Prioritize which emails need attention first.
- Manage and interpret calendar events.
- Get concise insights about communication and scheduling patterns.

You have access to:
- Recent important and unread emails.
- Upcoming calendar events.
- Memory facts about email patterns and response times.
- Important contacts and relationships.

Guidelines:
- Be clear, concise, and professional.
- When giving suggestions, focus on concrete, actionable recommendations.
- When suggesting actions, format them as a JSON array named "actions", where each item has:
  - "type": a short machine-friendly key (e.g. "reply", "schedule_meeting", "snooze", "archive")
  - "label": a short human-readable description.

Example:

{
  "summary": "High-level summary goes here.",
  "actions": [
    { "type": "reply", "label": "Reply to Nadia about the updated proposal" },
    { "type": "schedule_meeting", "label": "Schedule a 30-minute check-in with GrowthOps" }
  ]
}

If no actions are needed, return an empty array for "actions".`.trim();

    const userPrompt = `User question: ${question}

Context:
${JSON.stringify(context, null, 2)}

Provide a helpful answer and suggest 2-3 actionable next steps. Return JSON with:
- answer: string
- suggestedActions: array of {type: string, label: string, description?: string}`;

    const completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.sync.primaryModel, // Use gpt-4o-mini for email/calendar tasks
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content from LLM");
    }

    const parsed = JSON.parse(content);

    return NextResponse.json({
      ok: true,
      data: {
        answer: parsed.answer || "I couldn't generate an answer.",
        suggestedActions: parsed.suggestedActions || [],
      },
    });
  } catch (error: any) {
    console.error("Error in sync ask endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

