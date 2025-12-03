"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Phone, 
  Mail, 
  Image, 
  Brain, 
  AlertCircle, 
  CheckCircle2,
  X,
  ExternalLink,
  Calendar,
  FileText,
  Zap,
} from "lucide-react";
import type { Insight, InsightSource, InsightCategory, InsightSeverity, InsightAction } from "@/types";
import { formatRelativeTime, getSourceLabel, getSeverityColor, getCategoryColor } from "@/lib/insight/utils";
import { useAppState } from "@/context/AppStateContext";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import { useAccountMode } from "@/hooks/useAccountMode";
import TrialExpiredLock from "./TrialExpiredLock";

interface InsightTimelineProps {
  range: "daily" | "weekly" | "monthly";
  onInsightClick?: (insight: Insight) => void;
  isPreview?: boolean;
}

const sourceIcons: Record<InsightSource, typeof Phone> = {
  aloha: Phone,
  sync: Mail,
  studio: Image,
  insight_agent: Brain,
  system: AlertCircle,
  manual: FileText,
};

// Mock insights for demo mode
const mockInsights: Insight[] = [
  {
    id: "mock-1",
    userId: "demo-user",
    title: "Call volume increased 20% this week",
    description: "Aloha handled 32 calls this week, up from 27 last week. Most calls were answered successfully.",
    source: "aloha",
    category: "productivity",
    severity: "info",
    tags: ["calls", "trending"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isRead: false,
    actions: [],
    metadata: {},
  },
  {
    id: "mock-2",
    userId: "demo-user",
    title: "Two invoices require follow-up",
    description: "Sync identified 2 unpaid invoices that need attention. Consider sending reminders.",
    source: "sync",
    category: "finance",
    severity: "warning",
    tags: ["invoices", "follow-up"],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    isRead: false,
    actions: [],
    metadata: {},
  },
  {
    id: "mock-3",
    userId: "demo-user",
    title: "Media engagement up 15%",
    description: "Studio's recent posts showed strong engagement. Keep this content strategy going.",
    source: "studio",
    category: "sales",
    severity: "info",
    tags: ["media", "engagement"],
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    isRead: false,
    actions: [],
    metadata: {},
  },
];

export default function InsightTimeline({ range, onInsightClick, isPreview = false }: InsightTimelineProps) {
  const { isAuthenticated } = useAppState();
  const { isSuperAdmin } = useAgentAccess();
  const { mode: accountMode } = useAccountMode();
  const [insights, setInsights] = useState<Insight[]>(isPreview ? mockInsights : []);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [filter, setFilter] = useState<"all" | "important" | "warnings" | "critical">("all");
  const [sourceFilter, setSourceFilter] = useState<InsightSource | "all">("all");
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  
  // Don't show trial expired lock for super admins or users with active subscriptions/trials
  const shouldShowTrialLock = isUnauthorized && 
    !isSuperAdmin && 
    accountMode !== 'subscribed' && 
    accountMode !== 'trial-active';

  const fetchInsights = useCallback(async () => {
    if (isPreview) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setIsUnauthorized(false);

    try {
      const params = new URLSearchParams({
        range,
        filter,
        ...(sourceFilter !== "all" && { source: sourceFilter }),
      });

      const response = await fetch(`/api/insight/insights-list?${params}`);
      const result = await response.json();

      if (result.ok) {
        setInsights(result.data || []);
      } else {
        const isAuthError = response.status === 401 || result.error === "Unauthorized";
        setIsUnauthorized(isAuthError);
        if (!isAuthError) {
          setError(result.error || "Failed to fetch insights");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch insights");
    } finally {
      setLoading(false);
    }
  }, [range, filter, sourceFilter, isPreview]);

  useEffect(() => {
    if (isPreview) {
      setLoading(false);
      return;
    }
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    fetchInsights();
  }, [range, filter, sourceFilter, isAuthenticated, fetchInsights, isPreview]);

  const handleInsightClick = (insight: Insight) => {
    setSelectedInsight(insight);
    if (onInsightClick) {
      onInsightClick(insight);
    }
  };

  const handleActionClick = async (action: InsightAction, insight: Insight) => {
    try {
      // Use the new action runner API
      const res = await fetch("/api/actions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: `insight-${insight.id}-${action.id}`,
          type: action.type,
          payload: action.payload || { insightId: insight.id },
        }),
      });

      const result = await res.json();
      if (result.ok && result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch (err) {
      console.error("Failed to run action:", err);
    }

    // Handle action based on type
    switch (action.type) {
      case "draft_email":
        // Navigate to email composer or open modal
        window.location.href = `/sync?action=draft&context=${insight.id}`;
        break;
      case "create_task":
        // Open task creation
        window.location.href = `/sync?action=task&context=${insight.id}`;
        break;
      case "create_calendar_event":
        // Open calendar event creation
        window.location.href = `/calendar?action=create&context=${insight.id}`;
        break;
      case "start_call":
        // Navigate to Aloha
        window.location.href = `/aloha?action=call&context=${insight.id}`;
        break;
      case "view_call_log":
        window.location.href = `/aloha?view=logs&context=${insight.id}`;
        break;
      case "view_email_thread":
        window.location.href = `/sync?view=thread&context=${insight.id}`;
        break;
      case "open_workflow":
        // Navigate to workflows
        window.location.href = `/insight?view=workflows&action=${action.payload?.workflowId || ""}`;
        break;
      case "open_resource":
        if (action.payload?.url) {
          window.open(action.payload.url, "_blank");
        }
        break;
      default:
        console.log("Action not implemented:", action.type);
    }
  };

  const markAsRead = async (insightId: string) => {
    try {
      const response = await fetch(`/api/insight/insights-list/${insightId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      if (response.ok) {
        setInsights((prev) =>
          prev.map((i) => (i.id === insightId ? { ...i, isRead: true } : i))
        );
      }
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <p className="text-sm text-slate-500">Sign in to view insights</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Insights</h2>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Severity filter */}
          <div className="flex gap-1 rounded-full border border-slate-200 p-1 text-xs dark:border-slate-800">
            {(["all", "important", "warnings", "critical"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 ${
                  filter === f
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-500"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Source filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as InsightSource | "all")}
            className="rounded-full border border-slate-200 bg-transparent px-3 py-1 text-xs dark:border-slate-800"
          >
            <option value="all">All Sources</option>
            <option value="aloha">Aloha</option>
            <option value="sync">Sync</option>
            <option value="studio">Studio</option>
            <option value="insight_agent">Insight</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="py-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900"></div>
        </div>
      )}

      {!loading && shouldShowTrialLock && (
        <TrialExpiredLock />
      )}

      {!loading && error && !isUnauthorized && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && !isUnauthorized && insights.length === 0 && (
        <div className="py-8 text-center text-slate-500">
          <Brain size={48} className="mx-auto mb-3 opacity-50" />
          <p>No insights found for this period</p>
        </div>
      )}

      {!loading && !error && insights.length > 0 && (
        <div className="space-y-3">
          {insights.map((insight) => {
            const SourceIcon = sourceIcons[insight.source] || AlertCircle;
            return (
              <div
                key={insight.id}
                onClick={() => handleInsightClick(insight)}
                className={`group cursor-pointer rounded-xl border p-3 transition-all hover:border-slate-300 hover:shadow-sm dark:hover:border-slate-700 ${
                  insight.isRead
                    ? "border-slate-100 bg-white/60 dark:border-slate-800 dark:bg-slate-900/30"
                    : "border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Source icon */}
                  <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-lg ${
                    getCategoryColor(insight.category)
                  } text-white`}>
                    <SourceIcon size={16} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            {getSourceLabel(insight.source)}
                          </span>
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${getSeverityColor(insight.severity)}`}
                          />
                          {insight.metadata?.personalized && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-semibold">
                              🎯 Personalized
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            {formatRelativeTime(insight.createdAt)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{insight.title}</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                          {insight.description}
                        </p>
                      </div>
                      {!insight.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(insight.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Mark as read"
                        >
                          <CheckCircle2 size={16} className="text-slate-400" />
                        </button>
                      )}
                    </div>

                    {/* Tags */}
                    {insight.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {insight.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    {insight.actions && insight.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {insight.actions.slice(0, 3).map((action) => (
                          <button
                            key={action.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActionClick(action, insight);
                            }}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Insight Detail Modal */}
      {selectedInsight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedInsight(null)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  getCategoryColor(selectedInsight.category)
                } text-white`}>
                  {React.createElement(sourceIcons[selectedInsight.source] || AlertCircle, { size: 20 })}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedInsight.title}</h3>
                  <p className="text-xs text-slate-500">
                    {getSourceLabel(selectedInsight.source)} • {formatRelativeTime(selectedInsight.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInsight(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {selectedInsight.description}
            </p>

            {selectedInsight.actions && selectedInsight.actions.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold mb-2">Recommended Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedInsight.actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => {
                        handleActionClick(action, selectedInsight);
                        setSelectedInsight(null);
                      }}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  markAsRead(selectedInsight.id);
                  setSelectedInsight(null);
                }}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
              >
                Mark as Read
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

