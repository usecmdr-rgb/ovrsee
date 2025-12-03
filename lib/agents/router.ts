// lib/agents/router.ts

import { AGENT_CONFIG, AgentKey, TaskType } from "./config";

export function getModelForTask(
  agentKey: AgentKey,
  taskType: TaskType = "default"
): string {
  const config = AGENT_CONFIG[agentKey];

  if (
    config.secondaryModel &&
    config.useSecondaryFor &&
    config.useSecondaryFor.includes(taskType)
  ) {
    return config.secondaryModel;
  }

  return config.primaryModel;
}
















