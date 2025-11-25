// Import and re-export AgentId from central config
import type { AgentId } from "@/lib/config/agents";
export type { AgentId } from "@/lib/config/agents";

// Type alias for backward compatibility
export type AgentKey = AgentId;

export type ConnectedAccountType = "facebook" | "instagram" | "x" | "linkedin" | "website" | "other";

export interface ConnectedAccount {
  id: string;
  type: ConnectedAccountType;
  displayName: string;
  isConnected: boolean;
}

export interface AgentInfo {
  key: AgentKey;
  name: string;
  role: string;
  description: string;
  price: number;
  accent: string;
}

export interface BusinessInfo {
  businessName: string;
  businessType: string;
  location: string;
  operatingHours: string;
  serviceName: string;
  services: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
  language: string;
  timezone: string;
  notes: string;
}

export interface AlertCategory {
  id: string;
  name: string;
  color: string;
  defaultColor: string;
  count: number;
}

export interface CallRecord {
  id: string;
  caller: string;
  time: string;
  outcome: "answered" | "missed";
  summary: string;
  appointmentLink?: string;
  transcript: string;
  contact: string;
  followUp: string;
}

export interface EmailRecord {
  id: string;
  sender: string;
  subject: string;
  timestamp: string;
  categoryId: string;
  status: "drafted" | "needs_reply" | "archived";
  snippet: string;
  draft: string;
}

export interface MediaItem {
  id: string;
  filename: string;
  type: "image" | "video";
  updatedAt: string;
  previewUrl: string;
  impressions?: number;
  likes?: number;
  reposts?: number;
  comments?: number;
  postedTo?: {
    platform: "instagram" | "tiktok" | "facebook";
    postId?: string;
    postedAt?: string;
  }[];
  metricsLastUpdated?: string;
}

export interface AgentStatsDaily {
  id: string;
  date: string;
  alpha_calls_total: number;
  alpha_calls_missed: number;
  alpha_appointments: number;
  xi_important_emails: number;
  xi_missed_emails: number;
  xi_payments_bills: number;
  xi_invoices: number;
  mu_media_edits: number;
  beta_insights_count: number;
}

// Daily Command Brief Types
export interface DailyBrief {
  title: string;
  generatedAt: string;
  topPriorities: string[];
  actionItems: {
    id: string;
    description: string;
    agent: AgentKey;
    priority: "high" | "medium" | "low";
  }[];
  alerts: {
    id: string;
    type: "deadline" | "conflict" | "payment" | "appointment";
    message: string;
    agent: AgentKey;
    dueDate?: string;
  }[];
  calendarIssues: {
    id: string;
    type: "conflict" | "overlap" | "missing_info";
    description: string;
    date?: string;
  }[];
  metricInsights: {
    agent: AgentKey;
    metric: string;
    value: number | string;
    trend: "up" | "down" | "stable";
    insight: string;
  }[];
  suggestedCorrections: {
    id: string;
    issue: string;
    suggestion: string;
    agent: AgentKey;
  }[];
  followUpList: {
    id: string;
    item: string;
    agent: AgentKey;
    priority: "high" | "medium" | "low";
  }[];
}

// Workflow Types
export type WorkflowTrigger = 
  | "email.received"
  | "calendar.event.created"
  | "metric.updated"
  | "time-based"
  | "user-initiated";

export type WorkflowAction = 
  | "aloha.reorganize"
  | "aloha.scheduleFollowup"
  | "sync.summarize"
  | "sync.createTask"
  | "studio.logMetric"
  | "studio.updateMetric"
  | "insight.combineOutputs"
  | "insight.sendSummary";

export interface WorkflowCondition {
  field: string;
  operator: "contains" | "equals" | "greaterThan" | "lessThan" | "exists";
  value?: string | number;
}

export interface Workflow {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  condition?: WorkflowCondition;
  actions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
}

// Insight Types
export interface InsightRequest {
  question: string;
  timeframe?: "today" | "week" | "month";
}

export interface InsightResponse {
  question: string;
  generatedAt: string;
  keyInsights: string[];
  priorityDecisions: {
    id: string;
    decision: string;
    context: string;
    urgency: "high" | "medium" | "low";
    agent: AgentKey;
  }[];
  trends: {
    agent: AgentKey;
    trend: string;
    direction: "up" | "down" | "stable";
    impact: "high" | "medium" | "low";
  }[];
  risks: {
    id: string;
    risk: string;
    severity: "high" | "medium" | "low";
    deadline?: string;
    agent: AgentKey;
  }[];
  recommendations: {
    id: string;
    recommendation: string;
    rationale: string;
    priority: "high" | "medium" | "low";
  }[];
}

// Subscription Types
export type SubscriptionTier = "basic" | "advanced" | "elite" | null;
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid" | null;

export interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

export interface SubscriptionData {
  subscription: SubscriptionInfo;
  paymentMethod: PaymentMethodInfo | null;
}
