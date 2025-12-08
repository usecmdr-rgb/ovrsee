/**
 * Hook for interacting with the Insights Agent
 */

import { useState, useCallback } from "react";

interface InsightsAgentResponse {
  answer: string;
  range: { from: string; to: string };
  debug?: {
    usedDailyMetricsCount: number;
    usedSamples: {
      calls: number;
      emails: number;
      events: number;
      studioPosts: number;
    };
  };
}

interface UseInsightsAgentState {
  loading: boolean;
  error: string | null;
  answer: string | null;
  lastQuestion: string | null;
  lastRange: { from: string; to: string } | null;
}

export function useInsightsAgent() {
  const [state, setState] = useState<UseInsightsAgentState>({
    loading: false,
    error: null,
    answer: null,
    lastQuestion: null,
    lastRange: null,
  });

  const sendQuestion = useCallback(
    async (
      question: string,
      options?: { from?: string; to?: string }
    ): Promise<InsightsAgentResponse | null> => {
      if (!question.trim()) {
        setState((prev) => ({
          ...prev,
          error: "Question cannot be empty",
        }));
        return null;
      }

      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
        answer: null,
      }));

      try {
        const response = await fetch("/api/insights/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            from: options?.from,
            to: options?.to,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Failed to get answer");
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          answer: result.data.answer,
          lastQuestion: question,
          lastRange: result.data.range,
        }));

        return result.data;
      } catch (err: any) {
        const errorMessage = err.message || "Failed to send question";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        return null;
      }
    },
    []
  );

  return {
    ...state,
    sendQuestion,
  };
}




