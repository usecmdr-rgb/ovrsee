/**
 * Studio Agent Chat API
 * 
 * POST /api/studio/agent/chat
 * 
 * LLM-powered Studio agent with tool-using capabilities.
 * Can create posts, schedule content, repurpose posts, and generate weekly plans.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getMemoryFacts } from "@/lib/insight/memory";
import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";
import { getBrandProfile, formatBrandProfileForPrompt } from "@/lib/studio/brand-profile-service";
import {
  createDraftPost,
  schedulePost,
  movePostOnCalendar,
  repurposePost,
  generateWeeklyPlan,
  createExperiment,
  logToolCall,
  type ToolResult,
} from "@/lib/studio/agent-tools";
import { getAgentSafeErrorMessage } from "@/lib/studio/errors";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

// Define available tools for the agent
const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "createDraftPost",
      description: "Create a new draft post for a social media platform. Use this when the user wants to create a post.",
      parameters: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: ["instagram", "tiktok", "facebook"],
            description: "The social media platform for the post",
          },
          caption: {
            type: "string",
            description: "The post caption/content",
          },
          scheduled_for: {
            type: "string",
            description: "ISO timestamp for when to schedule the post (optional). If not provided, creates a draft.",
          },
          asset_id: {
            type: "string",
            description: "ID of an existing asset to use (optional)",
          },
          media_url: {
            type: "string",
            description: "URL of media to use if no asset_id (optional)",
          },
          media_type: {
            type: "string",
            enum: ["image", "video"],
            description: "Type of media (default: image)",
          },
        },
        required: ["platform", "caption"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedulePost",
      description: "Schedule or reschedule an existing post to a specific date and time.",
      parameters: {
        type: "object",
        properties: {
          post_id: {
            type: "string",
            description: "ID of the post to schedule",
          },
          scheduled_for: {
            type: "string",
            description: "ISO timestamp for when to schedule the post",
          },
        },
        required: ["post_id", "scheduled_for"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "movePostOnCalendar",
      description: "Move a post to a different date on the calendar. Use this when the user wants to reschedule a post.",
      parameters: {
        type: "object",
        properties: {
          post_id: {
            type: "string",
            description: "ID of the post to move",
          },
          new_date: {
            type: "string",
            description: "ISO date string for the new date (time will be set to noon)",
          },
        },
        required: ["post_id", "new_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "repurposePost",
      description: "Repurpose an existing post to other social media platforms. Creates platform-specific variants.",
      parameters: {
        type: "object",
        properties: {
          source_post_id: {
            type: "string",
            description: "ID of the source post to repurpose",
          },
          target_platforms: {
            type: "array",
            items: {
              type: "string",
              enum: ["instagram", "tiktok", "facebook"],
            },
            description: "Platforms to repurpose the post to",
          },
          scheduled_for: {
            type: "string",
            description: "ISO timestamp for when to schedule the repurposed posts (optional)",
          },
        },
        required: ["source_post_id", "target_platforms"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generateWeeklyPlan",
      description: "Generate a weekly content plan and create draft posts scheduled across the week. Use this when the user asks to plan posts for a week or generate a weekly schedule.",
      parameters: {
        type: "object",
        properties: {
          week_start: {
            type: "string",
            description: "ISO date for the start of the week (optional, defaults to next Monday)",
          },
          preferences: {
            type: "object",
            properties: {
              desired_cadence: {
                type: "object",
                properties: {
                  instagram: { type: "number" },
                  tiktok: { type: "number" },
                  facebook: { type: "number" },
                },
              },
              preferred_days: {
                type: "array",
                items: { type: "string" },
                description: "Preferred days of week (e.g., ['Monday', 'Wednesday'])",
              },
              preferred_times: {
                type: "array",
                items: { type: "string" },
                description: "Preferred time windows (e.g., ['9-12', '15-18'])",
              },
            },
          },
        },
        required: [],
      },
    },
  },
];

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { message, assetId, conversation_history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { ok: false, error: "Message is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Get brand profile
    const brandProfile = await getBrandProfile(workspaceId, supabaseClient);
    const brandProfileText = formatBrandProfileForPrompt(brandProfile);

    // Get competitor summary
    const { getCompetitorSummary } = await import("@/lib/studio/competitor-service");
    const competitorSummary = await getCompetitorSummary(workspaceId, supabaseClient);

    // Get memory facts for additional context
    const memoryFacts = await getMemoryFacts(workspaceId, 0.5);
    const brandContext: any = {};
    memoryFacts.forEach((fact) => {
      if (fact.key.includes("brand") || fact.key.includes("tone") || fact.key.includes("style")) {
        brandContext[fact.key] = fact.value;
      }
    });

    // Fetch asset if assetId is provided
    let assetContext: any = null;
    if (assetId) {
      const { data: asset } = await supabaseClient
        .from("studio_assets")
        .select("*")
        .eq("id", assetId)
        .eq("workspace_id", workspaceId)
        .single();

      if (asset) {
        assetContext = {
          id: asset.id,
          name: asset.name || asset.filename,
          type: asset.asset_type,
          url: asset.url || asset.preview_url,
        };
      }
    }

    // Build system prompt
    const systemPrompt = `You are the Studio Agent, an intelligent social media assistant that can help users create, schedule, and manage their content.

CRITICAL - BRAND PROFILE ADHERENCE:
You MUST strictly adhere to the Brand Profile provided below. All content suggestions, tone recommendations, and creative guidance MUST align with:
- The brand description and identity
- The target audience characteristics
- The voice and tone guidelines (style, formality, personality traits)
- Brand attributes (keywords, values, mission, tagline)

OPERATIONAL CAPABILITIES:
You have access to tools that allow you to:
1. **createDraftPost** - Create new draft posts for Instagram, TikTok, or Facebook
2. **schedulePost** - Schedule or reschedule existing posts
3. **movePostOnCalendar** - Move posts to different dates on the calendar
4. **repurposePost** - Repurpose existing posts to other platforms
5. **generateWeeklyPlan** - Generate a weekly content plan with multiple draft posts
6. **createExperiment** - Create A/B tests to compare different content variations

When users ask you to:
- "Create a post" → Use createDraftPost
- "Schedule this post" → Use schedulePost
- "Move this post to Friday" → Use movePostOnCalendar
- "Repurpose this to TikTok" → Use repurposePost
- "Plan my posts for next week" → Use generateWeeklyPlan
- "Test two hooks" or "A/B test this caption" → Use createExperiment

IMPORTANT RULES:
- Always validate that social accounts are connected before creating posts
- Never schedule posts more than 3 months in advance
- Never schedule posts in the past
- If a tool call fails, explain the error clearly and suggest what the user can do to fix it
- When an operation fails, summarize the failure plainly and suggest user actions (e.g., "reconnect account", "edit post", "adjust date")
- After performing actions, summarize what you did in a friendly, conversational way
- Include links or references to where users can view the results (e.g., "View in Calendar")
- If you encounter errors, be helpful and suggest next steps rather than just reporting the error

Brand Profile:
${brandProfileText || "No brand profile configured. Use general best practices."}

${competitorSummary.competitors.length > 0 ? `
Competitor Context:
You have access to competitor data. If the user asks about competitors or how they compare, you can reference:
${competitorSummary.competitors.map((comp) => `- ${comp.label || comp.handle} (@${comp.handle} on ${comp.platform})`).join("\n")}
` : ""}

Be helpful, proactive, and brand-focused. When you perform actions, explain what you did and why.`;

    // Build conversation messages
    const messages: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      tool_calls?: any[];
      tool_call_id?: string;
      name?: string;
    }> = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history if provided
    if (conversation_history && Array.isArray(conversation_history)) {
      messages.push(...conversation_history.slice(-10)); // Last 10 messages for context
    }

    // Add current user message
    messages.push({ role: "user", content: message });

    // Call LLM with tool support
    let completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.studio.primaryModel,
      messages: messages as any,
      tools: AGENT_TOOLS,
      tool_choice: "auto",
      temperature: 0.7,
    });

    let finalAnswer = "";
    const actionsTaken: Array<{ tool: string; result: ToolResult }> = [];

    // Handle tool calls
    while (completion.choices[0]?.finish_reason === "tool_calls") {
      const toolCalls = completion.choices[0]?.message?.tool_calls || [];

      // Execute each tool call
      for (const toolCall of toolCalls) {
        if (toolCall.type !== "function") continue;
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");

        let toolResult: ToolResult;

        try {
          // Execute the appropriate tool
          switch (toolName) {
            case "createDraftPost":
              toolResult = await createDraftPost(workspaceId, user.id, toolArgs, supabaseClient);
              break;
            case "schedulePost":
              toolResult = await schedulePost(workspaceId, toolArgs, supabaseClient);
              break;
            case "movePostOnCalendar":
              toolResult = await movePostOnCalendar(workspaceId, toolArgs, supabaseClient);
              break;
            case "repurposePost":
              toolResult = await repurposePost(workspaceId, user.id, toolArgs, supabaseClient);
              break;
            case "generateWeeklyPlan":
              toolResult = await generateWeeklyPlan(workspaceId, user.id, toolArgs, supabaseClient);
              break;
            case "createExperiment":
              toolResult = await createExperiment(workspaceId, user.id, toolArgs, supabaseClient);
              break;
            default:
              toolResult = {
                success: false,
                message: `Unknown tool: ${toolName}`,
                error: "UNKNOWN_TOOL",
              };
          }

          // Log tool call
          await logToolCall(workspaceId, user.id, toolName, toolArgs, toolResult, supabaseClient);

          actionsTaken.push({ tool: toolName, result: toolResult });

          // Add tool result to messages with safe error message for agent
          const safeMessage = getAgentSafeErrorMessage(toolResult);
          messages.push({
            role: "tool",
            content: JSON.stringify({
              success: toolResult.success,
              message: safeMessage,
              data: toolResult.data,
              error: toolResult.error,
            }),
            tool_call_id: toolCall.id,
            name: toolName,
          });
        } catch (error: any) {
          toolResult = {
            success: false,
            message: `Error executing ${toolName}: ${error.message}`,
            error: error.message,
          };

          await logToolCall(workspaceId, user.id, toolName, toolArgs, toolResult, supabaseClient);
          actionsTaken.push({ tool: toolName, result: toolResult });

          // Use safe error message for agent
          const safeMessage = getAgentSafeErrorMessage(toolResult);
          messages.push({
            role: "tool",
            content: JSON.stringify({
              success: false,
              message: safeMessage,
              error: toolResult.error,
            }),
            tool_call_id: toolCall.id,
            name: toolName,
          });
        }
      }

      // Get final answer from LLM
      completion = await openai.chat.completions.create({
        model: AGENT_CONFIG.studio.primaryModel,
        messages: messages as any,
        tools: AGENT_TOOLS,
        tool_choice: "auto",
        temperature: 0.7,
      });
    }

    // Extract final answer
    finalAnswer = completion.choices[0]?.message?.content || "I couldn't generate a response.";

    // Build response with actions summary
    const response: any = {
      ok: true,
      data: {
        answer: finalAnswer,
        actions_taken: actionsTaken.map((a) => ({
          tool: a.tool,
          success: a.result.success,
          message: a.result.message,
          data: a.result.data,
        })),
      },
    };

    // Add helpful links based on actions
    const links: string[] = [];
    if (actionsTaken.some((a) => a.tool === "createDraftPost" || a.tool === "generateWeeklyPlan")) {
      links.push("/studio/calendar");
    }
    if (actionsTaken.some((a) => a.tool === "repurposePost")) {
      links.push("/studio/calendar");
    }
    if (actionsTaken.some((a) => a.tool === "createExperiment")) {
      links.push("/studio/experiments");
    }

    if (links.length > 0) {
      response.data.links = links;
    }

    return NextResponse.json(response, { headers: responseHeaders });
  } catch (error: any) {
    console.error("Error in studio agent chat endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
