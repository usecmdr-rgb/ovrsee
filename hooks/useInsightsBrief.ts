/**
 * Hook for generating Insights daily brief
 */

import { useState, useCallback } from "react";

interface InsightsBriefResponse {
  brief: string;
  range: { from: string; to: string };
}

interface UseInsightsBriefState {
  loading: boolean;
  error: string | null;
  brief: string | null;
  range: { from: string; to: string } | null;
}

export function useInsightsBrief() {
  const [state, setState] = useState<UseInsightsBriefState>({
    loading: false,
    error: null,
    brief: null,
    range: null,
  });

  const generateBrief = useCallback(
    async (options?: { from?: string; to?: string }): Promise<InsightsBriefResponse | null> => {
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const response = await fetch("/api/insights/brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: options?.from,
            to: options?.to,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Failed to generate brief");
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          brief: result.data.brief,
          range: result.data.range,
        }));

        return result.data;
      } catch (err: any) {
        const errorMessage = err.message || "Failed to generate brief";
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
    generateBrief,
  };
}



