"use client";

import { useMemo, useState, FormEvent, useEffect, useCallback } from "react";
import { useAppState } from "@/context/AppStateContext";
import type { EmailRecord } from "@/types";
import { useAgentStats, emptyAgentStats } from "@/hooks/useAgentStats";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import PreviewBanner from "@/components/agent/PreviewBanner";
import { AGENT_BY_ID } from "@/lib/config/agents";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useTranslation } from "@/hooks/useTranslation";
import { getLanguageFromLocale } from "@/lib/localization";
import { isDemoMode } from "@/lib/config/demoMode";
import { useAccountMode } from "@/hooks/useAccountMode";
import { Loader2, CheckCircle2, Mail, Calendar as CalendarIcon, MapPin, Users, FileText, Edit2, AlertTriangle, CalendarCheck, Info, CheckCircle, AlertCircle, Plus, X, Trash2, RotateCcw, ChevronDown, ChevronUp, Star, Bell, DollarSign, Receipt, Megaphone, RefreshCw, Circle, Repeat, Search, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import SyncIntelligence from "@/components/sync/SyncIntelligence";
import SendEmailModal from "@/components/sync/SendEmailModal";
import EditDraftModal from "@/components/sync/EditDraftModal";
import TodayDashboard from "@/components/sync/TodayDashboard";
import LeadManagementPanel from "@/components/sync/LeadManagementPanel";
import BusinessInfoBanner from "@/components/sync/BusinessInfoBanner";
import Modal from "@/components/ui/Modal";
import { CATEGORY_CONFIG, getAllCategories, getCategoryConfig, type EmailCategory } from "@/lib/sync/categoryUi";
import { Clock } from "lucide-react";
import { isFollowUpSuggestionsEnabled, isLeadScoringEnabled, isTodayDashboardEnabled, isAiCopilotEnabled } from "@/lib/sync/featureFlags";
import {
  getLocalDateString,
  getEventLocalDate,
  getEventLocalDateString,
  getEventLocalTime,
  isMultiDayEvent,
  formatEventTime,
  formatEventDate,
  getWeekDays,
  getMonthDays,
  getHourPosition,
  isToday,
  isCurrentMonth,
} from "@/lib/calendar/date-utils";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
}

interface GmailEmail {
  id: string;
  sender: string;
  fromAddress: string;
  subject: string;
  snippet: string;
  body?: string;
  timestamp: string;
  categoryId?: string;
  status?: "drafted" | "needs_reply" | "archived";
  draft?: string;
  ai_draft?: string | null;
  ai_draft_generated_at?: string | null;
}

