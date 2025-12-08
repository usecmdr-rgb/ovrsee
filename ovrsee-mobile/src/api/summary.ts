import { httpRequest } from "./http";
import { TodaySummary, AgentSummary, ApiResponse } from "@/types";

export async function getTodaySummary(): Promise<ApiResponse<TodaySummary>> {
  return httpRequest<TodaySummary>("/summary/today");
}

export async function getAgentSummaries(): Promise<ApiResponse<AgentSummary[]>> {
  // Must return agents in correct order: Sync → Aloha → Studio → Insights
  return httpRequest<AgentSummary[]>("/summary/agents");
}



