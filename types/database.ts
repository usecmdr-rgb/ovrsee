/**
 * Database types for Supabase tables
 * These types match the database schema defined in migrations
 */

export type SubscriptionTier = "free" | "trial" | "trial_expired" | "basic" | "advanced" | "elite";
export type SubscriptionStatus = 
  | "active" 
  | "trialing" 
  | "expired"
  | "canceled" 
  | "past_due" 
  | "incomplete" 
  | "incomplete_expired" 
  | "unpaid";

export type AgentType = "aloha" | "studio" | "sync" | "insight";
export type MessageRole = "user" | "assistant" | "system";

/**
 * Profiles table
 */
export interface Profile {
  id: string; // UUID, references auth.users.id
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  // Subscription fields (kept for backward compatibility)
  subscription_tier: SubscriptionTier | null;
  subscription_status: SubscriptionStatus | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_started_at: string | null; // ISO timestamp
  trial_ends_at: string | null; // ISO timestamp
}

/**
 * Subscriptions table (normalized subscription data)
 */
export interface Subscription {
  id: string; // UUID
  user_id: string; // UUID, references auth.users.id
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null; // ISO timestamp
  current_period_end: string | null; // ISO timestamp
  cancel_at_period_end: boolean;
  canceled_at: string | null; // ISO timestamp
  trial_started_at: string | null; // ISO timestamp
  trial_ends_at: string | null; // ISO timestamp
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Agents table
 */
export interface Agent {
  id: string; // UUID
  user_id: string | null; // UUID, references auth.users.id (null for system agents)
  agent_type: AgentType;
  name: string | null;
  settings: Record<string, any>; // JSONB
  prompt: string | null;
  is_active: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Agent conversations table
 */
export interface AgentConversation {
  id: string; // UUID
  user_id: string; // UUID, references auth.users.id
  agent_id: string | null; // UUID, references agents.id
  agent_type: AgentType;
  title: string | null;
  metadata: Record<string, any>; // JSONB
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Agent messages table
 */
export interface AgentMessage {
  id: string; // UUID
  conversation_id: string; // UUID, references agent_conversations.id
  user_id: string; // UUID, references auth.users.id
  role: MessageRole;
  content: string;
  metadata: Record<string, any>; // JSONB
  created_at: string; // ISO timestamp
}

/**
 * User session data (combines auth user + profile + subscription)
 */
export interface UserSession {
  user: {
    id: string;
    email: string | null;
    email_verified: boolean;
  };
  profile: Profile | null;
  subscription: Subscription | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isPaid: boolean;
  isTrialing: boolean;
  isTrialExpired: boolean;
  accessibleAgents: AgentType[];
}

/**
 * Database insert types (for creating new records)
 */
export type ProfileInsert = Omit<Profile, "id" | "created_at" | "updated_at"> & {
  id: string; // Required for insert
};

export type SubscriptionInsert = Omit<Subscription, "id" | "created_at" | "updated_at">;

export type AgentInsert = Omit<Agent, "id" | "created_at" | "updated_at">;

export type AgentConversationInsert = Omit<AgentConversation, "id" | "created_at" | "updated_at">;

export type AgentMessageInsert = Omit<AgentMessage, "id" | "created_at">;

/**
 * Database update types (for updating existing records)
 */
export type ProfileUpdate = Partial<Omit<Profile, "id" | "created_at">> & {
  updated_at?: string;
};

export type SubscriptionUpdate = Partial<Omit<Subscription, "id" | "user_id" | "created_at">> & {
  updated_at?: string;
};

export type AgentUpdate = Partial<Omit<Agent, "id" | "created_at">> & {
  updated_at?: string;
};

export type AgentConversationUpdate = Partial<Omit<AgentConversation, "id" | "created_at">> & {
  updated_at?: string;
};

