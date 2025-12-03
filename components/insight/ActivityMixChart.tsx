"use client";

import { useMemo } from "react";
import type { TimeRange } from "@/types";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import { useAccountMode } from "@/hooks/useAccountMode";
import TrialExpiredLock from "./TrialExpiredLock";

interface ActivityMixChartProps {
  range: TimeRange;
  isPreview?: boolean;
  overviewData?: {
    timeseries?: {
      dates: string[];
      callsTotal: number[];
      emailsReceivedTotal: number[];
    };
  } | null;
  overviewLoading?: boolean;
  overviewError?: string | null;
}

// Mock data for demo mode
const getMockActivityData = (range: TimeRange) => {
  if (range === "daily") {
    return Array.from({ length: 24 }, (_, i) => ({
      label: `${i.toString().padStart(2, "0")}:00`,
      calls: Math.floor(Math.random() * 5) + 2,
      emails: Math.floor(Math.random() * 3) + 1,
    }));
  } else if (range === "weekly") {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((day) => ({
      label: day,
      calls: Math.floor(Math.random() * 15) + 10,
      emails: Math.floor(Math.random() * 10) + 5,
    }));
  } else {
    return Array.from({ length: 4 }, (_, i) => ({
      label: `W${i + 1}`,
      calls: Math.floor(Math.random() * 50) + 30,
      emails: Math.floor(Math.random() * 30) + 15,
    }));
  }
};

export default function ActivityMixChart({ 
  range, 
  isPreview = false,
  overviewData,
  overviewLoading = false,
  overviewError = null,
}: ActivityMixChartProps) {
  const { isSuperAdmin } = useAgentAccess();
  const { mode: accountMode } = useAccountMode();
  
  // Don't show trial expired lock for super admins or users with active subscriptions/trials
  const shouldShowTrialLock = false; // Simplified - no longer needed with new backend
  
  // Convert overview timeseries data to chart buckets
  const buckets = useMemo(() => {
    if (isPreview) {
      return getMockActivityData(range);
    }
    
    if (overviewData?.timeseries) {
      const { dates, callsTotal, emailsReceivedTotal } = overviewData.timeseries;
      return dates.map((date, idx) => {
        const dateObj = new Date(date);
        let label: string;
        if (range === "daily") {
          label = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        } else if (range === "weekly") {
          label = dateObj.toLocaleDateString("en-US", { weekday: "short" });
        } else {
          label = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        }
        return {
          label,
          calls: callsTotal[idx] || 0,
          emails: emailsReceivedTotal[idx] || 0,
        };
      });
    }
    
    return [];
  }, [overviewData, range, isPreview]);

  const loading = overviewLoading;
  const error = overviewError;

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold mb-4">Calls vs Emails</h2>
        <div className="h-32 flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900"></div>
        </div>
      </div>
    );
  }

  if (shouldShowTrialLock) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold mb-4">Calls vs Emails</h2>
        <TrialExpiredLock />
      </div>
    );
  }
  
  if (isUnauthorized && !shouldShowTrialLock) {
    // If unauthorized but shouldn't show trial lock (super admin or active subscription),
    // show a generic error or empty state
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold mb-4">Calls vs Emails</h2>
        <div className="h-32 flex items-center justify-center text-sm text-slate-500">
          No data available
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold mb-4">Calls vs Emails</h2>
        <div className="h-32 flex items-center justify-center text-sm text-slate-500">
          Insights temporarily unavailable
        </div>
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold mb-4">Calls vs Emails</h2>
        <div className="h-32 flex items-center justify-center text-sm text-slate-500">
          No data available
        </div>
      </div>
    );
  }

  // Calculate max value for scaling
  const maxValue = Math.max(
    ...buckets.map((b) => Math.max(b.calls, b.emails)),
    1
  );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <h2 className="text-lg font-semibold mb-4">Calls vs Emails</h2>
      <div className="mt-2">
        <div className="grid h-32 items-end gap-2" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>
          {buckets.map((bucket, index) => {
            const callsHeight = (bucket.calls / maxValue) * 100;
            const emailsHeight = (bucket.emails / maxValue) * 100;
            
            return (
              <div key={index} className="space-y-1 text-center">
                <div className="relative h-full flex items-end justify-center gap-0.5">
                  {/* Calls bar */}
                  <div
                    className="w-full rounded-t bg-blue-500 dark:bg-blue-600"
                    style={{ height: `${callsHeight}%`, minHeight: bucket.calls > 0 ? '4px' : '0' }}
                    title={`Calls: ${bucket.calls}`}
                  />
                  {/* Emails bar */}
                  <div
                    className="w-full rounded-t bg-emerald-500 dark:bg-emerald-600"
                    style={{ height: `${emailsHeight}%`, minHeight: bucket.emails > 0 ? '4px' : '0' }}
                    title={`Emails: ${bucket.emails}`}
                  />
                </div>
                <p className="text-xs text-slate-500">{bucket.label}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-blue-500"></div>
            <span className="text-slate-600 dark:text-slate-400">Calls</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-emerald-500"></div>
            <span className="text-slate-600 dark:text-slate-400">Emails</span>
          </div>
        </div>
      </div>
    </div>
  );
}