interface EmailQueueItem {
  id: string;
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  gmail_history_id?: string | null;
  gmail_labels: string[];
  from_address: string;
  from_name?: string | null;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  snippet?: string | null;
  body_html?: string | null;
  body_text?: string | null;
  internal_date: string;
  queue_status: "open" | "snoozed" | "done" | "archived";
  is_read: boolean;
  is_starred: boolean;
  category?: string | null; // Updated from category_id to category
  classification_raw?: Record<string, any> | null;
  ai_draft?: string | null;
  ai_draft_generated_at?: string | null;
  snoozed_until?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_source?: "ovrsee" | "gmail" | "both" | null;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface SyncStatus {
  connected: boolean;
  lastSyncAt?: string | null;
  syncStatus?: "idle" | "syncing" | "error";
  syncError?: string | null;
  lastHistoryId?: string | null;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  notes?: string;
  memo?: string;
  reminder?: string;
  createdByAloha?: boolean;
  alohaCallId?: string;
}

interface CustomAlert {
  id: string;
  icon: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  dateTime?: string;
  notes?: string;
  memo?: string;
  reminder?: string;
}

// Insights Tab Content Component
const InsightsTabContentSync = ({ onSwitchTab }: { onSwitchTab: (tab: "email" | "today" | "calendar" | "insights") => void }) => {
  const t = useTranslation();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<{
    leadFunnel: Record<string, number>;
    hotLeadCount: number;
    warmLeadCount: number;
    pendingFollowUps: number;
    avgFollowUpDelayDays?: number;
    upcomingMeetings: number;
    importantThisWeek: number;
    paymentsThisWeek: number;
    missedNeedsReply: number;
    revenue?: {
      pipelineValueByStage: Record<string, number>;
      totalOpenPipelineValue: number;
      totalWonRevenueLast30Days: number;
      totalWonRevenueAllTime: number;
    };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const STAGE_LABELS: Record<string, string> = {
    new: "New",
    cold: "Cold",
    qualified: "Qualified",
    warm: "Warm",
    negotiating: "Negotiating",
    ready_to_close: "Ready to Close",
    won: "Won",
    lost: "Lost",
  };

  useEffect(() => {
    const loadInsights = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabaseBrowserClient.auth.getSession();
        if (!session?.access_token) {
          setLoading(false);
          return;
        }

        const res = await fetch("/api/insights/overview", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to load insights");
        }

        const data = await res.json();
        setInsights(data.data);
      } catch (err: any) {
        console.error("Error loading insights:", err);
        setError(err.message || "Failed to load insights");
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        <span className="ml-2 text-sm text-slate-500">Loading insights...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-6 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-red-600 dark:text-red-400" />
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400">No insights available</p>
      </div>
    );
  }

  const totalLeads = Object.values(insights.leadFunnel).reduce((a, b) => a + b, 0);
  const openPipelineValue = insights.revenue?.totalOpenPipelineValue || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t("syncDataTabTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t("syncDataTabDescription")}
        </p>
      </div>

      {/* Today's Snapshot */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("syncDataHotLeads")}</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{insights.hotLeadCount}</div>
        </div>
        <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("syncDataPendingFollowUps")}</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{insights.pendingFollowUps}</div>
        </div>
        <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t("syncDataNext7DaysMeetings")}</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{insights.upcomingMeetings}</div>
        </div>
        {insights.revenue && (
          <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("syncDataOpenPipelineValue")}</div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              ${openPipelineValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
        )}
      </div>

      {/* Leads & Revenue Section */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t("syncDataSectionLeadsRevenue")}</h3>
        
        {/* Lead Funnel - Full Width */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("syncDataLeadFunnel")}</h4>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
            {t("syncDataAgentTagSyncCRM")}
          </span>
          {totalLeads === 0 ? (
            <div className="mt-4 space-y-1">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t("syncDataEmptyLeadFunnelTitle")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("syncDataEmptyLeadFunnelDescription")}</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {Object.entries(insights.leadFunnel).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{STAGE_LABELS[stage] || stage}</span>
                  <span className="text-base font-semibold text-slate-900 dark:text-slate-100">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High-Value Leads & Follow-ups - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* High-Value Leads */}
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("syncDataHighValueLeads")}</h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">{insights.hotLeadCount}</div>
                <div className="text-lg font-semibold text-amber-600 dark:text-amber-400">{insights.warmLeadCount}</div>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              {t("syncDataAgentTagSync")}
            </span>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("syncDataHighValueLeadsSubtitle")}</p>
            {(insights.hotLeadCount > 0 || insights.warmLeadCount > 0) && (
              <button
                onClick={() => onSwitchTab("email")}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                View hot leads <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Follow-ups */}
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("syncDataFollowUps")}</h4>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{insights.pendingFollowUps}</div>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              {t("syncDataAgentTagSync")}
            </span>
            {insights.pendingFollowUps === 0 ? (
              <div className="mt-4 space-y-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t("syncDataEmptyFollowUpsTitle")}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("syncDataEmptyFollowUpsDescription")}</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("syncDataFollowUpsSubtitle")}</p>
            )}
            {insights.pendingFollowUps > 0 && (
              <button
                onClick={() => onSwitchTab("email")}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Go to Follow-ups <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Revenue & Pipeline - Full Width */}
        {insights.revenue && (
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("syncDataRevenuePipeline")}</h4>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              {t("syncDataAgentTagSyncInsight")}
            </span>
            {openPipelineValue === 0 && Object.values(insights.revenue.pipelineValueByStage).every(v => v === 0) ? (
              <div className="mt-4 space-y-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t("syncDataEmptyPipelineTitle")}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("syncDataEmptyPipelineDescription")}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Open Pipeline</div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      ${insights.revenue.totalOpenPipelineValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Won (Last 30 days)</div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      ${insights.revenue.totalWonRevenueLast30Days.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Won (All Time)</div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      ${insights.revenue.totalWonRevenueAllTime.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Pipeline by Stage</div>
                  <div className="space-y-2">
                    {Object.entries(insights.revenue.pipelineValueByStage).map(([stage, value]) => (
                      value > 0 && (
                        <div key={stage} className="flex items-center justify-between">
                          <span className="text-sm text-slate-600 dark:text-slate-400">{STAGE_LABELS[stage] || stage}</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workload & Operations Section */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t("syncDataSectionWorkloadOperations")}</h3>

        {/* Upcoming Meetings & Email Workload - Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Meetings */}
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("syncDataUpcomingMeetings")}</h4>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{insights.upcomingMeetings}</div>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              {t("syncDataAgentTagSyncAloha")}
            </span>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Meetings in next 7 days</p>
            {insights.upcomingMeetings > 0 && (
              <button
                onClick={() => onSwitchTab("calendar")}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Open calendar <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Email Workload */}
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t("syncDataEmailWorkload")}</h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{insights.importantThisWeek}</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{insights.paymentsThisWeek}</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{insights.missedNeedsReply}</div>
              </div>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              {t("syncDataAgentTagSync")}
            </span>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("syncDataEmailWorkloadSubtitle")}</p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs text-slate-600 dark:text-slate-400">Important</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-slate-600 dark:text-slate-400">Payments / Bills</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-slate-600 dark:text-slate-400">Missed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// CRM Micro-Panel Component
const CRMMicroPanel = ({ 
  lead, 
  selectedEmail, 
  setEmailQueueItems 
}: { 
  lead: any; 
  selectedEmail: any; 
  setEmailQueueItems: (updater: any) => void;
}) => {
  const leadId = lead.id || (selectedEmail as any).leadId;
  const leadScore = lead.score || 0;
  const [leadStage, setLeadStageLocal] = useState(lead.stage || "new");
  const [updatingStage, setUpdatingStage] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: string; body: string; created_at: string }>>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  
  const stageLabels: Record<string, string> = {
    new: "New",
    cold: "Cold",
    qualified: "Qualified",
    warm: "Warm",
    negotiating: "Negotiating",
    ready_to_close: "Ready to Close",
    won: "Won",
    lost: "Lost",
  };
  
  let stageColor = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
  if (leadScore >= 80) {
    stageColor = "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300";
  } else if (leadScore >= 60) {
    stageColor = "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
  }

  const loadNotes = async () => {
    if (!leadId || loadingNotes) return;
    try {
      setLoadingNotes(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/sync/lead/${leadId}/notes`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const updateLeadStage = async (newStage: string) => {
    if (!leadId || updatingStage) return;
    try {
      setUpdatingStage(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/sync/lead/${leadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ lead_stage: newStage }),
      });

      if (res.ok) {
        setLeadStageLocal(newStage);
        setEmailQueueItems((prev: any[]) =>
          prev.map((e) =>
            e.id === selectedEmail.id && (e as any).lead
              ? {
                  ...e,
                  lead: { ...(e as any).lead, stage: newStage },
                }
              : e
          )
        );
      }
    } catch (error) {
      console.error("Error updating lead stage:", error);
      alert("Failed to update lead stage");
    } finally {
      setUpdatingStage(false);
    }
  };

  const saveNote = async () => {
    if (!leadId || !newNote.trim() || savingNote) return;
    try {
      setSavingNote(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/sync/lead/${leadId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ body: newNote }),
      });

      if (res.ok) {
        const data = await res.json();
        setNotes([data.note, ...notes]);
        setNewNote("");
      }
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };
  
  return (
    <div className="mt-2 mb-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-xs space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Lead:</span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${stageColor}`}>
            {stageLabels[leadStage] || leadStage} ({leadScore})
          </span>
          {leadId && (
            <select
              value={leadStage}
              onChange={(e) => updateLeadStage(e.target.value)}
              disabled={updatingStage}
              className="ml-1 px-1.5 py-0.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 disabled:opacity-50"
              onClick={(e) => e.stopPropagation()}
            >
              {Object.entries(stageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
        {lead.budget && (
          <div>
            <span className="text-slate-500 dark:text-slate-400">Budget:</span>{" "}
            <span className="text-slate-700 dark:text-slate-300">{lead.budget}</span>
          </div>
        )}
        {lead.timeline && (
          <div>
            <span className="text-slate-500 dark:text-slate-400">Timeline:</span>{" "}
            <span className="text-slate-700 dark:text-slate-300">{lead.timeline}</span>
          </div>
        )}
      </div>
      
      {leadId && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
          <button
            onClick={() => {
              setShowNotes(!showNotes);
              if (!showNotes && notes.length === 0) {
                loadNotes();
              }
            }}
            className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          >
            {showNotes ? "Hide" : "Show"} Notes ({notes.length})
          </button>
          
          {showNotes && (
            <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
              {loadingNotes ? (
                <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
              ) : (
                <>
                  {notes.map((note) => (
                    <div key={note.id} className="text-xs text-slate-600 dark:text-slate-400 p-1.5 bg-white dark:bg-slate-900 rounded">
                      {note.body}
                      <span className="ml-2 text-slate-400 text-[10px]">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  <div className="flex gap-1">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 resize-none"
                      rows={2}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={saveNote}
                      disabled={!newNote.trim() || savingNote}
                      className="px-2 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
                    >
                      {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SyncPage = () => {
  const [activeTab, setActiveTab] = useState<"email" | "today" | "calendar" | "insights">("email");
  const { alertCategories: defaultAlertCategories, isAuthenticated, openAuthModal, language } = useAppState();
  const t = useTranslation();
  
  // State for sync stats
  const [syncStats, setSyncStats] = useState<{
    important_emails: number;
    missed_emails: number;
    payments_bills: number;
    invoices: number;
    subscriptions: number;
    upcoming_meetings: number;
  } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  
  // Helper function to translate category names
  const getCategoryName = (categoryId: string): string => {
    const categoryNameMap: Record<string, string> = {
      important: t("important"),
      missed_unread: t("syncMissedUnread"),
      payment_bill: t("syncPaymentsBills"),
      invoice: t("invoices"),
      marketing: "Marketing",
      updates: "Updates",
      other: "Other",
    };
    return categoryNameMap[categoryId] || categoryId;
  };
  
  // Email state
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [gmailEmails, setGmailEmails] = useState<GmailEmail[]>([]);
  const [emailQueueItems, setEmailQueueItems] = useState<EmailQueueItem[]>([]);
  const [isGmailConnected, setIsGmailConnected] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | GmailEmail | EmailQueueItem | null>(null);
  const [showCopilotPanel, setShowCopilotPanel] = useState(false);
  const [copilotMode, setCopilotMode] = useState<"summary" | "next_step" | "proposal_hint" | "risk_analysis" | null>(null);
  const [copilotInsights, setCopilotInsights] = useState<any>(null);
  const [loadingCopilot, setLoadingCopilot] = useState(false);
  // Per-email chat history caching
  const [chatHistoryByEmailId, setChatHistoryByEmailId] = useState<Record<string, ChatMessage[]>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState<string>("Sync is thinking...");

  // Get chat messages for current email
  const chatMessages = selectedEmail 
    ? (chatHistoryByEmailId[selectedEmail.id] || [
        { role: "agent", text: "Hi, I'm Sync. I can summarize this thread, help you understand what the customer wants, give you suggestions on how to respond, or rewrite the draft for you. What would you like to do?" }
      ])
    : [];

  // Helper to update chat messages for current email
  const setChatMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (!selectedEmail) return;
    setChatHistoryByEmailId((prev) => {
      const current = prev[selectedEmail.id] || [];
      const updated = typeof updater === 'function' ? updater(current) : updater;
      return {
        ...prev,
        [selectedEmail.id]: updated,
      };
    });
  }, [selectedEmail]);
  // Removed drag handle state - using fixed scrollable layout now
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [draftLoading, setDraftLoading] = useState<Record<string, boolean>>({});
  const [draftError, setDraftError] = useState<Record<string, string>>({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showEditDraftModal, setShowEditDraftModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  // Calendar state
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"month" | "week">("month");
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh emails every 2 minutes when authenticated and Gmail is connected
  useEffect(() => {
    if (!isAuthenticated || !isGmailConnected) return;

    // Load emails initially
    loadGmailEmails();

    // Set up automatic refresh every 2 minutes (120000ms)
    const refreshInterval = setInterval(() => {
      if (!isRefreshing && !isLoadingEmails) {
        loadGmailEmails();
      }
    }, 120000); // 2 minutes

    return () => clearInterval(refreshInterval);
  }, [isAuthenticated, isGmailConnected, isRefreshing, isLoadingEmails, loadGmailEmails]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [memoText, setMemoText] = useState("");
  const [reminderText, setReminderText] = useState("");
  
  // Custom alerts state
  const [customAlerts, setCustomAlerts] = useState<CustomAlert[]>([]);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [newAlert, setNewAlert] = useState<Partial<CustomAlert>>({
    icon: "AlertTriangle",
    title: "",
    description: "",
    date: "",
    time: "",
  });
  const [selectedAlert, setSelectedAlert] = useState<CustomAlert | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState(false);
  const [editedAlert, setEditedAlert] = useState<Partial<CustomAlert>>({});
  const [alertNoteText, setAlertNoteText] = useState("");
  const [alertMemoText, setAlertMemoText] = useState("");
  const [alertReminderText, setAlertReminderText] = useState("");
  const [editingAlertNote, setEditingAlertNote] = useState(false);

  // Mock calendar events for demo mode
  const mockCalendarEvents = useMemo(() => {
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const today = new Date();
    const isCurrentMonth = currentMonth === today.getMonth() && currentYear === today.getFullYear();
    const baseDay = isCurrentMonth ? today.getDate() : 1;
    
    // Helper to get a valid date in the current month
    const getDate = (dayOffset: number) => {
      const targetDay = baseDay + dayOffset;
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const validDay = Math.max(1, Math.min(targetDay, daysInMonth));
      return new Date(currentYear, currentMonth, validDay);
    };
    
    // Generate events for the current month
    const mockEvents: CalendarEvent[] = [
      (() => {
        const date = getDate(0);
        date.setHours(9, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(9, 30, 0, 0);
        return {
          id: "demo-1",
          summary: "Team Standup",
          description: "Daily team sync meeting",
          start: { dateTime: date.toISOString() },
          end: { dateTime: endDate.toISOString() },
          location: "Conference Room A",
          attendees: [
            { email: "team@example.com", displayName: "Team" }
          ],
          createdByAloha: true,
        };
      })(),
      (() => {
        const date = getDate(2);
        date.setHours(14, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(15, 30, 0, 0);
        return {
          id: "demo-2",
          summary: "Client Presentation",
          description: "Quarterly review presentation",
          start: { dateTime: date.toISOString() },
          end: { dateTime: endDate.toISOString() },
          location: "Zoom",
          attendees: [
            { email: "client@example.com", displayName: "Client Team" }
          ],
        };
      })(),
      {
        id: "demo-3",
        summary: "Project Deadline",
        description: "Final deliverables due",
        start: { date: getDate(5).toISOString().split('T')[0] },
        end: { date: getDate(5).toISOString().split('T')[0] },
      },
      (() => {
        const date = getDate(1);
        date.setHours(12, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(13, 0, 0, 0);
        return {
          id: "demo-4",
          summary: "Lunch Meeting",
          description: "Catch up with stakeholders",
          start: { dateTime: date.toISOString() },
          end: { dateTime: endDate.toISOString() },
          location: "Restaurant",
        };
      })(),
      (() => {
        const date = getDate(7);
        date.setHours(10, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(12, 0, 0, 0);
        return {
          id: "demo-5",
          summary: "Sprint Planning",
          description: "Plan next sprint tasks",
          start: { dateTime: date.toISOString() },
          end: { dateTime: endDate.toISOString() },
          createdByAloha: true,
        };
      })(),
    ];
    
    return mockEvents;
  }, [selectedDate]);

  // Get current user and account mode for demo mode check (must be defined before shouldUseDemoMode)
  const { hasAccess, isLoading: accessLoading } = useAgentAccess("sync");
  const { stats, loading, error } = useAgentStats();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { mode: accountMode } = useAccountMode();
  
  useEffect(() => {
    supabaseBrowserClient.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);
  
  // Check if we should use demo mode
  // Demo data is shown for: unauthenticated users, authenticated users in 'preview' mode
  // Demo data is removed for: authenticated users with 'trial-active', 'trial-expired', or 'subscribed'
  const shouldUseDemoMode = useMemo(() => {
    return isDemoMode(currentUser, accountMode);
  }, [currentUser, accountMode]);

  // Function to fetch sync stats
  const fetchSyncStats = useCallback(async () => {
    if (shouldUseDemoMode || !isAuthenticated) {
      setSyncStats(null);
      return;
    }

    setIsLoadingStats(true);
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setIsLoadingStats(false);
        return;
      }

      const response = await fetch("/api/sync/stats", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.ok && result.data) {
          setSyncStats(result.data);
        }
      }
    } catch (error) {
      console.error("Error fetching sync stats:", error);
    } finally {
      setIsLoadingStats(false);
    }
  }, [shouldUseDemoMode, isAuthenticated]);

  // Fetch sync stats on mount and when dependencies change
  useEffect(() => {
    fetchSyncStats();
  }, [fetchSyncStats]);


  // For authenticated users, never show demo calendar events
  // Only show demo calendar if user is not authenticated AND demo mode is explicitly enabled
  const showDemoCalendar = !isCalendarConnected && shouldUseDemoMode;
  const displayEvents = isCalendarConnected ? events : (shouldUseDemoMode ? mockCalendarEvents : []);

  // Demo custom alerts state (persists during demo mode)
  const [demoAlertsState, setDemoAlertsState] = useState<CustomAlert[]>([]);

  // Demo custom alerts for demo mode
  const demoCustomAlerts = useMemo(() => {
    if (!showDemoCalendar) return [];
    
    const currentMonth = selectedDate.getMonth();
    const currentYear = selectedDate.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    
    // Helper to get a specific day of the month, ensuring it's within bounds
    const getDateForDay = (dayOfMonth: number) => {
      const validDay = Math.max(1, Math.min(dayOfMonth, daysInMonth));
      const date = new Date(currentYear, currentMonth, validDay);
      return date.toISOString().split('T')[0];
    };
    
    // Use specific day numbers spread throughout the month
    // These will be different days regardless of what month it is
    // Adjust if month has fewer days
    const alertDays = [
      Math.min(3, daysInMonth),   // Day 3
      Math.min(8, daysInMonth),   // Day 8
      Math.min(12, daysInMonth),  // Day 12
      Math.min(17, daysInMonth),  // Day 17
      Math.min(22, daysInMonth), // Day 22
    ];
    
    // Ensure all days are unique
    const uniqueDays: number[] = [];
    alertDays.forEach(day => {
      if (!uniqueDays.includes(day)) {
        uniqueDays.push(day);
      } else {
        // If duplicate, find next available day
        let nextDay = day + 1;
        while (uniqueDays.includes(nextDay) && nextDay <= daysInMonth) {
          nextDay++;
        }
        if (nextDay <= daysInMonth) {
          uniqueDays.push(nextDay);
        }
      }
    });
    
    // Spread alerts across different days - like real appointments would be
    return [
      {
        id: "demo-alert-1",
        icon: "AlertTriangle",
        title: "Urgent Meeting",
        description: "Important client call",
        date: getDateForDay(uniqueDays[0] || 3),
        time: "14:00",
      },
      {
        id: "demo-alert-2",
        icon: "CalendarCheck",
        title: "Deadline",
        description: "Project due Friday",
        date: getDateForDay(uniqueDays[1] || 8),
        time: undefined,
      },
      {
        id: "demo-alert-3",
        icon: "Info",
        title: "New Event",
        description: "Team sync added",
        date: getDateForDay(uniqueDays[2] || 12),
        time: "10:30",
      },
      {
        id: "demo-alert-4",
        icon: "CheckCircle",
        title: "All Set",
        description: "3 events this week",
        date: getDateForDay(uniqueDays[3] || 17),
        time: undefined,
      },
      {
        id: "demo-alert-5",
        icon: "AlertCircle",
        title: "Time Conflict",
        description: "2 meetings overlap",
        date: getDateForDay(uniqueDays[4] || 22),
        time: "15:00",
      },
    ] as CustomAlert[];
  }, [showDemoCalendar, selectedDate]);

  // Initialize demo alerts state when entering demo mode
  useEffect(() => {
    if (showDemoCalendar && demoAlertsState.length === 0) {
      setDemoAlertsState(demoCustomAlerts);
    }
  }, [showDemoCalendar, demoCustomAlerts, demoAlertsState.length]);

  // For authenticated users, never show demo alerts
  // Only combine demo alerts if demo mode is explicitly enabled
  const allCustomAlerts = useMemo(() => {
    if (showDemoCalendar && shouldUseDemoMode) {
      return [...(demoAlertsState.length > 0 ? demoAlertsState : demoCustomAlerts), ...customAlerts];
    }
    return customAlerts;
  }, [showDemoCalendar, shouldUseDemoMode, demoAlertsState, demoCustomAlerts, customAlerts]);
  
  // Wait for access to be determined before showing stats to prevent flashing
  const isAccessReady = !accessLoading;
  
  // Use preview mode only if user doesn't have access (not for demo mode)
  const isPreview = isAccessReady && !hasAccess && !shouldUseDemoMode;
  
  // For authenticated users, always use real stats (or empty stats if no data)
  // Never show fake numbers for authenticated users
  const latestStats = useMemo(() => {
    if (!isAccessReady) {
      // Return empty stats while loading to prevent flash
      return emptyAgentStats;
    }
    
    // If we have real stats, use them
    if (stats) {
      return stats;
    }
    
    // If no stats and user is authenticated, return empty stats (0s)
    // Only use fallback for preview mode (unauthenticated users)
    if (isPreview) {
      return emptyAgentStats;
    }
    
    // For authenticated users with no stats yet, return empty stats
    return emptyAgentStats;
  }, [stats, isAccessReady, isPreview]);
  
  const noStats = !stats && !loading && !error;
  
  const agentConfig = AGENT_BY_ID["sync"];

  // Email connection and loading
  useEffect(() => {
    if (activeTab === "email") {
      checkGmailConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Check Gmail connection when authenticated
  useEffect(() => {
    if (isAuthenticated && activeTab === "email") {
      checkGmailConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected") === "true") {
      setIsGmailConnected(true);
      // Trigger initial sync when Gmail is first connected
      const triggerInitialSync = async () => {
        try {
          const { data: { session } } = await supabaseBrowserClient.auth.getSession();
          if (!session?.access_token) return;
          
          // Trigger initial sync in the background
          await fetch("/api/gmail/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ type: "initial" }),
          });
          
          // Wait a bit for sync to start, then load emails
          setTimeout(async () => {
            await loadGmailEmails();
            await checkGmailConnection();
            // Refetch stats after initial sync
            await fetchSyncStats();
          }, 2000);
        } catch (error) {
          console.error("Error triggering initial sync:", error);
          // Still load emails even if sync fails
          await loadGmailEmails();
          await checkGmailConnection();
          // Refetch stats even if sync fails
          await fetchSyncStats();
        }
      };
      
      triggerInitialSync();
      window.history.replaceState({}, "", "/sync");
    }
    if (params.get("calendar_connected") === "true") {
      setIsCalendarConnected(true);
      loadCalendarEvents();
      // Switch to calendar tab if specified
      if (params.get("tab") === "calendar") {
        setActiveTab("calendar");
      }
      window.history.replaceState({}, "", "/sync");
    }
    
    // Show error messages if OAuth failed
    const error = params.get("error");
    if (error) {
      const errorDetails = params.get("details");
      let errorMessage = "Failed to connect Gmail";
      
      if (error === "invalid_request" || error === "access_denied") {
        errorMessage = "OAuth Access Blocked\n\n";
        errorMessage += "This usually means:\n";
        errorMessage += "1. OAuth consent screen is not configured\n";
        errorMessage += "2. Your email is not added as a test user\n";
        errorMessage += "3. Required scopes are not added\n\n";
        errorMessage += "Fix:\n";
        errorMessage += "1. Go to: https://console.cloud.google.com/apis/credentials/consent\n";
        errorMessage += "2. Configure OAuth consent screen\n";
        errorMessage += "3. Add Gmail scopes (gmail.readonly, gmail.modify)\n";
        errorMessage += "4. Add your email as a TEST USER\n";
        errorMessage += "5. Save and try again";
      } else if (error === "oauth_not_configured") {
        errorMessage = "Gmail OAuth is not configured.\n\n";
        errorMessage += "Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env.local file.\n\n";
        errorMessage += "Visit /api/gmail/check-config to check your configuration.";
      } else if (error === "redirect_uri_mismatch" || error.includes("redirect_uri")) {
        errorMessage = "Redirect URI Mismatch Error\n\n";
        errorMessage += "The redirect URI doesn't match what's configured in Google Cloud Console.\n\n";
        errorMessage += "Fix:\n";
        errorMessage += "1. Visit /api/gmail/check-config to see your current redirect URI\n";
        errorMessage += "2. Go to: https://console.cloud.google.com/apis/credentials\n";
        errorMessage += "3. Click on your OAuth 2.0 Client ID\n";
        errorMessage += "4. Under 'Authorized redirect URIs', add the EXACT redirect URI shown in step 1\n";
        errorMessage += "5. Make sure there are NO trailing slashes\n";
        errorMessage += "6. Save and try again";
      } else if (error === "token_exchange_failed" || error.includes("token_exchange") || error.includes("invalid_client") || error.includes("Gmail OAuth client configuration")) {
        errorMessage = "Gmail OAuth Configuration Error\n\n";
        errorMessage += "This usually means:\n";
        errorMessage += "1. The redirect URI doesn't match Google Cloud Console\n";
        errorMessage += "2. The Client ID or Secret is incorrect or missing\n";
        errorMessage += "3. The OAuth client doesn't exist in Google Cloud Console\n";
        errorMessage += "4. The authorization code expired\n\n";
        errorMessage += "IMPORTANT: Gmail OAuth is SEPARATE from Supabase Google login.\n";
        errorMessage += "You need separate OAuth credentials for Gmail integration.\n\n";
        errorMessage += "Fix:\n";
        errorMessage += "1. Visit /api/gmail/check-config to see your current redirect URI\n";
        errorMessage += "2. Go to: https://console.cloud.google.com/apis/credentials\n";
        errorMessage += "3. Create or select OAuth 2.0 Client ID (type: Web application)\n";
        errorMessage += "4. Add the EXACT redirect URI from step 1 to 'Authorized redirect URIs'\n";
        errorMessage += "5. Copy the Client ID and Client Secret\n";
        errorMessage += "6. Set in .env.local:\n";
        errorMessage += "   GMAIL_CLIENT_ID=<your_client_id>\n";
        errorMessage += "   GMAIL_CLIENT_SECRET=<your_client_secret>\n";
        errorMessage += "7. Restart your dev server";
        if (errorDetails) {
          errorMessage += "\n\nDetails: " + errorDetails;
        }
      } else if (error === "missing_code") {
        errorMessage = "OAuth callback error: Missing authorization code.\n\n";
        errorMessage += "Please try connecting Gmail again.";
      } else if (errorDetails) {
        errorMessage = errorDetails;
      } else {
        errorMessage = `OAuth error: ${error}\n\n`;
        errorMessage += "Visit /api/gmail/check-config to check your configuration.";
      }
      
      alert(errorMessage);
      window.history.replaceState({}, "", "/sync");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calendar functions - defined before useEffects that use them
  const loadCalendarEvents = useCallback(async () => {
    try {
      setIsLoadingEvents(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const startDate = new Date(selectedDate);
      startDate.setDate(1);
      const endDate = new Date(selectedDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);

      const res = await fetch(
        `/api/calendar/events?start=${startDate.toISOString()}&end=${endDate.toISOString()}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      // Check if user logged in with Google OAuth provider
      const { data: { session: checkSession } } = await supabaseBrowserClient.auth.getSession();
      const isGoogleUser = checkSession?.user?.app_metadata?.provider === "google" || 
                          checkSession?.user?.identities?.some((identity: any) => identity.provider === "google");

      if (!res.ok) {
        if (res.status === 401) {
          // Only set to false if not a Google user (Google users stay "connected" in UI)
          if (!isGoogleUser) {
            setIsCalendarConnected(false);
          }
          return;
        }
        throw new Error("Failed to fetch events");
      }

      const data = await res.json();
      if (data.ok && data.events) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error("Error loading calendar events:", error);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [selectedDate]);

  const checkCalendarConnection = useCallback(async () => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      // Check if user logged in with Google OAuth provider
      const isGoogleUser = session.user?.app_metadata?.provider === "google" || 
                          session.user?.identities?.some((identity: any) => identity.provider === "google");

      // If user logged in with Google, consider Calendar connected
      if (isGoogleUser) {
        setIsCalendarConnected(true);
        loadCalendarEvents();
        return;
      }

      // Otherwise, check for Calendar connection in database
      const res = await fetch("/api/calendar/events?check=true", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setIsCalendarConnected(true);
        loadCalendarEvents();
      }
    } catch (error) {
      console.error("Error checking calendar connection:", error);
    }
  }, [loadCalendarEvents]);

  // Calendar connection and loading
  useEffect(() => {
    if (activeTab === "calendar") {
      checkCalendarConnection();
    }
  }, [activeTab, checkCalendarConnection]);

  useEffect(() => {
    if (isCalendarConnected && activeTab === "calendar") {
      loadCalendarEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalendarConnected, selectedDate, activeTab]);

  // Gmail functions
  const checkGmailConnection = async () => {
    try {
      if (!isAuthenticated) return;
      
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      // Check Gmail connection status using dedicated endpoint
      const res = await fetch("/api/gmail/status", {
        headers: { 
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const status: SyncStatus = await res.json();
        setSyncStatus(status);
        setIsGmailConnected(status.connected);
        
        if (status.connected) {
          loadGmailEmails();
        }
      } else if (res.status === 401) {
        setIsGmailConnected(false);
        setSyncStatus({ connected: false });
      } else {
        // If status endpoint fails, assume not connected
        setIsGmailConnected(false);
        setSyncStatus({ connected: false });
      }
    } catch (error) {
      console.error("Error checking Gmail connection:", error);
      setIsGmailConnected(false);
      setSyncStatus({ connected: false });
    }
  };

  const handleConnectGmail = async () => {
    // First check if user is authenticated
    if (!isAuthenticated) {
      openAuthModal("login");
      return;
    }

    try {
      setIsConnectingGmail(true);
      
      // Get session first
      const { data: { session }, error: sessionError } = await supabaseBrowserClient.auth.getSession();
      
      if (!session?.user) {
        setIsConnectingGmail(false);
        openAuthModal("login");
        return;
      }
      
      // Check if OAuth is configured (using unified config endpoint)
      try {
        const configCheck = await fetch("/api/sync/google/check-config");
        const configData = await configCheck.json();
        if (!configData.configured) {
          setIsConnectingGmail(false);
          let errorMsg = "Google OAuth is not properly configured:\n\n";
          if (configData.issues && configData.issues.length > 0) {
            errorMsg += configData.issues.join("\n");
          }
          if (configData.instructions) {
            errorMsg += "\n\n" + configData.instructions.join("\n");
          }
          alert(errorMsg);
          return;
        }
      } catch (configError) {
        console.warn("Could not check Google OAuth config:", configError);
        // Continue anyway - might be a network issue
      }
      
      // Use unified Google OAuth endpoint (supports both Gmail and Calendar)
      // This will connect both Gmail and Calendar in a single OAuth flow
      const res = await fetch("/api/sync/google/oauth-url?returnTo=/sync", {
        headers: { 
          Cookie: document.cookie, // Session cookie for auth
        },
      });

      if (!res.ok) {
        setIsConnectingGmail(false);
        
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        
        if (res.status === 401 || data.error === "Unauthorized") {
          // User needs to log in
          alert("Please log in to connect Google services.\n\nYou'll be redirected to the login page.");
          openAuthModal("login");
          return;
        }
        
        // Show specific error message
        const errorMsg = data.error || "Failed to connect Google services";
        const details = data.details ? `\n\nDetails: ${data.details}` : "";
        
        if (errorMsg.includes("not configured") || errorMsg.includes("GOOGLE_CLIENT_ID")) {
          alert(
            "Google OAuth is not properly configured.\n\n" +
            "Setup Steps:\n" +
            "1. Go to https://console.cloud.google.com/\n" +
            "2. Create or select a project\n" +
            "3. Enable Gmail API and Calendar API (APIs & Services → Library)\n" +
            "4. Go to APIs & Services → Credentials\n" +
            "5. Click + CREATE CREDENTIALS → OAuth client ID\n" +
            "6. Application type: Web application\n" +
            "7. Add redirect URI: http://localhost:3000/api/sync/google/callback (dev) or https://ovrsee.ai/api/sync/google/callback (prod)\n" +
            "8. Copy the Client ID and Client Secret\n" +
            "9. Open .env.local and add:\n" +
            "    GOOGLE_CLIENT_ID=your_actual_client_id\n" +
            "    GOOGLE_CLIENT_SECRET=your_actual_client_secret\n" +
            "    GOOGLE_OAUTH_REDIRECT_URL=http://localhost:3000/api/sync/google/callback\n" +
            "10. Restart your dev server\n\n" +
            "See GOOGLE_OAUTH_COMPREHENSIVE_AUDIT.md for detailed instructions."
          );
        } else {
          alert(`Failed to connect Google services: ${errorMsg}${details}`);
        }
        return;
      }
      
      const data = await res.json();
      
      if (!data.url) {
        setIsConnectingGmail(false);
        alert("Failed to get Google OAuth authorization URL. Please check your OAuth configuration.");
        return;
      }

      // Redirect directly to OAuth URL
      // This will authorize both Gmail and Calendar in one flow
      window.location.href = data.url;
    } catch (error) {
      console.error("Error connecting Google services:", error);
      setIsConnectingGmail(false);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        alert(
          "Network error connecting to Google services.\n\n" +
          "Please check:\n" +
          "1. Your internet connection\n" +
          "2. That the server is running\n" +
          "3. That Google OAuth is configured in Google Cloud Console"
        );
      } else {
        alert(`Failed to connect Google services: ${errorMessage}\n\nCheck the browser console for more details.`);
      }
    }
  };

  // Automatic categorization - runs when emails are loaded
  const categorizeEmailsAutomatically = useCallback(async (emailIds: string[]) => {
    if (!isAuthenticated || emailIds.length === 0) return;
    
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      // Call categorize API silently in background
      const res = await fetch("/api/sync/email/categorize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ids: emailIds }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Update local state with new categories
        if (data.items && data.items.length > 0) {
          const categoryMap = new Map<string, string>(data.items.map((item: { id: string; category: string }) => [item.id, item.category]));
          
          // Update emailQueueItems
          setEmailQueueItems((prev) =>
            prev.map((item) => {
              const newCategory = categoryMap.get(item.id);
              if (newCategory) {
                return { ...item, category: newCategory as string };
              }
              return item;
            })
          );

          // Update gmailEmails
          setGmailEmails((prev) =>
            prev.map((email) => {
              const newCategory = categoryMap.get(email.id);
              if (newCategory) {
                return { ...email, categoryId: newCategory };
              }
              return email;
            })
          );

          // Update selected email if it was categorized
          if (selectedEmail && "id" in selectedEmail) {
            const newCategory = categoryMap.get(selectedEmail.id);
            if (newCategory) {
              setSelectedEmail({ ...selectedEmail, category: newCategory, categoryId: newCategory } as typeof selectedEmail);
            }
          }
        }
      }
    } catch (error: any) {
      // Silently fail - categorization is not critical
      console.error("Error auto-categorizing emails:", error);
    }
  }, [isAuthenticated, selectedEmail]);

  const loadGmailEmails = useCallback(async () => {
    try {
      if (!isAuthenticated) return;
      
      setIsLoadingEmails(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setIsLoadingEmails(false);
        return;
      }

      // Fetch from email queue API - show all non-deleted emails (not just "open" status)
      // Include category filter if active
      // Always include counts to get follow-ups count
      let url = `/api/email-queue?includeDeleted=false&inboxOnly=false&includeCounts=true`;
      if (activeCategory === "followups") {
        url += `&filter=followups&sort=priority`;
      } else if (activeCategory) {
        url += `&category=${activeCategory}`;
      } else {
        url += `&sort=priority`; // Default to priority sort
      }
      
      const res = await fetch(url, {
        headers: { 
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setIsGmailConnected(false);
        }
        return;
      }

      const data = await res.json();
      if (data.emails) {
        setEmailQueueItems(data.emails);
        
        // Update follow-up count from API metadata if available, otherwise calculate from emails
        if (data.meta?.followupsCount !== undefined) {
          setFollowUpCount(data.meta.followupsCount);
        } else if (isFollowUpSuggestionsEnabled()) {
          // Fallback: count from current email set (only accurate when viewing all emails)
          if (activeCategory === null || activeCategory === "followups") {
            const followUps = data.emails.filter((e: any) => e.hasFollowUpSuggestion || e.hasUrgentTasks || e.hasUrgentReminders);
            setFollowUpCount(followUps.length);
          }
        }
        
        // Also set gmailEmails for backward compatibility with existing UI
        const formattedEmails: GmailEmail[] = data.emails.map((item: EmailQueueItem & { lead?: any; hasFollowUpSuggestion?: boolean; priority_score?: number; hasPreparedDraft?: boolean; preparedDraft?: any }) => ({
          id: item.id,
          sender: item.from_name || item.from_address,
          fromAddress: item.from_address,
          subject: item.subject,
          snippet: item.snippet || "",
          body: item.body_html || item.body_text || undefined,
          timestamp: new Date(item.internal_date).toISOString(),
          categoryId: item.category || undefined,
          draft: item.hasPreparedDraft && item.preparedDraft ? item.preparedDraft.draftBody : (item.ai_draft || undefined),
          status: item.queue_status === "done" ? "archived" : item.queue_status === "open" ? "needs_reply" : "drafted",
          lead: item.lead,
          hasFollowUpSuggestion: item.hasFollowUpSuggestion,
          priorityScore: item.priority_score,
          hasPreparedDraft: item.hasPreparedDraft,
          preparedDraftId: item.preparedDraft?.id,
        }));
        setGmailEmails(formattedEmails);
        
        if (data.emails.length > 0 && !selectedEmail) {
          setSelectedEmail(data.emails[0]);
        }
        
        // Automatically categorize uncategorized emails in background
        const uncategorizedIds = data.emails
          .filter((e: EmailQueueItem) => !e.category)
          .map((e: EmailQueueItem) => e.id);
        if (uncategorizedIds.length > 0) {
          categorizeEmailsAutomatically(uncategorizedIds);
        }
      }
    } catch (error) {
      console.error("Error loading Gmail emails:", error);
    } finally {
      setIsLoadingEmails(false);
    }
  }, [activeCategory, isAuthenticated, selectedEmail, categorizeEmailsAutomatically]);

  const triggerSync = async () => {
    try {
      if (!isAuthenticated) return;
      
      setIsSyncing(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setIsSyncing(false);
        return;
      }

      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: "incremental" }),
      });

      if (res.ok) {
        const result = await res.json();
        // Refresh sync status and emails
        await checkGmailConnection();
        await loadGmailEmails();
        
        // Refetch stats to update alert category counts
        await fetchSyncStats();
        
        return result;
      } else {
        throw new Error("Sync failed");
      }
    } catch (error) {
      console.error("Error triggering sync:", error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };


  const handleRefresh = async () => {
    try {
      if (!isAuthenticated || isRefreshing) return;
      
      setIsRefreshing(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setIsRefreshing(false);
        return;
      }

      // Trigger Gmail sync
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: "incremental" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Gmail sync failed");
      }

      const result = await res.json();
      
      // Refresh sync status and email queue
      await checkGmailConnection();
      await loadGmailEmails();
      
      // Refetch stats to update alert category counts
      await fetchSyncStats();
      
      return result;
    } catch (error: any) {
      console.error("Error refreshing inbox:", error);
      alert("Gmail sync failed. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };


  const handleConnectCalendar = async () => {
    // Use the same unified OAuth flow as Gmail (connects both services)
    // Redirect to handleConnectGmail which uses the unified endpoint
    handleConnectGmail();
  };

  const handleDisconnectGmail = async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      setIsDisconnecting(true);
      
      // Get session
      const { data: { session }, error: sessionError } = await supabaseBrowserClient.auth.getSession();
      
      if (!session?.access_token) {
        setIsDisconnecting(false);
        return;
      }

      // Call disconnect API
      const res = await fetch("/api/gmail/disconnect", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to disconnect Gmail");
      }

      // Close modal and refresh status
      setShowDisconnectModal(false);
      setIsGmailConnected(false);
      setSyncStatus({ connected: false });
      
      // Clear emails
      setGmailEmails([]);
      setEmailQueueItems([]);
      
      // Refresh connection status
      await checkGmailConnection();
    } catch (error: any) {
      console.error("Error disconnecting Gmail:", error);
      alert(error.message || "Failed to disconnect Gmail. Please try again.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setNoteText(event.notes || "");
    setMemoText(event.memo || "");
    setReminderText(event.reminder || "");
    setShowEventModal(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedEvent) return;

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/calendar/events/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          notes: noteText,
          memo: memoText,
          reminder: reminderText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setEvents((prev) =>
            prev.map((e) =>
              e.id === selectedEvent.id
                ? { ...e, notes: noteText, memo: memoText, reminder: reminderText }
                : e
            )
          );
          setSelectedEvent({ ...selectedEvent, notes: noteText, memo: memoText, reminder: reminderText });
          setEditingNote(false);
        }
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      alert("Failed to save notes");
    }
  };

  // Email handlers
  // For authenticated users, only show real emails from email queue
  // Never show mock/demo emails for authenticated users
  const displayEmails = useMemo(() => {
    // If user is authenticated, only show real emails (never mock data)
    if (isAuthenticated && !shouldUseDemoMode) {
      return gmailEmails.map((email) => ({
        id: email.id,
        sender: email.sender,
        fromAddress: email.fromAddress,
        subject: email.subject,
        timestamp: new Date(email.timestamp).toLocaleDateString(),
        categoryId: email.categoryId || undefined, // Keep undefined for uncategorized
        status: email.status || "needs_reply",
        snippet: email.snippet,
        draft: email.draft || "",
        body: email.body || undefined, // Preserve body content for HTML rendering
      }));
    }
    
    // For preview mode (unauthenticated), return empty array
    // Demo mode is disabled, so we don't show mock emails
    return [];
  }, [gmailEmails, isAuthenticated, shouldUseDemoMode]);

  const filteredEmails = useMemo(() => {
    let filtered = displayEmails;
    
    // Apply category filter
    if (activeCategory) {
      filtered = filtered.filter((email) => {
        if (activeCategory === "other") {
          return !email.categoryId || email.categoryId === "other";
        }
        return email.categoryId === activeCategory;
      });
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((email) => {
        // Search in sender name/address
        const senderMatch = email.sender?.toLowerCase().includes(query) || 
                           email.fromAddress?.toLowerCase().includes(query);
        
        // Search in subject
        const subjectMatch = email.subject?.toLowerCase().includes(query);
        
        // Search in snippet
        const snippetMatch = email.snippet?.toLowerCase().includes(query);
        
        return senderMatch || subjectMatch || snippetMatch;
      });
    }
    
    return filtered;
  }, [activeCategory, displayEmails, searchQuery]);

  // State for follow-up count
  const [followUpCount, setFollowUpCount] = useState<number>(0);

  // Update alert categories with real counts based on actual email data
  const alertCategories = useMemo(() => {
    // Define the 8 fixed categories using the config (including Follow-ups)
    const categoryDefinitions = [
      { id: "important", name: "Important", icon: CATEGORY_CONFIG.important.icon, color: "#ef4444", bgColor: CATEGORY_CONFIG.important.bgColor, textColor: CATEGORY_CONFIG.important.textColor, borderColor: CATEGORY_CONFIG.important.borderColor },
      { id: "missed_unread", name: "Missed / Unread", icon: CATEGORY_CONFIG.missed_unread.icon, color: "#fb923c", bgColor: CATEGORY_CONFIG.missed_unread.bgColor, textColor: CATEGORY_CONFIG.missed_unread.textColor, borderColor: CATEGORY_CONFIG.missed_unread.borderColor },
      { id: "followups", name: "Follow-ups", icon: CATEGORY_CONFIG.followups.icon, color: "#fb923c", bgColor: CATEGORY_CONFIG.followups.bgColor, textColor: CATEGORY_CONFIG.followups.textColor, borderColor: CATEGORY_CONFIG.followups.borderColor },
      { id: "payment_bill", name: "Payments / Bills", icon: CATEGORY_CONFIG.payment_bill.icon, color: "#22c55e", bgColor: CATEGORY_CONFIG.payment_bill.bgColor, textColor: CATEGORY_CONFIG.payment_bill.textColor, borderColor: CATEGORY_CONFIG.payment_bill.borderColor },
      { id: "invoice", name: "Invoices", icon: CATEGORY_CONFIG.invoice.icon, color: "#a855f7", bgColor: CATEGORY_CONFIG.invoice.bgColor, textColor: CATEGORY_CONFIG.invoice.textColor, borderColor: CATEGORY_CONFIG.invoice.borderColor },
      { id: "marketing", name: "Marketing", icon: CATEGORY_CONFIG.marketing.icon, color: "#3b82f6", bgColor: CATEGORY_CONFIG.marketing.bgColor, textColor: CATEGORY_CONFIG.marketing.textColor, borderColor: CATEGORY_CONFIG.marketing.borderColor },
      { id: "updates", name: "Updates", icon: CATEGORY_CONFIG.updates.icon, color: "#06b6d4", bgColor: CATEGORY_CONFIG.updates.bgColor, textColor: CATEGORY_CONFIG.updates.textColor, borderColor: CATEGORY_CONFIG.updates.borderColor },
      { id: "other", name: "Other", icon: CATEGORY_CONFIG.other.icon, color: "#94a3b8", bgColor: CATEGORY_CONFIG.other.bgColor, textColor: CATEGORY_CONFIG.other.textColor, borderColor: CATEGORY_CONFIG.other.borderColor },
    ];

    // Count emails by category
    const categoryCounts = new Map<string, number>();
    categoryDefinitions.forEach((cat) => categoryCounts.set(cat.id, 0));

    // Count from displayEmails
    displayEmails.forEach((email) => {
      const category = email.categoryId || "other"; // Treat null as "other"
      const current = categoryCounts.get(category) || 0;
      categoryCounts.set(category, current + 1);
    });

    // Return categories with counts
    return categoryDefinitions.map((cat) => ({
      ...cat,
      count: categoryCounts.get(cat.id) || 0,
    }));
  }, [displayEmails]);

  // Drag handle removed - using fixed scrollable layout

  const categoryMap = Object.fromEntries(alertCategories.map((cat) => [cat.id, cat]));

  const handleChat = async (event: FormEvent<HTMLFormElement>) => {
    // Disable in preview mode
    if (isPreview) {
      event.preventDefault();
      setChatMessages((prev) => [
        ...prev,
        { role: "agent", text: "This feature requires a Basic or higher subscription. Upgrade to unlock full Sync agent access." },
      ]);
      return;
    }
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("message") as HTMLInputElement;
    if (!input.value.trim() || !selectedEmail) return;

    const userMessage = input.value.trim();

    setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    input.value = "";
    setIsProcessing(true);

    // Determine processing label based on user message
    const lowerMessage = userMessage.toLowerCase();
    if (lowerMessage.includes("summarize") || lowerMessage.includes("summary")) {
      setProcessingLabel("Sync is summarizing this thread...");
    } else if (lowerMessage.includes("rewrite") || lowerMessage.includes("shorter") || lowerMessage.includes("change the draft") || lowerMessage.includes("edit the draft") || lowerMessage.includes("update the draft")) {
      setProcessingLabel("Sync is rewriting your draft...");
    } else {
      setProcessingLabel("Sync is reviewing this conversation...");
    }

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setChatMessages((prev) => [
          ...prev,
          { role: "agent", text: "Please log in to use this feature." },
        ]);
        setIsProcessing(false);
        return;
      }

      // Get current draft body
      const currentDraft = getEmailDraft(selectedEmail) || null;

      // Call the conversational chat endpoint
      const res = await fetch(`/api/sync/email/${selectedEmail.id}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          draftBody: currentDraft,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("Chat API error:", json);
        setChatMessages((prev) => [
          ...prev,
          { role: "agent", text: `Sorry, I encountered an error: ${json.error || "Unknown error"}` },
        ]);
        setIsProcessing(false);
        return;
      }

      // Handle different response types
      const responseType = json.type || "answer";
      const message = json.message || "I've processed your request.";

      // Handle draft_update: update the draft state
      if (responseType === "draft_update" && json.draftBody && selectedEmail) {
        // Update email queue items
        setEmailQueueItems((prev) =>
          prev.map((e) =>
            e.id === selectedEmail.id
              ? { ...e, ai_draft: json.draftBody, ai_draft_generated_at: new Date().toISOString() }
              : e
          )
        );
        
        // Update Gmail emails if applicable
        setGmailEmails((prev) =>
          prev.map((e) =>
            e.id === selectedEmail.id ? { ...e, draft: json.draftBody, ai_draft: json.draftBody } : e
          )
        );
        
        // Update selected email
        setSelectedEmail({
          ...selectedEmail,
          ai_draft: json.draftBody,
          ai_draft_generated_at: new Date().toISOString(),
        });

        // Show a brief visual indicator (optional - could add toast here)
        // For now, the message itself will indicate the draft was updated
      }

      // Add response to chat (for all types: answer, draft_update, clarification)
      setChatMessages((prev) => [
        ...prev,
        { role: "agent", text: message },
      ]);

      // Scroll chat to bottom (using setTimeout to ensure DOM update)
      setTimeout(() => {
        const chatContainer = document.querySelector('[data-chat-container]');
        if (chatContainer) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 100);
    } catch (err) {
      console.error("Error calling Sync Chat API:", err);
      setChatMessages((prev) => [
        ...prev,
        { role: "agent", text: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsProcessing(false);
      setProcessingLabel("Sync is thinking...");
    }
  };

  const handleEmailSelect = async (email: EmailRecord | GmailEmail | EmailQueueItem) => {
    // Look up the full email from emailQueueItems or gmailEmails to preserve body content
    const fullEmail = emailQueueItems.find(e => e.id === email.id) 
      || gmailEmails.find(e => e.id === email.id)
      || email;
    
    // Merge the selected email with full email data to ensure body content is preserved
    const emailWithBody = {
      ...email,
      ...(fullEmail && {
        body: "body" in fullEmail ? fullEmail.body : undefined,
        body_html: "body_html" in fullEmail ? fullEmail.body_html : undefined,
        body_text: "body_text" in fullEmail ? fullEmail.body_text : undefined,
      }),
    };
    
    setSelectedEmail(emailWithBody);
    // Initialize chat history for this email if it doesn't exist
    setChatHistoryByEmailId((prev) => {
      if (!prev[email.id]) {
        return {
          ...prev,
          [email.id]: [
            { role: "agent", text: "Hi, I'm Sync. I can summarize this thread, help you understand what the customer wants, give you suggestions on how to respond, or rewrite the draft for you. What would you like to do?" }
          ],
        };
      }
      return prev;
    });
    
    // Fetch draft if email doesn't have one
    if (!("ai_draft" in email) || !email.ai_draft) {
      const emailId = email.id;
      setDraftLoading(prev => ({ ...prev, [emailId]: true }));
      setDraftError(prev => ({ ...prev, [emailId]: "" }));
      
      try {
        const { data: { session } } = await supabaseBrowserClient.auth.getSession();
        if (!session?.access_token) {
          setDraftLoading(prev => ({ ...prev, [emailId]: false }));
          return;
        }

        const res = await fetch(`/api/sync/email/draft/${emailId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        
        if (res.ok) {
          const data = await res.json();
          // Update email with draft
          setEmailQueueItems(prev => 
            prev.map(e => e.id === emailId ? { ...e, ai_draft: data.draft, ai_draft_generated_at: data.generatedAt } : e)
          );
          setGmailEmails(prev => 
            prev.map(e => e.id === emailId ? { ...e, draft: data.draft } : e)
          );
          setSelectedEmail({ ...email, ai_draft: data.draft, ai_draft_generated_at: data.generatedAt });
        } else {
          const errorData = await res.json().catch(() => ({}));
          setDraftError(prev => ({ ...prev, [emailId]: errorData.error || "Failed to generate draft" }));
        }
      } catch (error: any) {
        console.error("Error fetching draft:", error);
        setDraftError(prev => ({ ...prev, [emailId]: error.message || "Failed to generate draft" }));
      } finally {
        setDraftLoading(prev => ({ ...prev, [emailId]: false }));
      }
    }
  };

  // Helper functions to extract properties from different email types
  const getEmailSender = (email: EmailRecord | GmailEmail | EmailQueueItem | null): string => {
    if (!email) return "";
    if ("sender" in email) return email.sender;
    if ("from_name" in email) return email.from_name || email.from_address;
    return "";
  };

  const getEmailSnippet = (email: EmailRecord | GmailEmail | EmailQueueItem | null): string => {
    if (!email) return "";
    if ("snippet" in email) return email.snippet || "";
    return "";
  };

  const getEmailDraft = (email: EmailRecord | GmailEmail | EmailQueueItem | null): string => {
    if (!email) return "";
    
    // Check for prepared draft first (from API response)
    const emailWithDraft = email as any;
    if (emailWithDraft?.preparedDraft?.draftBody) {
      return emailWithDraft.preparedDraft.draftBody;
    }
    if (emailWithDraft?.hasPreparedDraft && emailWithDraft?.draft) {
      return emailWithDraft.draft;
    }
    
    // Check if email has ai_draft field (from API response)
    if ("ai_draft" in email && email.ai_draft) {
      return email.ai_draft;
    }
    
    // Fallback to legacy draft field (for mock data)
    if ("draft" in email) return email.draft || "";
    
    return "";
  };

  const handleEditDraft = () => {
    if (!selectedEmail) return;
    const draft = getEmailDraft(selectedEmail);
    if (!draft) {
      alert("No draft available. Please generate a draft first.");
      return;
    }
    setShowEditDraftModal(true);
  };

  const handleSaveDraftFromModal = async (editedDraft: string) => {
    if (!selectedEmail || !editedDraft.trim()) return;

    setIsSavingDraft(true);
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setIsSavingDraft(false);
        return;
      }

      const emailId = selectedEmail.id;

      // Update draft in database
      const res = await fetch(`/api/sync/email/draft/${emailId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ draft: editedDraft.trim() }),
      });

      if (res.ok) {
        // Update local state
        setEmailQueueItems((prev) =>
          prev.map((e) =>
            e.id === emailId
              ? { ...e, ai_draft: editedDraft.trim(), ai_draft_generated_at: new Date().toISOString() }
              : e
          )
        );
        setGmailEmails((prev) =>
          prev.map((e) =>
            e.id === emailId ? { ...e, draft: editedDraft.trim(), ai_draft: editedDraft.trim() } : e
          )
        );
        setSelectedEmail({
          ...selectedEmail,
          ai_draft: editedDraft.trim(),
          ai_draft_generated_at: new Date().toISOString(),
        });
        setShowEditDraftModal(false);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || "Failed to save draft");
      }
    } catch (error: any) {
      console.error("Error saving draft:", error);
      alert(`Failed to save draft: ${error.message || "Unknown error"}`);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleAcceptDraft = () => {
    if (!selectedEmail) return;
    
    const draft = getEmailDraft(selectedEmail);
    if (!draft) {
      alert("No draft available. Please generate a draft first.");
      return;
    }

    setShowSendModal(true);
  };

  const handleSendSuccess = () => {
    // Reload emails to reflect sent status
    loadGmailEmails();
    // Optionally show success toast
  };

  const getEmailSubject = (email: EmailRecord | GmailEmail | EmailQueueItem | null): string => {
    if (!email) return "";
    if ("subject" in email) return email.subject;
    return "";
  };

  const formatSyncTime = (lastSyncAt: string): string => {
    const syncDate = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - syncDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    return syncDate.toLocaleDateString();
  };

  // Icon mapping for custom alerts
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      AlertTriangle,
      CalendarCheck,
      Info,
      CheckCircle,
      AlertCircle,
      Clock,
      MapPin,
      Users,
    };
    return iconMap[iconName] || AlertTriangle;
  };

  // Handle adding custom alert
  const handleAddCustomAlert = () => {
    if (!newAlert.title || !newAlert.date) return;
    
    const dateTime = newAlert.time 
      ? new Date(`${newAlert.date}T${newAlert.time}`).toISOString()
      : undefined;
    
    const alert: CustomAlert = {
      id: `alert-${Date.now()}`,
      icon: newAlert.icon || "AlertTriangle",
      title: newAlert.title,
      description: newAlert.description || "",
      date: newAlert.date,
      time: newAlert.time,
      dateTime,
    };
    
    setCustomAlerts([...customAlerts, alert]);
    setNewAlert({
      icon: "AlertTriangle",
      title: "",
      description: "",
      date: "",
      time: "",
    });
    setShowAlertForm(false);
  };

  // Handle alert click - open modal
  const handleAlertClick = (alert: CustomAlert) => {
    setSelectedAlert(alert);
    setEditedAlert({ ...alert });
    setAlertNoteText((alert as any).notes || "");
    setAlertMemoText((alert as any).memo || "");
    setAlertReminderText((alert as any).reminder || "");
    setShowAlertModal(true);
    setEditingAlert(false);
    setEditingAlertNote(false);
  };

  // Handle updating alert
  const handleUpdateAlert = () => {
    if (!selectedAlert || !editedAlert.title || !editedAlert.date) return;
    
    const isDemo = selectedAlert.id.startsWith("demo-alert-");
    
    if (isDemo) {
      // In demo mode, update the demo alert in the state
      setDemoAlertsState(demoAlertsState.map(a => 
        a.id === selectedAlert.id 
          ? { ...a, ...editedAlert } as CustomAlert
          : a
      ));
      setSelectedAlert({ ...selectedAlert, ...editedAlert } as CustomAlert);
      setEditingAlert(false);
      return;
    }
    
    setCustomAlerts(customAlerts.map(a => 
      a.id === selectedAlert.id 
        ? { ...a, ...editedAlert } as CustomAlert
        : a
    ));
    setSelectedAlert({ ...selectedAlert, ...editedAlert } as CustomAlert);
    setEditingAlert(false);
  };

  // Handle deleting alert
  const handleDeleteAlert = () => {
    if (!selectedAlert) return;
    
    const isDemo = selectedAlert.id.startsWith("demo-alert-");
    
    if (isDemo) {
      // In demo mode, remove from demo alerts state
      setDemoAlertsState(demoAlertsState.filter(a => a.id !== selectedAlert.id));
      setShowAlertModal(false);
      setSelectedAlert(null);
      return;
    }
    
    setCustomAlerts(customAlerts.filter(a => a.id !== selectedAlert.id));
    setShowAlertModal(false);
    setSelectedAlert(null);
  };

  // Handle marking alert as complete
  const handleCompleteAlert = () => {
    if (!selectedAlert) return;
    
    const isDemo = selectedAlert.id.startsWith("demo-alert-");
    
    if (isDemo) {
      // In demo mode, remove from demo alerts state
      setDemoAlertsState(demoAlertsState.filter(a => a.id !== selectedAlert.id));
      setShowAlertModal(false);
      setSelectedAlert(null);
      return;
    }
    
    setCustomAlerts(customAlerts.filter(a => a.id !== selectedAlert.id));
    setShowAlertModal(false);
    setSelectedAlert(null);
  };

  // Calendar helpers - using date-fns utilities
  // All date/time operations now use date-fns for consistency and timezone handling

  // Group events by date (using local dates)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    displayEvents.forEach((event) => {
      const localDateString = getEventLocalDateString(event);
      if (localDateString) {
        if (!grouped[localDateString]) {
          grouped[localDateString] = [];
        }
        grouped[localDateString].push(event);
        
        // For multi-day events, also add to subsequent days
        if (isMultiDayEvent(event)) {
          const startDate = getEventLocalDate(event);
          if (startDate) {
            let currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + 1);
            
            let endDate: Date;
            if (event.end.dateTime) {
              endDate = new Date(event.end.dateTime);
            } else if (event.end.date) {
              const [year, month, day] = event.end.date.split('-').map(Number);
              endDate = new Date(year, month - 1, day - 1); // end is exclusive
            } else {
              endDate = startDate;
            }
            
            while (currentDate <= endDate) {
              const dateKey = getLocalDateString(currentDate);
              if (!grouped[dateKey]) {
                grouped[dateKey] = [];
              }
              grouped[dateKey].push(event);
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        }
      }
    });
    return grouped;
  }, [displayEvents]);

  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; events: CalendarEvent[] }> = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: new Date(year, month, -startingDayOfWeek + i + 1), events: [] });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = getLocalDateString(date);
      days.push({
        date,
        events: eventsByDate[dateKey] || [],
      });
    }

    return days;
  }, [selectedDate, eventsByDate]);

  // Weekly view days (using date-fns, week starts on Sunday)
  const weekDays = useMemo(() => {
    const days = getWeekDays(selectedDate, 0); // 0 = Sunday
    return days.map(date => ({
      date,
      events: eventsByDate[getLocalDateString(date)] || [],
    }));
  }, [selectedDate, eventsByDate]);

  // Get event category and color
  const getEventCategory = (event: CalendarEvent): { category: string; color: string; bgColor: string; borderColor: string } => {
    if (event.createdByAloha) {
      return {
        category: "aloha",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/30",
        borderColor: "border-red-200 dark:border-red-800",
      };
    }
    // Default to sync (blue) for now, can be extended based on event properties
    return {
      category: "sync",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-900/30",
      borderColor: "border-blue-200 dark:border-blue-800",
    };
  };

  // Calculate active time range (earliest and latest events ± 2 hours) using local times
  const activeTimeRange = useMemo(() => {
    const allEvents = weekDays.flatMap(day => day.events);
    const allAlerts = allCustomAlerts.filter(alert => {
      const alertDateString = getLocalDateString(new Date(alert.date));
      return weekDays.some(day => getLocalDateString(day.date) === alertDateString);
    });

    let minHour = 6; // Default start at 6 AM
    let maxHour = 22; // Default end at 10 PM

    // Find earliest/latest event using local time
    allEvents.forEach(event => {
      const localTime = getEventLocalTime(event);
      if (localTime) {
        // Only consider events that are actually in the current week
        const eventLocalDateString = getEventLocalDateString(event);
        const isInWeek = weekDays.some(day => getLocalDateString(day.date) === eventLocalDateString);
        if (isInWeek) {
          minHour = Math.min(minHour, localTime.hour);
          maxHour = Math.max(maxHour, localTime.hour);
        }
      }
    });

    // Find earliest/latest alert
    allAlerts.forEach(alert => {
      if (alert.time) {
        const [hours] = alert.time.split(':').map(Number);
        minHour = Math.min(minHour, hours);
        maxHour = Math.max(maxHour, hours);
      }
    });

    // Expand ± 2 hours
    minHour = Math.max(0, minHour - 2);
    maxHour = Math.min(23, maxHour + 2);

    return { minHour, maxHour };
  }, [weekDays, allCustomAlerts]);

  // Get hour position in pixels (40px per hour)
  const getHourPosition = (hour: number, minute: number = 0) => {
    return (hour - activeTimeRange.minHour) * 40 + (minute / 60) * 40;
  };

  // Check if hour should show label (every 3 hours)
  const shouldShowHourLabel = (hour: number) => {
    return hour % 3 === 0;
  };

  // Auto-scroll to first event on load
  useEffect(() => {
    if (calendarView === "week" && weekDays.length > 0) {
      const allEvents = weekDays.flatMap(day => day.events);
      const allAlerts = allCustomAlerts.filter(alert => {
        const alertDate = new Date(alert.date);
        return weekDays.some(day => day.date.toDateString() === alertDate.toDateString());
      });

      let earliestHour = activeTimeRange.minHour;
      
      // Find earliest event time
      allEvents.forEach(event => {
        if (event.start.dateTime) {
          const eventDate = new Date(event.start.dateTime);
          const hour = eventDate.getHours();
          if (hour >= activeTimeRange.minHour && hour <= activeTimeRange.maxHour) {
            earliestHour = Math.min(earliestHour, hour);
          }
        }
      });

      allAlerts.forEach(alert => {
        if (alert.time) {
          const [hours] = alert.time.split(':').map(Number);
          if (hours >= activeTimeRange.minHour && hours <= activeTimeRange.maxHour) {
            earliestHour = Math.min(earliestHour, hours);
          }
        }
      });

      // Scroll to first event (with some offset)
      const scrollContainer = document.querySelector('[data-week-calendar-scroll]');
      if (scrollContainer) {
        const scrollPosition = (earliestHour - activeTimeRange.minHour) * 40 - 100;
        scrollContainer.scrollTop = Math.max(0, scrollPosition);
      }
    }
  }, [calendarView, weekDays, allCustomAlerts, activeTimeRange]);

  return (
    <div className="space-y-8">
      {isPreview && (
        <PreviewBanner 
          agentName={agentConfig.label} 
          requiredTier={agentConfig.requiredTier}
        />
      )}
      <header>
        <p className="text-sm uppercase tracking-widest text-slate-500">{t("syncAgent")}</p>
        <h1 className="text-3xl font-semibold">{t("syncTitle")}</h1>
      </header>

      {/* Tab Bar */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("email")}
              className={`px-4 py-2 text-sm font-semibold transition ${
                activeTab === "email"
                  ? "border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              {t("syncEmailTab")}
            </button>
            {isTodayDashboardEnabled() && (
              <button
                type="button"
                onClick={() => setActiveTab("today")}
                className={`px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "today"
                    ? "border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                }`}
              >
                Today
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("calendar")}
              className={`px-4 py-2 text-sm font-semibold transition ${
                activeTab === "calendar"
                  ? "border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              {t("syncCalendarTab")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("insights")}
              className={`px-4 py-2 text-sm font-semibold transition ${
                activeTab === "insights"
                  ? "border-b-2 border-slate-900 text-slate-900 dark:border-white dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              Data
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isGmailConnected ? (
              <button
                onClick={handleConnectGmail}
                disabled={isConnectingGmail}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnectingGmail ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("syncConnecting")}
                  </>
                ) : (
                  <>
                    <Mail className="h-3.5 w-3.5" />
                    Connect your Gmail
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Connected to Gmail
                </div>
                <button
                  onClick={triggerSync}
                  disabled={isSyncing || isRefreshing}
                  className="p-1.5 rounded-full border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  title="Refresh inbox"
                  aria-label="Refresh inbox"
                >
                  {isSyncing || isRefreshing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={() => setShowDisconnectModal(true)}
                  disabled={isDisconnecting}
                  className="p-1.5 rounded-full border border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  title="Disconnect Gmail"
                  aria-label="Disconnect Gmail"
                >
                  <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "email" && (
          <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)]">
            {/* Top Bar: Connection Status & Stats */}
            <div className="flex-shrink-0 space-y-4 mb-4">
              {/* Sync Error Banner */}
              {isGmailConnected && syncStatus?.syncStatus === "error" && syncStatus.syncError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">Sync Error</p>
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{syncStatus.syncError}</p>
                      </div>
                    </div>
                    <button
                      onClick={triggerSync}
                      className="text-xs font-semibold text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* Category Filters */}
              {!shouldUseDemoMode && (
                <section className="rounded-2xl border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* All option */}
                    <button
                      onClick={() => {
                        setActiveCategory(null);
                        loadGmailEmails();
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition flex-shrink-0 ${
                        activeCategory === null
                          ? "bg-slate-900 text-white ring-2 ring-slate-700 dark:bg-white dark:text-slate-900 dark:ring-slate-300"
                          : "bg-white/80 text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} className="flex-shrink-0" />
                        <span>All</span>
                        {activeCategory === null && (
                          <span className="text-xs opacity-80 ml-1">
                            ({displayEmails.length})
                          </span>
                        )}
                      </div>
                    </button>
                    {/* Category chips */}
                    {getAllCategories().map((categoryId) => {
                      const categoryConfig = getCategoryConfig(categoryId);
                      const Icon = categoryConfig.icon;
                      // Use followUpCount for followups category, otherwise use alertCategories count
                      const count = categoryId === "followups" 
                        ? followUpCount 
                        : alertCategories.find((c) => c.id === categoryId)?.count || 0;
                      const isActive = activeCategory === categoryId;
                      
                      return (
                        <button
                          key={categoryId}
                          onClick={() => {
                            setActiveCategory(isActive ? null : categoryId);
                            loadGmailEmails();
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 flex-shrink-0 ${
                            isActive
                              ? `${categoryConfig.bgColor} ${categoryConfig.textColor} ring-2 ${categoryConfig.borderColor}`
                              : `${categoryConfig.bgColor} ${categoryConfig.textColor} border ${categoryConfig.borderColor} hover:opacity-80`
                          }`}
                        >
                          <Icon size={12} className="flex-shrink-0" />
                          <span>{categoryConfig.label}</span>
                          {count > 0 && (
                            <span className={`text-xs px-1 py-0.5 rounded-full ${isActive ? categoryConfig.badgeBg : "bg-white/50 dark:bg-black/20"}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* Two-Pane Layout: Email Client Style */}
            <div className="flex-1 flex gap-4 min-h-0">
              {/* Left Pane: Email Queue */}
              <aside className="flex flex-col w-[320px] md:w-[360px] flex-shrink-0 border-r border-slate-200 dark:border-slate-700 pr-4">
                {/* Email Queue Header */}
                <div className="flex-shrink-0 flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">{t("syncEmailQueue")}</h2>
                  <div className="flex items-center gap-2">
                    {isGmailConnected && emailQueueItems.length > 0 && (
                      <div className="relative flex items-center">
                        {isSearchExpanded ? (
                          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 shadow-sm">
                            <Search className="h-4 w-4 text-slate-500 flex-shrink-0" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search emails..."
                              className="bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 min-w-[200px]"
                              autoFocus
                              onBlur={() => {
                                // Keep expanded if there's a query
                                if (!searchQuery.trim()) {
                                  setIsSearchExpanded(false);
                                }
                              }}
                            />
                            {searchQuery && (
                              <button
                                onClick={() => {
                                  setSearchQuery("");
                                  setIsSearchExpanded(false);
                                }}
                                className="p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                title="Clear search"
                              >
                                <X className="h-3.5 w-3.5 text-slate-500" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsSearchExpanded(true)}
                            className="p-2 rounded-full border border-slate-200 bg-white/50 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition"
                            title="Search emails"
                          >
                            <Search className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email List - Scrollable */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {isLoadingEmails ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                      <span className="ml-2 text-sm text-slate-500">{t("syncLoadingEmails")}</span>
                    </div>
                  ) : filteredEmails.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-500">
                        {isGmailConnected 
                          ? "Gmail is connected, but there are no emails to show yet." 
                          : t("syncConnectGmailToView")}
                      </p>
                    </div>
                  ) : (
                    <div className="h-full overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredEmails.map((email) => {
                        const isSelected = selectedEmail?.id === email.id;
                        return (
                          <button
                          key={email.id}
                          onClick={() => handleEmailSelect(email)}
                          className={`w-full px-3 py-3 text-left transition-all duration-200 ${
                            isSelected 
                              ? "bg-slate-100 dark:bg-slate-800/60 border-l-4 border-l-slate-900 dark:border-l-white" 
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-l-4 hover:border-l-slate-700 dark:hover:border-l-slate-400 border-l-4 border-l-transparent"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold truncate flex-1">{email.sender}</p>
                            <span className="text-xs text-slate-500 ml-2 flex-shrink-0">{email.timestamp}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300 truncate mb-2">{email.subject}</p>
                          <div className="flex items-center gap-2 text-xs">
                            {(() => {
                              const categoryId = (email.categoryId || "other") as EmailCategory;
                              const categoryConfig = getCategoryConfig(categoryId);
                              const Icon = categoryConfig.icon;
                              return (
                                <span
                                  className={`rounded-full px-2 py-0.5 flex items-center gap-1 ${categoryConfig.badgeBg} ${categoryConfig.badgeText}`}
                                >
                                  <Icon size={10} className="flex-shrink-0" />
                                  <span className="truncate">{categoryConfig.label}</span>
                                </span>
                              );
                            })()}
                            {(email as any).hasPreparedDraft && (
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 text-xs font-semibold">
                                Draft ready
                              </span>
                            )}
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800 text-xs">
                              {email.status.replace("_", " ")}
                            </span>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </aside>

              {/* Right Pane: Email Detail + Draft Composer */}
              <section className="flex-1 flex flex-col min-w-0 min-h-0">
                {/* Email Detail View (Top, Scrollable) */}
                <div className="flex-1 overflow-y-auto border-b border-slate-200 dark:border-slate-700 pb-4">
                  {selectedEmail ? (
                    <div className="space-y-4">
                      {/* Email Header */}
                      <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h2 className="text-xl font-semibold">{getEmailSubject(selectedEmail) || "(No subject)"}</h2>
                              {isAiCopilotEnabled() && (
                                <button
                                  onClick={() => setShowCopilotPanel(!showCopilotPanel)}
                                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 transition"
                                  title="Open Copilot"
                                >
                                  <Sparkles className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                </button>
                              )}
                            </div>
                            
                            {/* CRM Micro-Panel */}
                            {isLeadScoringEnabled() && (selectedEmail as any).lead && (
                              <CRMMicroPanel 
                                lead={(selectedEmail as any).lead}
                                selectedEmail={selectedEmail}
                                setEmailQueueItems={setEmailQueueItems}
                              />
                            )}
                            
                            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
                              <div>
                                <span className="font-semibold">From:</span> {getEmailSender(selectedEmail)}
                              </div>
                              <div>
                                <span className="font-semibold">Date:</span> {(() => {
                                  if ("internal_date" in selectedEmail) {
                                    return new Date(selectedEmail.internal_date).toLocaleString();
                                  }
                                  if ("timestamp" in selectedEmail) {
                                    return new Date(selectedEmail.timestamp).toLocaleString();
                                  }
                                  return "Unknown";
                                })()}
                              </div>
                              {/* Follow-up button */}
                              {isFollowUpSuggestionsEnabled() && (selectedEmail as any).hasFollowUpSuggestion && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
                                      if (!session?.access_token) return;
                                      
                                      const res = await fetch(`/api/sync/email/${selectedEmail.id}/follow-up-draft`, {
                                        method: "POST",
                                        headers: {
                                          Authorization: `Bearer ${session.access_token}`,
                                        },
                                      });
                                      
                                      if (res.ok) {
                                        const data = await res.json();
                                        if (data.draft) {
                                          // Insert draft into composer
                                          const draft = getEmailDraft(selectedEmail);
                                          if (!draft || draft === t("syncPlaceholderDraft")) {
                                            // Update email with draft
                                            setEmailQueueItems((prev) =>
                                              prev.map((e) =>
                                                e.id === selectedEmail.id
                                                  ? { ...e, ai_draft: data.draft }
                                                  : e
                                              )
                                            );
                                            setGmailEmails((prev) =>
                                              prev.map((e) =>
                                                e.id === selectedEmail.id
                                                  ? { ...e, draft: data.draft, ai_draft: data.draft }
                                                  : e
                                              )
                                            );
                                            setSelectedEmail({
                                              ...selectedEmail,
                                              ai_draft: data.draft,
                                            } as any);
                                          }
                                        }
                                      }
                                    } catch (error) {
                                      console.error("Error generating follow-up draft:", error);
                                    }
                                  }}
                                  className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 flex items-center gap-1.5"
                                >
                                  <Clock size={12} />
                                  Follow-up suggested
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Email Body */}
                      {(() => {
                        const bodyText = "body_text" in selectedEmail ? selectedEmail.body_text : null;
                        const bodyHtml = "body_html" in selectedEmail ? selectedEmail.body_html : null;
                        const body = "body" in selectedEmail ? selectedEmail.body : null;
                        const snippet = getEmailSnippet(selectedEmail);
                        
                        // Helper to detect if content is HTML
                        const isHtml = (content: string | null | undefined): boolean => {
                          if (!content) return false;
                          // Check if content contains HTML tags
                          return /<[a-z][\s\S]*>/i.test(content);
                        };
                        
                        const hasHtmlContent = bodyHtml || (body && isHtml(body));
                        
                        // Priority: body_html > body (if HTML) > body_text > body (if text) > snippet
                        if (bodyHtml) {
                          // HTML email - render without prose classes to preserve original email styling (like Gmail)
                          return (
                            <div 
                              className="email-html-content"
                              style={{
                                maxWidth: '100%',
                                overflow: 'auto',
                              }}
                              dangerouslySetInnerHTML={{ __html: bodyHtml }}
                            />
                          );
                        } else if (body && isHtml(body)) {
                          // body property contains HTML - render without prose classes
                          return (
                            <div 
                              className="email-html-content"
                              style={{
                                maxWidth: '100%',
                                overflow: 'auto',
                              }}
                              dangerouslySetInnerHTML={{ __html: body }}
                            />
                          );
                        } else {
                          // Plain text content - use prose for better typography
                          return (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              {bodyText ? (
                                <div className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                                  {bodyText}
                                </div>
                              ) : body ? (
                                <div className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                                  {body}
                                </div>
                              ) : snippet ? (
                                <div className="text-slate-700 dark:text-slate-200">
                                  {snippet}
                                </div>
                              ) : (
                                <p className="text-slate-500 italic">No email content available</p>
                              )}
                            </div>
                          );
                        }
                      })()}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Mail className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">{t("syncSelectEmailToPreview")}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Draft Composer (Bottom, Fixed) */}
                <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4">
                  {selectedEmail ? (
                    <div className="space-y-4">
                      {/* Draft Display */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{t("syncDraft")}</p>
                          <div className="flex items-center gap-2">
                            {draftLoading[selectedEmail.id] && (
                              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                            )}
                            {getEmailDraft(selectedEmail) && !draftLoading[selectedEmail.id] && (
                              <button
                                onClick={() => {
                                  const draft = getEmailDraft(selectedEmail);
                                  if (draft) {
                                    navigator.clipboard.writeText(draft);
                                  }
                                }}
                                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                                title="Copy draft"
                              >
                                Copy
                              </button>
                            )}
                          </div>
                        </div>
                           {draftLoading[selectedEmail.id] ? (
                             <div className="rounded-lg bg-slate-900/90 p-3 text-sm text-white dark:bg-white/10 dark:text-white flex items-center gap-2">
                               <Loader2 className="h-4 w-4 animate-spin" />
                               <span>Generating draft...</span>
                             </div>
                           ) : draftError[selectedEmail.id] ? (
                             <div className="rounded-lg bg-red-900/90 p-3 text-sm text-white dark:bg-red-800/50">
                               <p className="mb-2">{draftError[selectedEmail.id]}</p>
                               <button
                                 onClick={() => handleEmailSelect(selectedEmail)}
                                 className="text-xs underline hover:no-underline"
                               >
                                 Retry
                               </button>
                             </div>
                           ) : (
                             <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap min-h-[80px] max-h-[200px] overflow-y-auto">
                               {(() => {
                                 // Check for prepared draft first, then regular draft
                                 const emailWithDraft = selectedEmail as any;
                                 const preparedDraft = emailWithDraft?.preparedDraft?.draftBody || emailWithDraft?.hasPreparedDraft ? (emailWithDraft as any).draft : null;
                                 const regularDraft = getEmailDraft(selectedEmail);
                                 const draft = preparedDraft || regularDraft;
                                 
                                 if (preparedDraft) {
                                   return (
                                     <div>
                                       <div className="mb-2 text-xs text-orange-600 dark:text-orange-400 font-semibold">
                                         Prepared draft ready
                                       </div>
                                       <div>{draft}</div>
                                     </div>
                                   );
                                 }
                                 
                                 return draft || <p className="text-slate-400 italic">{t("syncPlaceholderDraft")}</p>;
                               })()}
                             </div>
                           )}
                      </div>

                         {/* Action Buttons */}
                         <div className="flex gap-2">
                           <button
                             onClick={handleEditDraft}
                             disabled={(!getEmailDraft(selectedEmail) && !(selectedEmail as any)?.preparedDraft?.draftBody) || draftLoading[selectedEmail.id]}
                             className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                             {t("syncEditDraft")}
                           </button>
                           <button
                             onClick={async () => {
                               // If there's a prepared draft, mark it as consumed after sending
                               const emailWithDraft = selectedEmail as any;
                               if (emailWithDraft?.preparedDraft?.id) {
                                 try {
                                   const { data: { session } } = await supabaseBrowserClient.auth.getSession();
                                   if (session?.access_token) {
                                     await fetch(`/api/sync/follow-ups/prepared/${emailWithDraft.preparedDraft.id}`, {
                                       method: "PATCH",
                                       headers: {
                                         Authorization: `Bearer ${session.access_token}`,
                                       },
                                     });
                                   }
                                 } catch (error) {
                                   console.error("Error marking draft as consumed:", error);
                                 }
                               }
                               setShowSendModal(true);
                             }}
                             disabled={(!getEmailDraft(selectedEmail) && !(selectedEmail as any)?.preparedDraft?.draftBody) || draftLoading[selectedEmail.id]}
                             className="flex-1 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                             Send
                           </button>
                         </div>

                      {/* Chat Interface - Compact */}
                      <div className="rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                        <div className="mb-2">
                          <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t("syncChatWithSync")}</h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Ask Sync about this email, the lead, or how to improve your reply. It can also update the draft for you.
                          </p>
                        </div>
                        <div className="mb-2 space-y-1.5 max-h-32 overflow-y-auto" data-chat-container>
                          {chatMessages.slice(-3).map((message, index) => (
                            <div
                              key={index}
                              className={`rounded-lg px-2 py-1 text-xs ${
                                message.role === "agent"
                                  ? "bg-slate-900/90 text-white dark:bg-slate-800"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                              }`}
                            >
                              {message.text}
                            </div>
                          ))}
                          {isProcessing && (
                            <div className="rounded-lg bg-slate-900/90 px-2 py-1 text-xs text-white dark:bg-slate-800">
                              {processingLabel}
                            </div>
                          )}
                        </div>
                        <form onSubmit={handleChat} className="flex gap-2">
                          <input
                            name="message"
                            placeholder={isProcessing ? "Sync is thinking..." : "Ask Sync a question or tell it how to change the draft…"}
                            disabled={isProcessing}
                            className="flex-1 rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-xs focus:border-brand-accent focus:outline-none disabled:opacity-50 dark:border-slate-700"
                          />
                          <button
                            type="submit"
                            disabled={isProcessing}
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                          >
                            {t("syncSend")}
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-500 dark:text-slate-400">Select an email to compose a reply</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Send Email Modal */}
        {selectedEmail && (
          <SendEmailModal
            open={showSendModal}
            onClose={() => setShowSendModal(false)}
            email={{
              id: selectedEmail.id,
              to: "from_address" in selectedEmail 
                ? selectedEmail.from_address 
                : "fromAddress" in selectedEmail 
                  ? selectedEmail.fromAddress 
                  : "",
              toName: "from_name" in selectedEmail 
                ? selectedEmail.from_name 
                : "sender" in selectedEmail 
                  ? selectedEmail.sender 
                  : null,
              subject: getEmailSubject(selectedEmail) || "",
              body: getEmailDraft(selectedEmail) || "",
              threadId: "gmail_thread_id" in selectedEmail 
                ? selectedEmail.gmail_thread_id 
                : undefined,
            }}
            onSendSuccess={handleSendSuccess}
          />
        )}

        {/* Copilot Panel */}
        {isAiCopilotEnabled() && showCopilotPanel && selectedEmail && (
          <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Copilot
              </h3>
              <button
                onClick={() => {
                  setShowCopilotPanel(false);
                  setCopilotMode(null);
                  setCopilotInsights(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!copilotMode ? (
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      setCopilotMode("summary");
                      setLoadingCopilot(true);
                      try {
                        const { data: { session } } = await supabaseBrowserClient.auth.getSession();
                        if (!session?.access_token) return;
                        const res = await fetch(`/api/sync/email/${selectedEmail.id}/copilot`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({ mode: "summary" }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setCopilotInsights(data.insights);
                        }
                      } catch (error) {
                        console.error("Error loading copilot:", error);
                      } finally {
                        setLoadingCopilot(false);
                      }
                    }}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="font-semibold text-sm">Summarize conversation</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Get a summary of key points</div>
                  </button>
                  <button
                    onClick={async () => {
                      setCopilotMode("next_step");
                      setLoadingCopilot(true);
                      try {
                        const { data: { session } } = await supabaseBrowserClient.auth.getSession();
                        if (!session?.access_token) return;
                        const res = await fetch(`/api/sync/email/${selectedEmail.id}/copilot`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({ mode: "next_step" }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setCopilotInsights(data.insights);
                        }
                      } catch (error) {
                        console.error("Error loading copilot:", error);
                      } finally {
                        setLoadingCopilot(false);
                      }
                    }}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="font-semibold text-sm">Suggest next step</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Get recommendations for next actions</div>
                  </button>
                  <button
                    onClick={async () => {
                      setCopilotMode("risk_analysis");
                      setLoadingCopilot(true);
                      try {
                        const { data: { session } } = await supabaseBrowserClient.auth.getSession();
                        if (!session?.access_token) return;
                        const res = await fetch(`/api/sync/email/${selectedEmail.id}/copilot`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({ mode: "risk_analysis" }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setCopilotInsights(data.insights);
                        }
                      } catch (error) {
                        console.error("Error loading copilot:", error);
                      } finally {
                        setLoadingCopilot(false);
                      }
                    }}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="font-semibold text-sm">Analyze risks & opportunities</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Identify potential issues and opportunities</div>
                  </button>
                  <button
                    onClick={async () => {
                      setCopilotMode("proposal_hint");
                      setLoadingCopilot(true);
                      try {
                        const { data: { session } } = await supabaseBrowserClient.auth.getSession();
                        if (!session?.access_token) return;
                        const res = await fetch(`/api/sync/email/${selectedEmail.id}/copilot`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${session.access_token}`,
                          },
                          body: JSON.stringify({ mode: "proposal_hint" }),
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setCopilotInsights(data.insights);
                        }
                      } catch (error) {
                        console.error("Error loading copilot:", error);
                      } finally {
                        setLoadingCopilot(false);
                      }
                    }}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="font-semibold text-sm">Suggest proposal angle</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Get ideas for proposals or pitches</div>
                  </button>
                </div>
              ) : loadingCopilot ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                </div>
              ) : copilotInsights ? (
                <div className="space-y-4">
                  {copilotInsights.summary && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Summary</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{copilotInsights.summary}</p>
                    </div>
                  )}
                  {copilotInsights.key_points && copilotInsights.key_points.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Key Points</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
                        {copilotInsights.key_points.map((point: string, idx: number) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {copilotInsights.risks && copilotInsights.risks.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 text-red-600 dark:text-red-400">Risks</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
                        {copilotInsights.risks.map((risk: string, idx: number) => (
                          <li key={idx}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {copilotInsights.opportunities && copilotInsights.opportunities.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2 text-green-600 dark:text-green-400">Opportunities</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
                        {copilotInsights.opportunities.map((opp: string, idx: number) => (
                          <li key={idx}>{opp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {copilotInsights.recommended_next_step && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Recommended Next Step</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{copilotInsights.recommended_next_step}</p>
                    </div>
                  )}
                  {copilotInsights.suggested_reply_outline && copilotInsights.suggested_reply_outline.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Suggested Reply Outline</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
                        {copilotInsights.suggested_reply_outline.map((outline: string, idx: number) => (
                          <li key={idx}>{outline}</li>
                        ))}
                      </ol>
                      <button
                        onClick={() => {
                          // Insert outline into draft composer
                          const outlineText = copilotInsights.suggested_reply_outline.join("\n\n");
                          // This would need to be integrated with the draft composer
                          alert("Insert as draft functionality would go here");
                        }}
                        className="mt-2 w-full px-3 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                      >
                        Insert as draft
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setCopilotMode(null);
                      setCopilotInsights(null);
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Back
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === "today" && isTodayDashboardEnabled() && (
          <div className="space-y-6">
            <header>
              <h2 className="text-2xl font-semibold">Today</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Tasks, reminders, meetings, and follow-ups for today
              </p>
            </header>

            {isAuthenticated ? (
              <TodayDashboard userId={null} />
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">Please log in to view today&apos;s items</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-6">
            {/* Demo mode banner removed - demo mode is disabled for authenticated users */}
            <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      if (calendarView === "month") {
                        newDate.setMonth(newDate.getMonth() - 1);
                      } else {
                        newDate.setDate(newDate.getDate() - 7);
                      }
                      setSelectedDate(newDate);
                    }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {t("syncPrevious")}
                  </button>
                  <div className="flex flex-col items-center gap-2">
                    <h2 className="text-xl font-semibold">
                      {calendarView === "month"
                        ? selectedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                        : (() => {
                            const startOfWeek = new Date(selectedDate);
                            const day = startOfWeek.getDay();
                            const diff = startOfWeek.getDate() - day;
                            const sunday = new Date(startOfWeek.setDate(diff));
                            const saturday = new Date(sunday);
                            saturday.setDate(sunday.getDate() + 6);
                            return `${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${saturday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
                          })()}
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCalendarView("week")}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                          calendarView === "week"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        }`}
                      >
                        {t("syncWeekView" as any)}
                      </button>
                      <button
                        onClick={() => setCalendarView("month")}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                          calendarView === "month"
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        }`}
                      >
                        {t("syncMonthView" as any)}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      if (calendarView === "month") {
                        newDate.setMonth(newDate.getMonth() + 1);
                      } else {
                        newDate.setDate(newDate.getDate() + 7);
                      }
                      setSelectedDate(newDate);
                    }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {t("syncNext")}
                  </button>
                </div>

                {isLoadingEvents && isCalendarConnected ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                    <span className="ml-2 text-sm text-slate-500">{t("syncLoadingCalendarEvents")}</span>
                  </div>
                ) : (
                  <div className="relative">
                    {calendarView === "week" ? (
                      <div className="rounded-3xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/40 overflow-hidden">
                    {/* Header - Desktop/Tablet */}
                    <div className="hidden md:grid grid-cols-8 gap-2 px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                      <div className="text-xs font-semibold uppercase text-slate-500"></div>
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
                        const dayDate = weekDays[idx]?.date;
                        const isToday = dayDate?.toDateString() === new Date().toDateString();
                        return (
                          <div key={day} className={`text-center text-xs font-semibold uppercase py-2 ${isToday ? "text-slate-900 dark:text-white" : "text-slate-500"}`}>
                            <div>{day}</div>
                            <div className={`text-sm mt-1 ${isToday ? "font-bold" : ""}`}>{dayDate?.getDate()}</div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Mobile Header */}
                    <div className="md:hidden px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase text-slate-500">
                            {weekDays[0]?.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </div>
                          <div className="text-sm font-semibold mt-1">Today</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const newDate = new Date(selectedDate);
                              newDate.setDate(newDate.getDate() - 1);
                              setSelectedDate(newDate);
                            }}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => {
                              const newDate = new Date(selectedDate);
                              newDate.setDate(newDate.getDate() + 1);
                              setSelectedDate(newDate);
                            }}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Scrollable calendar grid */}
                    <div 
                      data-week-calendar-scroll
                      className="relative overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)]"
                    >
                      {/* Desktop/Tablet: Full week view */}
                      <div className="hidden md:grid grid-cols-8 gap-2 min-w-[800px]">
                        {/* Sticky Time Column */}
                        <div className="sticky left-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-800">
                          <div className="relative" style={{ height: `${(activeTimeRange.maxHour - activeTimeRange.minHour + 1) * 40}px` }}>
                            {/* Early morning collapsed section */}
                            {activeTimeRange.minHour > 0 && (
                              <div className="h-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end pr-2">
                                <span className="text-[9px] text-slate-400 dark:text-slate-600 opacity-60">Early Morning</span>
                              </div>
                            )}
                            
                            {/* Active time range hours */}
                            {Array.from({ length: activeTimeRange.maxHour - activeTimeRange.minHour + 1 }, (_, i) => {
                              const hour = activeTimeRange.minHour + i;
                              const showLabel = shouldShowHourLabel(hour);
                              return (
                                <div
                                  key={hour}
                                  className="h-10 border-b border-slate-200 dark:border-slate-800 flex items-start justify-end pr-2 pt-1"
                                >
                                  {showLabel && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 opacity-70">
                                      {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            
                            {/* Late evening collapsed section */}
                            {activeTimeRange.maxHour < 23 && (
                              <div className="h-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end pr-2">
                                <span className="text-[9px] text-slate-400 dark:text-slate-600 opacity-60">Late Evening</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Day Columns */}
                        {weekDays.map((day, dayIndex) => {
                          const isToday = day.date.toDateString() === new Date().toDateString();
                          const todayHour = currentTime.getHours();
                          const todayMinute = currentTime.getMinutes();
                          const isCurrentDay = isToday && currentTime.toDateString() === day.date.toDateString();
                          
                          return (
                            <div
                              key={dayIndex}
                              className={`relative border-r border-slate-200 dark:border-slate-800 ${
                                isToday ? "bg-slate-50/30 dark:bg-slate-800/20" : ""
                              }`}
                              style={{ height: `${(activeTimeRange.maxHour - activeTimeRange.minHour + 1) * 40}px` }}
                            >
                              {/* Early morning collapsed section */}
                              {activeTimeRange.minHour > 0 && (
                                <div className="h-8 border-b border-slate-200 dark:border-slate-800"></div>
                              )}
                              
                              {/* Time grid lines */}
                              <div className="absolute inset-0 pointer-events-none">
                                {Array.from({ length: activeTimeRange.maxHour - activeTimeRange.minHour + 1 }, (_, i) => {
                                  const hour = activeTimeRange.minHour + i;
                                  return (
                                    <div
                                      key={hour}
                                      className="h-10 border-b border-slate-200 dark:border-slate-800"
                                    />
                                  );
                                })}
                              </div>
                              
                              {/* "Now" indicator */}
                              {isCurrentDay && todayHour >= activeTimeRange.minHour && todayHour <= activeTimeRange.maxHour && (
                                <div
                                  className="absolute left-0 right-0 z-20 pointer-events-none"
                                  style={{
                                    top: `${getHourPosition(todayHour, todayMinute)}px`,
                                  }}
                                >
                                  <div className="h-0.5 bg-red-500 dark:bg-red-400 relative">
                                    <div className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-red-500 dark:bg-red-400"></div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Events and alerts */}
                              <div className="relative p-1">
                                {/* Custom alerts */}
                                {allCustomAlerts
                                  .filter((alert) => {
                                    const alertDateString = getLocalDateString(new Date(alert.date));
                                    const dayDateKey = getLocalDateString(day.date);
                                    return alertDateString === dayDateKey;
                                  })
                                  .map((alert) => {
                                    const IconComponent = getIconComponent(alert.icon);
                                    const iconColor = alert.icon === "AlertTriangle" || alert.icon === "AlertCircle"
                                      ? "text-orange-500"
                                      : alert.icon === "CheckCircle"
                                      ? "text-emerald-500"
                                      : "text-brand-accent";
                                    
                                    let topPosition = 0;
                                    if (alert.time) {
                                      const [hours, minutes] = alert.time.split(':').map(Number);
                                      if (hours >= activeTimeRange.minHour && hours <= activeTimeRange.maxHour) {
                                        topPosition = getHourPosition(hours, minutes);
                                      }
                                    }
                                    
                                    return (
                                      <button
                                        key={alert.id}
                                        onClick={() => handleAlertClick(alert)}
                                        className="absolute left-1 right-1 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-lg shadow-black/20 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] z-10"
                                        style={{
                                          top: `${topPosition}px`,
                                        }}
                                      >
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                          <div className={`p-1 rounded-lg ${iconColor === "text-orange-500" ? "bg-orange-50 dark:bg-orange-900/20" : iconColor === "text-emerald-500" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-brand-accent/10 dark:bg-brand-accent/20"}`}>
                                            <IconComponent className={`h-3 w-3 flex-shrink-0 ${iconColor}`} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                              {alert.title}
                                            </p>
                                            {alert.time && (
                                              <p className="text-[9px] text-slate-500 dark:text-slate-400">
                                                {alert.time}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                
                                {/* Calendar events */}
                                {day.events.map((event) => {
                                  const category = getEventCategory(event);
                                  let topPosition = 0;
                                  const localTime = getEventLocalTime(event);
                                  if (localTime) {
                                    const { hour, minute } = localTime;
                                    // Only show if event is on this day (check local date)
                                    const eventLocalDateString = getEventLocalDateString(event);
                                    const dayDateKey = getLocalDateString(day.date);
                                    if (eventLocalDateString === dayDateKey && hour >= activeTimeRange.minHour && hour <= activeTimeRange.maxHour) {
                                      topPosition = getHourPosition(hour, minute);
                                    }
                                  }
                                  
                                  return (
                                    <button
                                      key={event.id}
                                      onClick={() => handleEventClick(event)}
                                      className={`absolute left-1 right-1 rounded-xl border shadow-lg shadow-black/20 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] z-10 ${category.borderColor} ${category.bgColor} ${category.color}`}
                                      style={{
                                        top: `${topPosition}px`,
                                      }}
                                      title={event.summary}
                                    >
                                      <div className="flex items-center gap-2 px-2 py-1.5">
                                        <Clock className="h-3 w-3 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-xs truncate">
                                            {event.summary}
                                          </p>
                                      <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {formatEventTime(event, t("syncAllDay"))}
                                      </p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              
                              {/* Late evening collapsed section */}
                              {activeTimeRange.maxHour < 23 && (
                                <div className="absolute bottom-0 left-0 right-0 h-8 border-t border-slate-200 dark:border-slate-800"></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Mobile: Single day view */}
                      <div className="md:hidden">
                        {weekDays.slice(0, 1).map((day, dayIndex) => {
                          const isToday = day.date.toDateString() === new Date().toDateString();
                          const todayHour = currentTime.getHours();
                          const todayMinute = currentTime.getMinutes();
                          const isCurrentDay = isToday && currentTime.toDateString() === day.date.toDateString();
                          
                          return (
                            <div key={dayIndex} className="flex">
                              {/* Sticky Time Column */}
                              <div className="sticky left-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-r border-slate-200 dark:border-slate-800 w-14 flex-shrink-0">
                                <div className="relative" style={{ height: `${(activeTimeRange.maxHour - activeTimeRange.minHour + 1) * 40}px` }}>
                                  {activeTimeRange.minHour > 0 && (
                                    <div className="h-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end pr-1">
                                      <span className="text-[8px] text-slate-400 dark:text-slate-600 opacity-60">Early</span>
                                    </div>
                                  )}
                                  {Array.from({ length: activeTimeRange.maxHour - activeTimeRange.minHour + 1 }, (_, i) => {
                                    const hour = activeTimeRange.minHour + i;
                                    const showLabel = shouldShowHourLabel(hour);
                                    return (
                                      <div
                                        key={hour}
                                        className="h-10 border-b border-slate-200 dark:border-slate-800 flex items-start justify-end pr-1 pt-1"
                                      >
                                        {showLabel && (
                                          <span className="text-[9px] text-slate-500 dark:text-slate-400 opacity-70">
                                            {hour === 0 ? "12" : hour < 12 ? `${hour}` : hour === 12 ? "12" : `${hour - 12}`}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {activeTimeRange.maxHour < 23 && (
                                    <div className="h-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end pr-1">
                                      <span className="text-[8px] text-slate-400 dark:text-slate-600 opacity-60">Late</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Day Column */}
                              <div
                                className={`relative border-r border-slate-200 dark:border-slate-800 flex-1 ${
                                  isToday ? "bg-slate-50/30 dark:bg-slate-800/20" : ""
                                }`}
                                style={{ height: `${(activeTimeRange.maxHour - activeTimeRange.minHour + 1) * 40}px` }}
                              >
                                {activeTimeRange.minHour > 0 && (
                                  <div className="h-8 border-b border-slate-200 dark:border-slate-800"></div>
                                )}
                                
                                <div className="absolute inset-0 pointer-events-none">
                                  {Array.from({ length: activeTimeRange.maxHour - activeTimeRange.minHour + 1 }, (_, i) => {
                                    const hour = activeTimeRange.minHour + i;
                                    return (
                                      <div
                                        key={hour}
                                        className="h-10 border-b border-slate-200 dark:border-slate-800"
                                      />
                                    );
                                  })}
                                </div>
                                
                                {isCurrentDay && todayHour >= activeTimeRange.minHour && todayHour <= activeTimeRange.maxHour && (
                                  <div
                                    className="absolute left-0 right-0 z-20 pointer-events-none"
                                    style={{
                                      top: `${getHourPosition(todayHour, todayMinute)}px`,
                                    }}
                                  >
                                    <div className="h-0.5 bg-red-500 dark:bg-red-400 relative">
                                      <div className="absolute -left-1 -top-1 h-3 w-3 rounded-full bg-red-500 dark:bg-red-400"></div>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="relative p-1">
                                  {allCustomAlerts
                                    .filter((alert) => {
                                      const alertDateString = getLocalDateString(new Date(alert.date));
                                      const dayDateKey = getLocalDateString(day.date);
                                      return alertDateString === dayDateKey;
                                    })
                                    .map((alert) => {
                                      const IconComponent = getIconComponent(alert.icon);
                                      const iconColor = alert.icon === "AlertTriangle" || alert.icon === "AlertCircle"
                                        ? "text-orange-500"
                                        : alert.icon === "CheckCircle"
                                        ? "text-emerald-500"
                                        : "text-brand-accent";
                                      
                                      let topPosition = 0;
                                      if (alert.time) {
                                        const [hours, minutes] = alert.time.split(':').map(Number);
                                        if (hours >= activeTimeRange.minHour && hours <= activeTimeRange.maxHour) {
                                          topPosition = getHourPosition(hours, minutes);
                                        }
                                      }
                                      
                                      return (
                                        <button
                                          key={alert.id}
                                          onClick={() => handleAlertClick(alert)}
                                          className="absolute left-1 right-1 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-lg shadow-black/20 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] z-10"
                                          style={{
                                            top: `${topPosition}px`,
                                          }}
                                        >
                                          <div className="flex items-center gap-2 px-2 py-1.5">
                                            <div className={`p-1 rounded-lg ${iconColor === "text-orange-500" ? "bg-orange-50 dark:bg-orange-900/20" : iconColor === "text-emerald-500" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-brand-accent/10 dark:bg-brand-accent/20"}`}>
                                              <IconComponent className={`h-3 w-3 flex-shrink-0 ${iconColor}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                                {alert.title}
                                              </p>
                                              {alert.time && (
                                                <p className="text-[9px] text-slate-500 dark:text-slate-400">
                                                  {alert.time}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  
                                  {day.events.map((event) => {
                                    const category = getEventCategory(event);
                                    let topPosition = 0;
                                    if (event.start.dateTime) {
                                      const eventDate = new Date(event.start.dateTime);
                                      const hour = eventDate.getHours();
                                      const minute = eventDate.getMinutes();
                                      if (hour >= activeTimeRange.minHour && hour <= activeTimeRange.maxHour) {
                                        topPosition = getHourPosition(hour, minute);
                                      }
                                    }
                                    
                                    return (
                                      <button
                                        key={event.id}
                                        onClick={() => handleEventClick(event)}
                                        className={`absolute left-1 right-1 rounded-xl border shadow-lg shadow-black/20 hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] z-10 ${category.borderColor} ${category.bgColor} ${category.color}`}
                                        style={{
                                          top: `${topPosition}px`,
                                        }}
                                        title={event.summary}
                                      >
                                        <div className="flex items-center gap-2 px-2 py-1.5">
                                          <Clock className="h-3 w-3 flex-shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-xs truncate">
                                              {event.summary}
                                            </p>
                                      <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {formatEventTime(event, t("syncAllDay"))}
                                      </p>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                                
                                {activeTimeRange.maxHour < 23 && (
                                  <div className="absolute bottom-0 left-0 right-0 h-8 border-t border-slate-200 dark:border-slate-800"></div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                    ) : (
                      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40 relative">
                    <div className="grid grid-cols-7 gap-2 mb-4">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="text-center text-xs font-semibold uppercase text-slate-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {monthDays.map((day, index) => {
                        const isCurrentMonthDay = isCurrentMonth(day.date, selectedDate);
                        const isTodayDay = isToday(day.date);

                        return (
                          <div
                            key={index}
                            className={`min-h-[100px] rounded-2xl border p-2 ${
                              isCurrentMonthDay
                                ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
                                : "border-slate-100 bg-slate-50/50 dark:border-slate-900 dark:bg-slate-950/50"
                            } ${isTodayDay ? "ring-2 ring-slate-900 dark:ring-white" : ""}`}
                          >
                            <div
                              className={`text-sm font-semibold mb-1 ${
                                isCurrentMonthDay
                                  ? isTodayDay
                                    ? "text-slate-900 dark:text-white"
                                    : "text-slate-600 dark:text-slate-300"
                                  : "text-slate-400 dark:text-slate-600"
                              }`}
                            >
                              {day.date.getDate()}
                            </div>
                            <div className="space-y-1">
                              {/* Custom alerts for this day */}
                              {allCustomAlerts
                                .filter((alert) => {
                                  const alertDateString = getLocalDateString(new Date(alert.date));
                                  const dayDateKey = getLocalDateString(day.date);
                                  return alertDateString === dayDateKey;
                                })
                                .map((alert) => {
                                  const IconComponent = getIconComponent(alert.icon);
                                  const isDemo = alert.id.startsWith("demo-alert-");
                                  // Determine icon color based on icon type
                                  const iconColor = alert.icon === "AlertTriangle" || alert.icon === "AlertCircle"
                                    ? "text-orange-500"
                                    : alert.icon === "CheckCircle"
                                    ? "text-emerald-500"
                                    : "text-brand-accent";
                                  
                                  return (
                                    <button
                                      key={alert.id}
                                      onClick={() => handleAlertClick(alert)}
                                      className="w-full text-left px-3 py-2 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-lg hover:shadow-xl transition-all duration-200 mb-1.5 transform hover:scale-[1.02]"
                                      style={{
                                        filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={`p-1 rounded-lg ${iconColor === "text-orange-500" ? "bg-orange-50 dark:bg-orange-900/20" : iconColor === "text-emerald-500" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-brand-accent/10 dark:bg-brand-accent/20"}`}>
                                          <IconComponent className={`h-3.5 w-3.5 flex-shrink-0 ${iconColor}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                                            {alert.title}
                                          </p>
                                          {alert.time && (
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                              {alert.time}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              {/* Calendar events */}
                              {day.events.slice(0, 3).map((event) => (
                                <button
                                  key={event.id}
                                  onClick={() => handleEventClick(event)}
                                  className={`w-full text-left px-3 py-2 rounded-2xl border shadow-lg hover:shadow-xl transition-all duration-200 mb-1.5 transform hover:scale-[1.02] ${
                                    event.createdByAloha
                                      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
                                      : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  }`}
                                  style={{
                                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                                  }}
                                  title={event.summary}
                                >
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-xs truncate">
                                        {event.summary}
                                      </p>
                                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            {formatEventTime(event, t("syncAllDay"))}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                              {day.events.length > 3 && (
                                <div className="text-xs text-slate-500 px-2">
                                  +{day.events.length - 3} {t("syncMore")}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                    )}
                    
                    {/* Floating Add Alert Button */}
                    <button
                      onClick={() => setShowAlertForm(true)}
                      className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 transition-all hover:scale-105 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    >
                      <Plus className="h-4 w-4" />
                      {t("syncAddAlert" as any)}
                    </button>
                  </div>
                )}

            {/* Alert Detail Modal */}
            {showAlertModal && selectedAlert && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowAlertModal(false);
                    setEditingAlert(false);
                    setEditingAlertNote(false);
                    setSelectedAlert(null);
                  }
                }}
              >
                <div 
                  className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      {editingAlert ? (
                        <div className="space-y-4">
                          {/* Icon Selection */}
                          <div>
                            <label className="block text-sm font-semibold mb-2">{t("syncAlertIcon" as any)}</label>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { name: "AlertTriangle", icon: AlertTriangle, color: "text-orange-500" },
                                { name: "CalendarCheck", icon: CalendarCheck, color: "text-brand-accent" },
                                { name: "Info", icon: Info, color: "text-brand-accent" },
                                { name: "CheckCircle", icon: CheckCircle, color: "text-emerald-500" },
                                { name: "AlertCircle", icon: AlertCircle, color: "text-orange-500" },
                                { name: "Clock", icon: Clock, color: "text-brand-accent" },
                                { name: "MapPin", icon: MapPin, color: "text-brand-accent" },
                                { name: "Users", icon: Users, color: "text-brand-accent" },
                              ].map(({ name, icon: Icon, color }) => (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => setEditedAlert({ ...editedAlert, icon: name })}
                                  className={`p-3 rounded-2xl border transition ${
                                    editedAlert.icon === name
                                      ? "border-brand-accent bg-brand-accent/10"
                                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  <Icon className={`h-5 w-5 ${color} mx-auto`} />
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Title */}
                          <div>
                            <label className="block text-sm font-semibold mb-2">{t("syncAlertTitle" as any)}</label>
                            <input
                              type="text"
                              value={editedAlert.title || ""}
                              onChange={(e) => setEditedAlert({ ...editedAlert, title: e.target.value })}
                              className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                            />
                          </div>

                          {/* Description */}
                          <div>
                            <label className="block text-sm font-semibold mb-2">{t("syncAlertDescription" as any)}</label>
                            <textarea
                              value={editedAlert.description || ""}
                              onChange={(e) => setEditedAlert({ ...editedAlert, description: e.target.value })}
                              rows={3}
                              className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                            />
                          </div>

                          {/* Date and Time */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold mb-2">{t("syncAlertDate" as any)}</label>
                              <input
                                type="date"
                                value={editedAlert.date || ""}
                                onChange={(e) => setEditedAlert({ ...editedAlert, date: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-semibold mb-2">{t("syncAlertTime" as any)}</label>
                              <input
                                type="time"
                                value={editedAlert.time || ""}
                                onChange={(e) => setEditedAlert({ ...editedAlert, time: e.target.value })}
                                className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            {(() => {
                              const IconComponent = getIconComponent(selectedAlert.icon);
                              const iconColor = selectedAlert.icon === "AlertTriangle" || selectedAlert.icon === "AlertCircle"
                                ? "text-orange-500"
                                : selectedAlert.icon === "CheckCircle"
                                ? "text-emerald-500"
                                : "text-brand-accent";
                              return (
                                <div className={`p-3 rounded-2xl ${iconColor === "text-orange-500" ? "bg-orange-50 dark:bg-orange-900/20" : iconColor === "text-emerald-500" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-brand-accent/10 dark:bg-brand-accent/20"}`}>
                                  <IconComponent className={`h-6 w-6 ${iconColor}`} />
                                </div>
                              );
                            })()}
                            <div className="flex-1">
                              <h3 className="text-2xl font-semibold mb-1">{selectedAlert.title}</h3>
                              <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                <div className="flex items-center gap-1">
                                  <CalendarIcon className="h-4 w-4" />
                                  <span>{new Date(selectedAlert.date).toLocaleDateString()}</span>
                                </div>
                                {selectedAlert.time && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    <span>{selectedAlert.time}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {selectedAlert.description && (
                            <div className="mb-4 rounded-2xl bg-slate-100/70 p-4 text-sm dark:bg-slate-800/60">
                              <p className="text-slate-700 dark:text-slate-200">{selectedAlert.description}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShowAlertModal(false);
                        setEditingAlert(false);
                        setEditingAlertNote(false);
                        setSelectedAlert(null);
                      }}
                      className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {!editingAlert && (
                    <div className="space-y-4 mb-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            {t("syncNotes")}
                          </label>
                          {!editingAlertNote && (
                            <button
                              onClick={() => setEditingAlertNote(true)}
                              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                            >
                              <Edit2 className="h-3 w-3" />
                              {t("syncEdit")}
                            </button>
                          )}
                        </div>
                        {editingAlertNote ? (
                          <textarea
                            value={alertNoteText}
                            onChange={(e) => setAlertNoteText(e.target.value)}
                            placeholder={t("syncAddNotesPlaceholder")}
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700 min-h-[100px]"
                          />
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 min-h-[100px]">
                            {alertNoteText || <span className="text-slate-400">{t("syncNoNotesAdded")}</span>}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-semibold mb-2 block">{t("syncMemo")}</label>
                        {editingAlertNote ? (
                          <textarea
                            value={alertMemoText}
                            onChange={(e) => setAlertMemoText(e.target.value)}
                            placeholder={t("syncAddMemoPlaceholder")}
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700 min-h-[80px]"
                          />
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 min-h-[80px]">
                            {alertMemoText || <span className="text-slate-400">{t("syncNoMemo")}</span>}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-semibold mb-2 block">{t("syncReminder")}</label>
                        {editingAlertNote ? (
                          <input
                            type="text"
                            value={alertReminderText}
                            onChange={(e) => setAlertReminderText(e.target.value)}
                            placeholder={t("syncSetReminderPlaceholder")}
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                          />
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                            {alertReminderText || <span className="text-slate-400">{t("syncNoReminderSet")}</span>}
                          </div>
                        )}
                      </div>

                      {editingAlertNote && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              const isDemo = selectedAlert?.id.startsWith("demo-alert-");
                              if (isDemo) {
                                setDemoAlertsState(demoAlertsState.map(a => 
                                  a.id === selectedAlert.id 
                                    ? { ...a, notes: alertNoteText, memo: alertMemoText, reminder: alertReminderText } as CustomAlert
                                    : a
                                ));
                                setSelectedAlert({ ...selectedAlert, notes: alertNoteText, memo: alertMemoText, reminder: alertReminderText } as CustomAlert);
                              } else {
                                setCustomAlerts(customAlerts.map(a => 
                                  a.id === selectedAlert.id 
                                    ? { ...a, notes: alertNoteText, memo: alertMemoText, reminder: alertReminderText } as CustomAlert
                                    : a
                                ));
                                setSelectedAlert({ ...selectedAlert, notes: alertNoteText, memo: alertMemoText, reminder: alertReminderText } as CustomAlert);
                              }
                              setEditingAlertNote(false);
                            }}
                            className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                          >
                            {t("save" as any)}
                          </button>
                          <button
                            onClick={() => {
                              setEditingAlertNote(false);
                              setAlertNoteText((selectedAlert as any)?.notes || "");
                              setAlertMemoText((selectedAlert as any)?.memo || "");
                              setAlertReminderText((selectedAlert as any)?.reminder || "");
                            }}
                            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            {t("syncCancel" as any)}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    {editingAlert ? (
                      <>
                        <button
                          onClick={handleUpdateAlert}
                          className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                        >
                          {t("save" as any)}
                        </button>
                        <button
                          onClick={() => {
                            setEditingAlert(false);
                            setEditedAlert({ ...selectedAlert });
                          }}
                          className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          {t("syncCancel" as any)}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleCompleteAlert}
                          className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          {t("syncMarkComplete" as any)}
                        </button>
                        <button
                          onClick={handleDeleteAlert}
                          className="flex-1 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 flex items-center justify-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("syncDelete" as any)}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Event Detail Modal */}
            {showEventModal && selectedEvent && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    setShowEventModal(false);
                    setEditingNote(false);
                    setSelectedEvent(null);
                  }
                }}
              >
                <div 
                  className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-2xl font-semibold mb-2">{selectedEvent.summary}</h3>
                      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatEventDate(selectedEvent)} at {formatEventTime(selectedEvent)}
                          </span>
                        </div>
                        {selectedEvent.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{selectedEvent.location}</span>
                          </div>
                        )}
                        {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>{selectedEvent.attendees.length} {t("syncAttendees")}</span>
                          </div>
                        )}
                        {selectedEvent.createdByAloha && (
                          <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            {t("syncCreatedByAloha")}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowEventModal(false)}
                      className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      ✕
                    </button>
                  </div>

                  {selectedEvent.description && (
                    <div className="mb-4 rounded-2xl bg-slate-100/70 p-4 text-sm dark:bg-slate-800/60">
                      <p className="text-slate-700 dark:text-slate-200">{selectedEvent.description}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {t("syncNotes")}
                        </label>
                        {!editingNote && (
                          <button
                            onClick={() => setEditingNote(true)}
                            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            <Edit2 className="h-3 w-3 inline mr-1" />
                            {t("syncEdit")}
                          </button>
                        )}
                      </div>
                      {editingNote ? (
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder={t("syncAddNotesPlaceholder")}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700 min-h-[100px]"
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 min-h-[100px]">
                          {noteText || <span className="text-slate-400">{t("syncNoNotesAdded")}</span>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold mb-2 block">{t("syncMemo")}</label>
                      {editingNote ? (
                        <textarea
                          value={memoText}
                          onChange={(e) => setMemoText(e.target.value)}
                          placeholder={t("syncAddMemoPlaceholder")}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700 min-h-[80px]"
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60 min-h-[80px]">
                          {memoText || <span className="text-slate-400">{t("syncNoMemo")}</span>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-semibold mb-2 block">{t("syncReminder")}</label>
                      {editingNote ? (
                        <input
                          type="text"
                          value={reminderText}
                          onChange={(e) => setReminderText(e.target.value)}
                          placeholder={t("syncSetReminderPlaceholder")}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                        />
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                          {reminderText || <span className="text-slate-400">{t("syncNoReminderSet")}</span>}
                        </div>
                      )}
                    </div>

                    {editingNote && (
                      <div className="flex gap-3">
                        <button
                          onClick={handleSaveNotes}
                          className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingNote(false);
                            setNoteText(selectedEvent.notes || "");
                            setMemoText(selectedEvent.memo || "");
                            setReminderText(selectedEvent.reminder || "");
                          }}
                          className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Alert Form Modal */}
      {showAlertForm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAlertForm(false);
              setNewAlert({
                icon: "AlertTriangle",
                title: "",
                description: "",
                date: "",
                time: "",
              });
            }
          }}
        >
          <div 
            className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">{t("syncAddAlert" as any)}</h2>
              <button
                onClick={() => {
                  setShowAlertForm(false);
                  setNewAlert({
                    icon: "AlertTriangle",
                    title: "",
                    description: "",
                    date: "",
                    time: "",
                  });
                }}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddCustomAlert();
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Icon Selection */}
                <div>
                  <label className="block text-sm font-semibold mb-2">{t("syncAlertIcon" as any)}</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: "AlertTriangle", icon: AlertTriangle, color: "text-orange-500" },
                      { name: "CalendarCheck", icon: CalendarCheck, color: "text-brand-accent" },
                      { name: "Info", icon: Info, color: "text-brand-accent" },
                      { name: "CheckCircle", icon: CheckCircle, color: "text-emerald-500" },
                      { name: "AlertCircle", icon: AlertCircle, color: "text-orange-500" },
                      { name: "Clock", icon: Clock, color: "text-brand-accent" },
                      { name: "MapPin", icon: MapPin, color: "text-brand-accent" },
                      { name: "Users", icon: Users, color: "text-brand-accent" },
                    ].map(({ name, icon: Icon, color }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setNewAlert({ ...newAlert, icon: name })}
                        className={`p-3 rounded-2xl border transition ${
                          newAlert.icon === name
                            ? "border-brand-accent bg-brand-accent/10"
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${color} mx-auto`} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold mb-2">{t("syncAlertTitle" as any)}</label>
                  <input
                    type="text"
                    value={newAlert.title || ""}
                    onChange={(e) => setNewAlert({ ...newAlert, title: e.target.value })}
                    placeholder={t("syncAlertTitlePlaceholder" as any)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                  />
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-2">{t("syncAlertDescription" as any)}</label>
                  <textarea
                    value={newAlert.description || ""}
                    onChange={(e) => setNewAlert({ ...newAlert, description: e.target.value })}
                    placeholder={t("syncAlertDescriptionPlaceholder" as any)}
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold mb-2">{t("syncAlertDate" as any)}</label>
                  <input
                    type="date"
                    value={newAlert.date || ""}
                    onChange={(e) => setNewAlert({ ...newAlert, date: e.target.value })}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                  />
                </div>

                {/* Time */}
                <div>
                  <label className="block text-sm font-semibold mb-2">{t("syncAlertTime" as any)} ({t("syncOptional" as any)})</label>
                  <input
                    type="time"
                    value={newAlert.time || ""}
                    onChange={(e) => setNewAlert({ ...newAlert, time: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                >
                  {t("syncAddAlert" as any)}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAlertForm(false);
                    setNewAlert({
                      icon: "AlertTriangle",
                      title: "",
                      description: "",
                      date: "",
                      time: "",
                    });
                  }}
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {t("syncCancel" as any)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

        {activeTab === "insights" && (
          <InsightsTabContentSync onSwitchTab={setActiveTab} />
        )}

      {/* Send Email Modal */}
      {selectedEmail && (
        <>
          <SendEmailModal
            open={showSendModal}
            onClose={() => setShowSendModal(false)}
            email={{
              id: selectedEmail.id,
              to: "from_address" in selectedEmail 
                ? selectedEmail.from_address 
                : "fromAddress" in selectedEmail 
                  ? selectedEmail.fromAddress 
                  : "",
              toName: "from_name" in selectedEmail 
                ? selectedEmail.from_name 
                : "sender" in selectedEmail 
                  ? selectedEmail.sender 
                  : null,
              subject: getEmailSubject(selectedEmail) || "",
              body: getEmailDraft(selectedEmail) || "",
              threadId: "gmail_thread_id" in selectedEmail 
                ? selectedEmail.gmail_thread_id 
                : undefined,
            }}
            onSendSuccess={handleSendSuccess}
          />
          
          {/* Edit Draft Modal */}
          <EditDraftModal
            open={showEditDraftModal}
            onClose={() => setShowEditDraftModal(false)}
            email={{
              id: selectedEmail.id,
              to: "from_address" in selectedEmail 
                ? selectedEmail.from_address 
                : "fromAddress" in selectedEmail 
                  ? selectedEmail.fromAddress 
                  : "",
              toName: "from_name" in selectedEmail 
                ? selectedEmail.from_name 
                : "sender" in selectedEmail 
                  ? selectedEmail.sender 
                  : null,
              subject: `Re: ${getEmailSubject(selectedEmail) || ""}`,
              body: getEmailDraft(selectedEmail) || "",
              originalFrom: getEmailSender(selectedEmail),
              originalBody: ("body_text" in selectedEmail && selectedEmail.body_text) 
                ? selectedEmail.body_text 
                : ("body_html" in selectedEmail && selectedEmail.body_html)
                ? selectedEmail.body_html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
                : getEmailSnippet(selectedEmail) || "",
            }}
            onSave={handleSaveDraftFromModal}
            isSaving={isSavingDraft}
          />
        </>
      )}

      {/* Disconnect Gmail Confirmation Modal */}
      <Modal
        open={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        title="Disconnect Gmail"
        description="Are you sure you want to disconnect your Gmail account? You will need to reconnect to sync emails again."
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            This will disconnect your Gmail account from OVRSEE. You can reconnect at any time.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDisconnectGmail}
              disabled={isDisconnecting}
              className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Disconnecting...
                </>
              ) : (
                "Log Out"
              )}
            </button>
            <button
              onClick={() => setShowDisconnectModal(false)}
              disabled={isDisconnecting}
              className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SyncPage;
