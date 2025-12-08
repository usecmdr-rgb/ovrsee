"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Loader2, TrendingUp, Users, Clock, Calendar, Mail, DollarSign, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface InsightsData {
  leadFunnel: Record<string, number>;
  hotLeadCount: number;
  warmLeadCount: number;
  pendingFollowUps: number;
  avgFollowUpDelayDays?: number;
  upcomingMeetings: number;
  scheduledBySyncCount?: number;
  importantThisWeek: number;
  paymentsThisWeek: number;
  missedNeedsReply: number;
}

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

export default function InsightsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
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
          onClick={loadInsights}
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Insights Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Overview of your leads, follow-ups, meetings, and email workload
        </p>
      </div>

      {/* Lead Funnel Overview */}
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          Lead Funnel
        </h2>
        {totalLeads === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No leads yet</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(insights.leadFunnel).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between">
                <span className="text-sm text-slate-700 dark:text-slate-300">{STAGE_LABELS[stage] || stage}</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hot & Warm Leads */}
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          High-Value Leads
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700 dark:text-slate-300">Hot leads (score ≥ 80)</span>
            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">{insights.hotLeadCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700 dark:text-slate-300">Warm leads (60-79)</span>
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{insights.warmLeadCount}</span>
          </div>
          {(insights.hotLeadCount > 0 || insights.warmLeadCount > 0) && (
            <Link
              href="/sync?category=followups"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              View hot leads <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Follow-Up Performance */}
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          Follow-ups
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700 dark:text-slate-300">Pending follow-ups</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{insights.pendingFollowUps}</span>
          </div>
          {insights.avgFollowUpDelayDays !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700 dark:text-slate-300">Avg. delay</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {insights.avgFollowUpDelayDays} day{insights.avgFollowUpDelayDays !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          {insights.pendingFollowUps > 0 && (
            <Link
              href="/sync?category=followups"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Go to Follow-ups <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Meetings & Scheduling */}
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          Upcoming Meetings
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700 dark:text-slate-300">Meetings in next 7 days</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{insights.upcomingMeetings}</span>
          </div>
          {insights.upcomingMeetings > 0 && (
            <Link
              href="/sync?tab=calendar"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Open calendar <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Email Workload */}
      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Mail className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          Email Workload (Last 7 days)
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Important</span>
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{insights.importantThisWeek}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Payments / Bills</span>
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{insights.paymentsThisWeek}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Missed (needs reply)</span>
            </div>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{insights.missedNeedsReply}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
