"use client";

import { useState } from "react";
import { useAgentStats, emptyAgentStats } from "@/hooks/useAgentStats";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import PreviewBanner from "@/components/agent/PreviewBanner";
import { AGENT_BY_ID } from "@/lib/config/agents";
import DailyBriefCard from "@/components/insight/DailyBriefCard";
import InsightGenerator from "@/components/insight/InsightGenerator";
import WorkflowManager from "@/components/insight/WorkflowManager";

const timeframes = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const mockRollupStats = {
  daily: { calls: 32, emails: 6, media: 4, timeSaved: 2.5 },
  weekly: { calls: 180, emails: 28, media: 17, timeSaved: 12 },
  monthly: { calls: 680, emails: 90, media: 52, timeSaved: 48 },
};

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
  
  // Use preview/mock data if user doesn't have access
  const isPreview = !hasAccess && !accessLoading;
  
  // Fallback to realistic random numbers if no stats available or in preview mode
  const fallbackStats = {
    ...emptyAgentStats,
    beta_insights_count: isPreview ? 28 : 42,
  };
  const latestStats = stats ?? fallbackStats;
  const noStats = !stats && !loading && !error;
  const [timeframe, setTimeframe] = useState<keyof typeof mockRollupStats>("daily");
  const current = mockRollupStats[timeframe];

  const agentConfig = AGENT_BY_ID["insight"];

  return (
    <div className="space-y-6">
      {isPreview && (
        <PreviewBanner 
          agentName={agentConfig.label} 
          requiredTier={agentConfig.requiredTier}
        />
      )}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-500">Insight agent</p>
          <h1 className="text-3xl font-semibold">Business intelligence rollup</h1>
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
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Latest insight count</p>
          {loading && <span className="text-xs text-slate-500">Loading stats…</span>}
          {error && <span className="text-xs text-red-500">Couldn&apos;t load stats</span>}
          {noStats && <span className="text-xs text-slate-500">No stats yet</span>}
        </div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-center dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs uppercase tracking-widest text-slate-500">Insights generated</p>
          <p className="mt-2 text-3xl font-semibold">{latestStats.beta_insights_count}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Insight has generated {latestStats.beta_insights_count} insights this period.</p>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs uppercase tracking-widest text-slate-500">Calls</p>
          <p className="mt-2 text-2xl">{current.calls}</p>
          <p className="text-xs text-slate-500">from Aloha</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs uppercase tracking-widest text-slate-500">Emails</p>
          <p className="mt-2 text-2xl">{current.emails}</p>
          <p className="text-xs text-slate-500">from Sync</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs uppercase tracking-widest text-slate-500">Media items</p>
          <p className="mt-2 text-2xl">{current.media}</p>
          <p className="text-xs text-slate-500">from Studio</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs uppercase tracking-widest text-slate-500">Time saved</p>
          <p className="mt-2 text-2xl">{current.timeSaved} hrs</p>
          <p className="text-xs text-slate-500">Insight estimate</p>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-lg font-semibold">Insights</h2>
          <div className="mt-2 space-y-2">
            {insights[timeframe].map((text) => (
              <div key={text} className="rounded-xl border border-slate-100 bg-white/80 p-3 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                {text}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-lg font-semibold">Calls vs Emails</h2>
          <div className="mt-2 grid h-32 grid-cols-6 items-end gap-2">
            {[8, 12, 6, 10, 7, 11].map((height, index) => (
              <div key={index} className="space-y-1 text-center">
                <div className="mx-auto w-5 rounded-full bg-slate-900" style={{ height: `${height * 4}px` }}></div>
                <p className="text-xs text-slate-500">W{index + 1}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Placeholder chart. Swap with real analytics (Recharts, Chart.js, etc.).
          </p>
        </div>
      </section>

      {/* Insight Intelligence Features */}
      <section className="mt-4">
        <h2 className="text-xl font-semibold mb-4">Insight Intelligence</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <DailyBriefCard />
          <InsightGenerator />
        </div>
        <div className="mt-4">
          <WorkflowManager />
        </div>
      </section>
    </div>
  );
}
