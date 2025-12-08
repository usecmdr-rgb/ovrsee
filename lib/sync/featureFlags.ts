/**
 * Feature Flags for Sync Intelligence
 * Controls which features are enabled via environment variables
 */

export function isSyncIntelligenceEnabled(): boolean {
  return process.env.SYNC_INTELLIGENCE_ENABLED !== "false";
}

export function isThreadContextForDraftsEnabled(): boolean {
  return process.env.THREAD_CONTEXT_FOR_DRAFTS_ENABLED !== "false";
}

export function isBusinessInfoAwareDraftsEnabled(): boolean {
  return process.env.BUSINESS_INFO_AWARE_DRAFTS_ENABLED !== "false";
}

export function isSmartSchedulingSuggestionsEnabled(): boolean {
  return process.env.SMART_SCHEDULING_SUGGESTIONS_ENABLED === "true";
}

export function isLeadScoringEnabled(): boolean {
  return process.env.LEAD_SCORING_ENABLED === "true";
}

export function isFollowUpSuggestionsEnabled(): boolean {
  return process.env.FOLLOW_UP_SUGGESTIONS_ENABLED === "true";
}

export function isTodayDashboardEnabled(): boolean {
  return process.env.TODAY_DASHBOARD_ENABLED === "true";
}

export function isAutoSequenceFollowUpsEnabled(): boolean {
  return process.env.AUTO_SEQUENCE_FOLLOW_UPS_ENABLED === "true";
}

export function isOpportunityDetectionEnabled(): boolean {
  return process.env.OPPORTUNITY_DETECTION_ENABLED === "true";
}

export function isAiCopilotEnabled(): boolean {
  return process.env.AI_COPILOT_ENABLED === "true";
}

export function isDraftSendCalendarAlertsEnabled(): boolean {
  return process.env.DRAFT_SEND_CALENDAR_ALERTS_ENABLED !== "false";
}

export function getSyncBatchSize(): number {
  const size = process.env.SYNC_BATCH_SIZE;
  return size ? parseInt(size, 10) : 50;
}

export function getSyncMaxRetries(): number {
  const retries = process.env.SYNC_MAX_RETRIES;
  return retries ? parseInt(retries, 10) : 3;
}
