/**
 * Knowledge Gap Logger
 * 
 * Agents use this to log when they encounter missing information.
 * Agents MUST NEVER invent information - they log gaps instead.
 * 
 * Usage:
 * ```ts
 * await logKnowledgeGap({
 *   userId,
 *   agent: 'aloha',
 *   source: 'call',
 *   question: 'What are your pricing plans?',
 *   requestedInfo: 'pricing information',
 *   suggestedCategory: 'pricing',
 *   contextId: callLogId,
 * });
 * ```
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { AgentKey } from "@/types";

export type KnowledgeGapSource = "call" | "email" | "chat" | "other";
export type KnowledgeGapCategory =
  | "pricing"
  | "services"
  | "hours"
  | "policy"
  | "booking"
  | "location"
  | "contact"
  | "other";

export interface LogKnowledgeGapParams {
  userId: string;
  agent: AgentKey;
  source: KnowledgeGapSource;
  question: string; // The question that couldn't be answered
  requestedInfo: string; // What information was requested
  suggestedCategory?: KnowledgeGapCategory;
  contextId?: string; // FK to call_log, email thread, conversation, etc.
  contextMetadata?: Record<string, any>; // Additional context
}

/**
 * Log a knowledge gap when an agent encounters missing information
 * 
 * This should be called when:
 * - Aloha is asked about pricing but doesn't have it
 * - Sync is asked about services but doesn't have details
 * - Any agent encounters information they don't have
 * 
 * Agents MUST use this instead of inventing information.
 */
export async function logKnowledgeGap(
  params: LogKnowledgeGapParams
): Promise<string> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("agent_knowledge_gaps")
    .insert({
      user_id: params.userId,
      agent: params.agent,
      source: params.source,
      context_id: params.contextId || null,
      question: params.question,
      requested_info: params.requestedInfo,
      suggested_category: params.suggestedCategory || "other",
      status: "open",
      context_metadata: params.contextMetadata || {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error logging knowledge gap:", error);
    throw new Error("Failed to log knowledge gap");
  }

  return data.id;
}

/**
 * Resolve a knowledge gap
 * 
 * Called when user provides the missing information.
 * Optionally creates a knowledge chunk for future use.
 */
export async function resolveKnowledgeGap(
  gapId: string,
  userId: string,
  resolutionNotes: string,
  resolutionAction?: "updated_business_info" | "added_knowledge_chunk" | "other"
): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("agent_knowledge_gaps")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: userId,
      resolution_notes: resolutionNotes,
      resolution_action: resolutionAction || "other",
    })
    .eq("id", gapId)
    .eq("user_id", userId); // Ensure user can only resolve their own gaps

  if (error) {
    console.error("Error resolving knowledge gap:", error);
    throw new Error("Failed to resolve knowledge gap");
  }
}

/**
 * Get open knowledge gaps for a user
 */
export async function getOpenKnowledgeGaps(userId: string) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("agent_knowledge_gaps")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching knowledge gaps:", error);
    return [];
  }

  return data || [];
}














