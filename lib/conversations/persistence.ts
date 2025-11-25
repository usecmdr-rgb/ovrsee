/**
 * Conversation and message persistence utilities
 * Handles saving and retrieving agent conversations and messages
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type {
  AgentConversation,
  AgentConversationInsert,
  AgentConversationUpdate,
  AgentMessage,
  AgentMessageInsert,
  AgentType,
} from "@/types/database";

/**
 * Create a new conversation
 */
export async function createConversation(
  userId: string,
  agentType: AgentType,
  agentId?: string | null,
  title?: string | null,
  metadata?: Record<string, any>
): Promise<AgentConversation | null> {
  const supabase = getSupabaseServerClient();

  const conversationData: AgentConversationInsert = {
    user_id: userId,
    agent_id: agentId || null,
    agent_type: agentType,
    title: title || null,
    metadata: metadata || {},
  };

  const { data, error } = await supabase
    .from("agent_conversations")
    .insert(conversationData)
    .select()
    .single();

  if (error) {
    console.error("Error creating conversation:", error);
    return null;
  }

  return data;
}

/**
 * Get user's conversations for a specific agent type
 */
export async function getUserConversations(
  userId: string,
  agentType?: AgentType,
  limit: number = 50
): Promise<AgentConversation[]> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from("agent_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (agentType) {
    query = query.eq("agent_type", agentType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }

  return data || [];
}

/**
 * Get a single conversation by ID
 */
export async function getConversation(
  conversationId: string,
  userId: string
): Promise<AgentConversation | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("agent_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching conversation:", error);
    return null;
  }

  return data;
}

/**
 * Update a conversation
 */
export async function updateConversation(
  conversationId: string,
  userId: string,
  update: AgentConversationUpdate
): Promise<AgentConversation | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("agent_conversations")
    .update(update)
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("Error updating conversation:", error);
    return null;
  }

  return data;
}

/**
 * Delete a conversation (cascades to messages)
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("agent_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting conversation:", error);
    return false;
  }

  return true;
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  userId: string,
  role: "user" | "assistant" | "system",
  content: string,
  metadata?: Record<string, any>
): Promise<AgentMessage | null> {
  const supabase = getSupabaseServerClient();

  // Verify conversation belongs to user
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) {
    console.error("Conversation not found or access denied");
    return null;
  }

  const messageData: AgentMessageInsert = {
    conversation_id: conversationId,
    user_id: userId,
    role,
    content,
    metadata: metadata || {},
  };

  const { data, error } = await supabase
    .from("agent_messages")
    .insert(messageData)
    .select()
    .single();

  if (error) {
    console.error("Error adding message:", error);
    return null;
  }

  // Update conversation updated_at timestamp
  await updateConversation(conversationId, userId, {});

  return data;
}

/**
 * Get messages for a conversation
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  limit: number = 100
): Promise<AgentMessage[]> {
  const supabase = getSupabaseServerClient();

  // Verify conversation belongs to user
  const conversation = await getConversation(conversationId, userId);
  if (!conversation) {
    return [];
  }

  const { data, error } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }

  return data || [];
}

/**
 * Get or create conversation for a user and agent type
 * Useful for ensuring a conversation exists before adding messages
 */
export async function getOrCreateConversation(
  userId: string,
  agentType: AgentType,
  agentId?: string | null,
  title?: string | null
): Promise<AgentConversation | null> {
  // Try to get the most recent conversation for this agent type
  const conversations = await getUserConversations(userId, agentType, 1);

  if (conversations.length > 0) {
    return conversations[0];
  }

  // Create new conversation
  return createConversation(userId, agentType, agentId, title);
}

