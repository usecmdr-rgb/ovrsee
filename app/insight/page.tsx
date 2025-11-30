"use client";

import { useState, useMemo } from "react";
import { useAgentStats, emptyAgentStats } from "@/hooks/useAgentStats";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import { useAccountMode } from "@/hooks/useAccountMode";
import PreviewBanner from "@/components/agent/PreviewBanner";
import TrialExpiredBanner from "@/components/agent/TrialExpiredBanner";
import { AGENT_BY_ID } from "@/lib/config/agents";
import { useTranslation } from "@/hooks/useTranslation";
import DailyBriefCard from "@/components/insight/DailyBriefCard";
import InsightGenerator from "@/components/insight/InsightGenerator";
import WorkflowManager from "@/components/insight/WorkflowManager";
import InsightTimeline from "@/components/insight/InsightTimeline";
import ActivityMixChart from "@/components/insight/ActivityMixChart";
import InsightScoreWidget from "@/components/insight/InsightScoreWidget";
import InsightMemoryPanel from "@/components/insight/InsightMemoryPanel";

// timeframes will be defined inside component to use translations

// Calculate rollup stats from actual agent stats
function calculateRollupStats(stats: typeof emptyAgentStats, timeframe: "daily" | "weekly" | "monthly") {
  // For now, use daily stats for all timeframes
  // In the future, this could aggregate by timeframe from historical data
  const multiplier = timeframe === "daily" ? 1 : timeframe === "weekly" ? 7 : 30;
  
  return {
    calls: stats.alpha_calls_total * multiplier,
    emails: (stats.xi_important_emails || 0) * multiplier, // Use important emails for email count
    media: stats.mu_media_edits * multiplier,
    timeSaved: (stats.alpha_calls_total * 5 + (stats.xi_important_emails || 0) * 2) * multiplier / 60, // Estimate: 5 min per call, 2 min per email
  };
}

const insights = {
  daily: [
    "Great job! Missed calls dropped by 20% today.",
    "Two invoices remain unpaid; Sync tagged them for follow-up.",
  ],
  weekly: [
    "Your response time improved by 14% week-over-week.",
    "Upsell opportunity: 5 repeat callers asked about premium support.",
  ],
  monthly: [
    "Subscription renewals increased 12%.",
    "Media refresh cadence looks healthy--keep sharing Studio briefs with marketing.",
  ],
};

