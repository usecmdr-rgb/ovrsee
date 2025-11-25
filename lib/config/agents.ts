import { Phone, Mail, Brush, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Central agent configuration - single source of truth for agent IDs and metadata
 * 
 * Agent name mapping (old → new):
 * - alpha → aloha (voice & call agent)
 * - mu → studio (content, image editing & branding agent)
 * - xi → sync (email & calendar agent)
 * - beta → insight (analytics & business intelligence agent)
 */

export type AgentId = "aloha" | "studio" | "sync" | "insight";

export interface AgentConfig {
  id: AgentId; // The value stored in Supabase agent_type column
  label: string; // User-facing name
  description: string;
  icon: LucideIcon;
  accent: string; // Tailwind color class for UI
  route: string; // Frontend route path
  oldId?: "alpha" | "mu" | "xi" | "beta"; // Legacy ID for migration reference
  requiredTier?: "basic" | "advanced" | "elite"; // Minimum tier required for access
}

export const AGENTS: AgentConfig[] = [
  {
    id: "aloha",
    label: "Aloha",
    description: "Your voice & call assistant",
    icon: Phone,
    accent: "bg-red-500",
    route: "/aloha",
    oldId: "alpha",
    requiredTier: "advanced",
  },
  {
    id: "studio",
    label: "Studio",
    description: "Your content, editing & branding assistant",
    icon: Brush,
    accent: "bg-violet-500",
    route: "/studio",
    oldId: "mu",
    requiredTier: "advanced",
  },
  {
    id: "sync",
    label: "Sync",
    description: "Your email & calendar assistant",
    icon: Mail,
    accent: "bg-orange-500",
    route: "/sync",
    oldId: "xi",
    requiredTier: "basic",
  },
  {
    id: "insight",
    label: "Insight",
    description: "Your analytics & business intelligence assistant",
    icon: BarChart3,
    accent: "bg-emerald-500",
    route: "/insight",
    oldId: "beta",
    requiredTier: "elite",
  },
];

export const AGENT_BY_ID: Record<AgentId, AgentConfig> = {
  aloha: AGENTS[0],
  studio: AGENTS[1],
  sync: AGENTS[2],
  insight: AGENTS[3],
};

// Legacy ID to new ID mapping for migration
export const LEGACY_AGENT_MAP: Record<"alpha" | "mu" | "xi" | "beta", AgentId> = {
  alpha: "aloha",
  mu: "studio",
  xi: "sync",
  beta: "insight",
};

// Reverse mapping: new ID to legacy ID
export const NEW_TO_LEGACY_MAP: Record<AgentId, "alpha" | "mu" | "xi" | "beta"> = {
  aloha: "alpha",
  studio: "mu",
  sync: "xi",
  insight: "beta",
};




