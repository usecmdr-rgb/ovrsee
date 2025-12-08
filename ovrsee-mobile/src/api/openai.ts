import { httpRequest } from "./http";
import { ApiResponse } from "@/types";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatResponse {
  message: string;
}

export async function generateCallSummary(
  callId: string
): Promise<ApiResponse<ChatResponse>> {
  return httpRequest<ChatResponse>("/openai/summary/call", {
    method: "POST",
    body: { callId },
  });
}

export async function generateDailySummary(
  date: string
): Promise<ApiResponse<ChatResponse>> {
  return httpRequest<ChatResponse>("/openai/summary/daily", {
    method: "POST",
    body: { date },
  });
}

export async function chat(
  messages: ChatMessage[]
): Promise<ApiResponse<ChatResponse>> {
  return httpRequest<ChatResponse>("/openai/chat", {
    method: "POST",
    body: { messages },
  });
}