export default function InsightPage() {
  const { hasAccess, isLoading: accessLoading } = useAgentAccess("insight");
  const { stats, loading, error } = useAgentStats();
  const { mode: accountMode, loading: accountModeLoading } = useAccountMode();
  const t = useTranslation();
  
  // Wait for access and account mode to be determined before showing stats to prevent flashing
  const isAccessReady = !accessLoading && !accountModeLoading;
  
  // Determine if user is in preview mode based on account mode
  const isPreview = isAccessReady && accountMode === 'preview';
  
  // Check if trial is expired
  const isTrialExpired = isAccessReady && accountMode === 'trial-expired';
  
  // Determine which stats to use based on account mode
  // Preview mode: use mock data
  // Trial-active, trial-expired, subscribed: use real stats (starting from 0 at activation)
  const latestStats = useMemo(() => {
    if (!isAccessReady) {
      // Return empty stats while loading to prevent flash
      return emptyAgentStats;
    }
    // In preview mode, use mock stats
    // In all other modes (trial-active, trial-expired, subscribed), use real stats
    if (isPreview) {
      return {
        ...emptyAgentStats,
        alpha_calls_total: 156, // Mock calls for demo
        alpha_calls_missed: 5, // Mock missed calls
        alpha_appointments: 18, // Mock appointments
        xi_important_emails: 42, // Mock important emails
        xi_missed_emails: 3, // Mock missed emails
        xi_payments_bills: 8, // Mock payments/bills
        xi_invoices: 4, // Mock invoices
        mu_media_edits: 87, // Mock media edits
        beta_insights_count: 28, // Mock insights count
      };
    }
    // Use real stats (will be 0 if no activity since activation)
    return stats ?? emptyAgentStats;
  }, [isAccessReady, isPreview, stats]);
  const noStats = !stats && !loading && !error;
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">("daily");
  const current = useMemo(() => calculateRollupStats(latestStats, timeframe), [latestStats, timeframe]);

  const agentConfig = AGENT_BY_ID["insight"];
  
  const timeframes = useMemo(() => [
    { id: "daily", label: t("daily") },
    { id: "weekly", label: t("weekly") },
    { id: "monthly", label: t("monthly") },
  ], [t]);

  return (
    <div className="space-y-6">
      {isPreview && (
        <PreviewBanner 
          agentName={agentConfig.label} 
          requiredTier={agentConfig.requiredTier}
        />
      )}
      {isTrialExpired && (
        <TrialExpiredBanner />
      )}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-500">{t("insightAgent")}</p>
          <h1 className="text-3xl font-semibold">{t("businessIntelligenceRollup")}</h1>
        </div>
        <div className="flex gap-2 rounded-full border border-slate-200 p-1 text-sm font-semibold dark:border-slate-800">
          {timeframes.map((group) => (
            <button
              key={group.id}
              onClick={() => setTimeframe(group.id as keyof typeof stats)}
              className={`rounded-full px-4 py-2 ${
                timeframe === group.id
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-500"
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
      </header>
      <section className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t("insightLatestInsightCount")}</p>
          {!isPreview && loading && <span className="text-xs text-slate-500">{t("loadingStats")}</span>}
          {!isPreview && error && <span className="text-xs text-red-500">{t("couldntLoadStats")}</span>}
          {!isPreview && noStats && <span className="text-xs text-slate-500">{t("noStatsYet")}</span>}
        </div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-center dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t("insightInsightsGenerated")}</p>
          <p className="mt-2 text-3xl font-semibold">{latestStats.beta_insights_count}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{t("insightHasGenerated")} {latestStats.beta_insights_count} {t("insightInsightsThisPeriod")}</p>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t("insightCalls")}</p>
          <p className="mt-2 text-2xl">{current.calls}</p>
          <p className="text-xs text-slate-500">{t("insightFromAloha")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t("insightEmails")}</p>
          <p className="mt-2 text-2xl">{current.emails}</p>
          <p className="text-xs text-slate-500">{t("insightFromSync")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t("insightMediaItems")}</p>
          <p className="mt-2 text-2xl">{current.media}</p>
          <p className="text-xs text-slate-500">{t("insightFromStudio")}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs uppercase tracking-widest text-slate-500">{t("insightTimeSaved")}</p>
          <p className="mt-2 text-2xl">{current.timeSaved} {t("insightHrs")}</p>
          <p className="text-xs text-slate-500">{t("insightInsightEstimate")}</p>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <InsightTimeline range={timeframe} isPreview={isPreview} />
        <ActivityMixChart range={timeframe} isPreview={isPreview} />
      </section>

      {/* Insight Intelligence Features - Disabled in preview mode */}
      {!isPreview && (
        <section className="mt-4">
          <h2 className="text-xl font-semibold mb-4">{t("insightIntelligence")}</h2>
          
          {/* Insight Score Widget */}
          <div className="mb-4">
            <InsightScoreWidget range={timeframe} />
          </div>
          
          <div className="grid gap-4 lg:grid-cols-2">
            <DailyBriefCard range={timeframe} />
            <InsightGenerator range={timeframe} />
          </div>
          
          {/* Insight Memory Panel */}
          <div className="mt-4">
            <InsightMemoryPanel />
          </div>
          
          <div className="mt-4">
            <WorkflowManager />
          </div>
        </section>
      )}
      {isPreview && (
        <section className="mt-4">
          <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-12 text-center dark:border-slate-700 dark:bg-slate-900/20">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              {t("insightInteractiveFeaturesDisabled")}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              {t("insightUpgradeToElite")}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
