/**
 * Data fetching hooks for Insights API endpoints
 */

import { useState, useEffect } from "react";

interface InsightsOverviewData {
  range: { from: string; to: string };
  totals: {
    callsTotal: number;
    callsAnswered: number;
    callsMissed: number;
    voicemailsTotal: number;
    emailsReceivedTotal: number;
    emailsSentTotal: number;
    emailsImportantTotal: number;
    meetingsTotal: number;
    studioEditsTotal: number;
    studioPostsTotal: number;
    timeSavedHours: number;
    insightsGeneratedTotal: number;
  };
  timeseries: {
    dates: string[];
    callsTotal: number[];
    emailsReceivedTotal: number[];
    meetingsTotal: number[];
    studioPostsTotal: number[];
  };
}

interface InsightsCallsData {
  range: { from: string; to: string };
  days: Array<{
    date: string;
    callsTotal: number;
    callsAnswered: number;
    callsMissed: number;
    callsVoicemail: number;
    callsDurationSecondsAvg: number;
  }>;
}

interface InsightsEmailData {
  range: { from: string; to: string };
  days: Array<{
    date: string;
    emailsReceivedTotal: number;
    emailsSentTotal: number;
    emailsImportantTotal: number;
  }>;
}

interface InsightsCalendarData {
  range: { from: string; to: string };
  days: Array<{
    date: string;
    meetingsTotal: number;
    meetingsDurationMinutes: number;
  }>;
}

interface InsightsStudioData {
  range: { from: string; to: string };
  days: Array<{
    date: string;
    studioEditsTotal: number;
    studioPostsTotal: number;
    studioViewsTotal: number;
    studioLikesTotal: number;
    studioCommentsTotal: number;
  }>;
}

interface UseInsightsResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useInsightsApi<T>(
  endpoint: string,
  params?: { from?: string; to?: string }
): UseInsightsResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const searchParams = new URLSearchParams();
        if (params?.from) searchParams.set("from", params.from);
        if (params?.to) searchParams.set("to", params.to);

        const url = `/api/insights/${endpoint}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const result = await response.json();

        if (cancelled) return;

        if (result.ok && result.data) {
          setData(result.data);
        } else {
          throw new Error(result.error || "Failed to fetch data");
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || "Failed to fetch insights");
        setData(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [endpoint, params?.from, params?.to]);

  return { data, loading, error };
}

export function useInsightsOverview(params?: { from?: string; to?: string }) {
  return useInsightsApi<InsightsOverviewData>("overview", params);
}

export function useInsightsCalls(params?: { from?: string; to?: string }) {
  return useInsightsApi<InsightsCallsData>("calls", params);
}

export function useInsightsEmail(params?: { from?: string; to?: string }) {
  return useInsightsApi<InsightsEmailData>("email", params);
}

export function useInsightsCalendar(params?: { from?: string; to?: string }) {
  return useInsightsApi<InsightsCalendarData>("calendar", params);
}

export function useInsightsStudio(params?: { from?: string; to?: string }) {
  return useInsightsApi<InsightsStudioData>("studio", params);
}

