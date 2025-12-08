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
  fullName?: string;
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

// Business Profile types (for database and API)
export interface BusinessProfile {
  id: string;
  userId: string;
  businessName: string | null;
  businessType: string | null;
  description: string | null;
  primaryWebsiteUrl: string | null;
  additionalUrls: string[];
  location: string | null;
  serviceArea: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  servicesOffered: string | string[] | null;
  hoursOfOperation: string | null;
  serviceName: string | null;
  imageWatermarkEnabled: boolean;
  imageWatermarkText: string | null;
  imageWatermarkLogoUrl: string | null;
  imageWatermarkPosition: string | null;
  preferences: Record<string, any>;
  language: string | null;
  timezone: string | null;
  notes: string | null;
  lastCrawledAt: string | null;
  crawlStatus: "pending" | "in_progress" | "completed" | "failed";
  crawlError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessKnowledgeChunk {
  id: string;
  businessProfileId: string;
  source: "form" | "website" | "manual";
  sourceUrl: string | null;
  title: string | null;
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
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

export interface EmailQueueItem {
  id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  gmail_history_id?: string | null;
  gmail_labels: string[];
  from_address: string;
  from_name?: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  snippet?: string | null;
  body_html?: string | null;
  body_text?: string | null;
  internal_date: string;
  queue_status: "open" | "snoozed" | "done" | "archived";
  is_read: boolean;
  is_starred: boolean;
  category?: string | null;
  snoozed_until?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_source?: "ovrsee" | "gmail" | "both" | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
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
  timeframe?: "today" | "week" | "month" | "daily" | "weekly" | "monthly";
  range?: "daily" | "weekly" | "monthly";
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
  sources?: { type: string; id: string; label: string }[];
  followUpQuestions?: string[];
}

// Insight Data Model
export type InsightSource = 'aloha' | 'sync' | 'studio' | 'insight_agent' | 'system' | 'manual';
export type InsightCategory = 'productivity' | 'communication' | 'finance' | 'sales' | 'risk' | 'ops' | 'misc';
export type InsightSeverity = 'info' | 'warning' | 'critical';

export type InsightActionType =
  | 'draft_email'
  | 'create_task'
  | 'create_calendar_event'
  | 'start_call'
  | 'open_workflow'
  | 'open_resource'
  | 'view_call_log'
  | 'view_email_thread';

export interface InsightAction {
  id: string;
  type: InsightActionType;
  label: string;
  description?: string;
  payload?: any;
}

export interface Insight {
  id: string;
  userId: string;
  source: InsightSource;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  timeRange?: string;
  tags: string[];
  actions?: InsightAction[];
  isRead: boolean;
  dismissedAt?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

// Insight Brief Types
export interface InsightBriefSection {
  title: string;
  bulletPoints: string[];
}

export interface InsightBrief {
  range: 'daily' | 'weekly' | 'monthly';
  generatedAt: string;
  sections: InsightBriefSection[];
  keyRisks?: string[];
  priorities?: string[];
}

// Ask Insight Answer
export interface AskInsightAnswer {
  answer: string;
  sources?: { type: string; id: string; label: string }[];
  followUpQuestions?: string[];
}

// Time Range Type
export type TimeRange = 'daily' | 'weekly' | 'monthly';

// Insight Memory Types
export type InsightMemoryType = 'preference' | 'pattern' | 'behavior' | 'risk' | 'tag' | 'goal';

export interface InsightMemoryFact {
  id: string;
  workspaceId: string;
  type: InsightMemoryType;
  key: string;
  value: Record<string, any>;
  confidence: number;       // 0..1
  importanceScore: number;  // 0..100
  createdAt: string;
  updatedAt: string;
}

export type InsightGoalStatus = 'active' | 'completed' | 'archived';

export interface InsightUserGoal {
  id: string;
  workspaceId: string;
  goalLabel: string;
  description?: string;
  priority: number;         // 1..5
  status: InsightGoalStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type InsightRelationshipEntityType = 'contact' | 'company' | 'project';

export interface InsightRelationship {
  id: string;
  workspaceId: string;
  entityType: InsightRelationshipEntityType;
  entityIdentifier: string;
  displayName?: string;
  interactionCount: number;
  sentimentScore?: number;  // -1..1
  lastContactAt?: string;
  importanceScore: number;  // 0..100
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Activity Mix Types
export interface ActivityMixBucket {
  label: string;
  calls: number;
  emails: number;
}

export interface ActivityMixResponse {
  range: TimeRange;
  buckets: ActivityMixBucket[];
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

export interface TrialInfo {
  hasUsedTrial: boolean;
  isExpired: boolean;
}

export interface RetentionInfo {
  isInRetentionWindow: boolean;
  daysRemaining: number | null;
  isDataCleared: boolean;
  reason: "trial_expired" | "paid_canceled" | "paid_paused" | null;
}

export interface SubscriptionData {
  subscription: SubscriptionInfo;
  paymentMethod: PaymentMethodInfo | null;
  trial?: TrialInfo;
  retention?: RetentionInfo;
}
