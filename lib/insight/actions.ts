/**
 * Insight Action Automation Engine
 * 
 * Centralized action model for turning insights into executable actions
 */

export type InsightActionType =
  | "draft_email"
  | "create_task"
  | "create_event"
  | "start_call"
  | "open_contact"
  | "open_email"
  | "open_workflow";

export interface InsightAction {
  id: string;
  type: InsightActionType;
  label: string;
  description?: string;
  payload?: any;
  source?: string; // 'insight', 'sync', 'aloha', 'studio'
}

/**
 * Create action from insight
 */
export function createActionFromInsight(
  insightId: string,
  actionData: any
): InsightAction {
  return {
    id: `insight-${insightId}-${Date.now()}`,
    type: actionData.type || "create_task",
    label: actionData.label || "Take action",
    description: actionData.description,
    payload: actionData.payload,
    source: "insight",
  };
}

/**
 * Create action from sync follow-up
 */
export function createActionFromSync(
  emailId: string,
  type: "draft_email" | "create_task" = "draft_email"
): InsightAction {
  return {
    id: `sync-${emailId}-${Date.now()}`,
    type,
    label: type === "draft_email" ? "Draft reply" : "Create task",
    description: "Follow up on email",
    payload: { emailId },
    source: "sync",
  };
}

/**
 * Create action from Aloha missed call
 */
export function createActionFromAloha(callId: string): InsightAction {
  return {
    id: `aloha-${callId}-${Date.now()}`,
    type: "start_call",
    label: "Return missed call",
    description: "Follow up on missed call",
    payload: { callId },
    source: "aloha",
  };
}

/**
 * Create action from Studio content
 */
export function createActionFromStudio(
  assetId: string,
  type: "open_workflow" = "open_workflow"
): InsightAction {
  return {
    id: `studio-${assetId}-${Date.now()}`,
    type,
    label: "Open workflow",
    description: "Create content workflow",
    payload: { assetId },
    source: "studio",
  };
}



