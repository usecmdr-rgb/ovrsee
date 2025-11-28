/**
 * Database types for Supabase tables
 * These types match the database schema defined in migrations
 */

export type SubscriptionTier = "free" | "trial" | "trial_expired" | "data_cleared" | "basic" | "advanced" | "elite";
export type SubscriptionStatus = 
  | "active" 
  | "trialing" 
  | "expired"
  | "canceled"
  | "paused"
  | "past_due" 
  | "incomplete" 
  | "incomplete_expired" 
  | "unpaid"
  | "inactive";

export type DataRetentionReason = "trial_expired" | "paid_canceled" | "paid_paused" | null;

export type AgentType = "aloha" | "studio" | "sync" | "insight";
export type MessageRole = "user" | "assistant" | "system";
export type VoicemailMode = "none" | "voicemail_only" | "receptionist";

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
  trial_ended_at: string | null; // ISO timestamp
  data_retention_expires_at: string | null; // ISO timestamp
  data_retention_reason: DataRetentionReason;
  paid_canceled_at: string | null; // ISO timestamp
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
  paid_canceled_at: string | null; // ISO timestamp
  trial_started_at: string | null; // ISO timestamp
  trial_ends_at: string | null; // ISO timestamp
  trial_ended_at: string | null; // ISO timestamp
  data_retention_expires_at: string | null; // ISO timestamp
  data_retention_reason: DataRetentionReason;
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

/**
 * Aloha profiles table
 */
export interface AlohaProfile {
  id: string; // UUID
  user_id: string; // UUID, references auth.users.id
  display_name: string; // What Aloha calls itself
  voice_id: string; // Legacy: Selected voice ID (kept for backward compatibility)
  voice_key: string | null; // New: Selected voice profile key (one of 4 predefined profiles)
  voice_options: Record<string, any> | null; // Optional cache of available voices
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Database insert types for Aloha profiles
 */
export type AlohaProfileInsert = Omit<AlohaProfile, "id" | "created_at" | "updated_at">;

/**
 * Database update types for Aloha profiles
 */
export type AlohaProfileUpdate = Partial<Omit<AlohaProfile, "id" | "user_id" | "created_at">> & {
  updated_at?: string;
};

/**
 * Contact profiles table
 */
export interface ContactProfile {
  id: string; // UUID
  user_id: string; // UUID, references auth.users.id
  phone_number: string;
  name: string | null;
  notes: string | null;
  do_not_call: boolean;
  preferred_call_window: any | null; // JSONB
  last_called_at: string | null; // ISO timestamp
  last_campaign_id: string | null; // UUID, references call_campaigns.id
  last_outcome: string | null;
  times_contacted: number;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Database insert types for contact profiles
 */
export type ContactProfileInsert = Omit<ContactProfile, "id" | "created_at" | "updated_at">;

/**
 * Database update types for contact profiles
 */
export type ContactProfileUpdate = Partial<Omit<ContactProfile, "id" | "user_id" | "created_at">> & {
  updated_at?: string;
};

/**
 * User phone numbers table (Twilio integration)
 */
export interface UserPhoneNumber {
  id: string; // UUID
  user_id: string; // UUID, references auth.users.id
  twilio_phone_sid: string; // Twilio IncomingPhoneNumber SID (or "SIMULATED_SID_*" in mock mode)
  phone_number: string; // Twilio number in E.164 format
  country: string;
  area_code: string | null;
  is_active: boolean; // Only ONE active per user
  voicemail_enabled: boolean;
  voicemail_mode: "none" | "voicemail_only" | "receptionist";
  external_phone_number: string | null; // User's real SIM/carrier number
  forwarding_enabled: boolean;
  forwarding_confirmed: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

/**
 * Database insert types for user phone numbers
 */
export type UserPhoneNumberInsert = Omit<UserPhoneNumber, "id" | "created_at" | "updated_at">;

/**
 * Database update types for user phone numbers
 */
export type UserPhoneNumberUpdate = Partial<Omit<UserPhoneNumber, "id" | "user_id" | "created_at">> & {
  updated_at?: string;
};

/**
 * User OpenAI keys table (per-user BYO key)
 */
export interface UserOpenAIKey {
  id: string; // UUID
  user_id: string; // UUID, references auth.users.id
  provider: "openai";
  api_key: string;
  is_active: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}


