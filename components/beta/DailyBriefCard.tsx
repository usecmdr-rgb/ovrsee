"use client";

import { useState } from "react";
import { FileText, Loader2, AlertCircle, Calendar, TrendingUp, CheckCircle, ListChecks } from "lucide-react";
import type { DailyBrief } from "@/types";

export default function DailyBriefCard() {
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateBrief = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/beta/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (result.ok) {
        setBrief(result.data);
      } else {
        setError(result.error || "Failed to generate brief");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate brief");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold">Daily Command Brief</h3>
          <p className="text-sm text-slate-500 mt-1">Unified briefing from all agents</p>
        </div>
        <button
          onClick={generateBrief}
          disabled={loading}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText size={16} />
              Generate Brief
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {brief && (
        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ListChecks size={18} className="text-slate-600 dark:text-slate-400" />
              <h4 className="font-semibold">Top 5 Priorities</h4>
            </div>
            <ul className="space-y-2">
              {brief.topPriorities.map((priority, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500">{idx + 1}.</span>
                  <span>{priority}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={18} className="text-slate-600 dark:text-slate-400" />
              <h4 className="font-semibold">Action Items</h4>
            </div>
            <ul className="space-y-2">
              {brief.actionItems.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    item.priority === "high" 
                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      : item.priority === "medium"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}>
                    {item.priority}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">{item.description}</span>
                </li>
              ))}
            </ul>
          </div>

          {brief.alerts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={18} className="text-red-600 dark:text-red-400" />
                <h4 className="font-semibold">Alerts & Deadlines</h4>
              </div>
              <ul className="space-y-2">
                {brief.alerts.map((alert) => (
                  <li key={alert.id} className="rounded-2xl bg-red-50 border border-red-200 p-3 text-sm dark:bg-red-900/20 dark:border-red-800">
                    <p className="text-red-700 dark:text-red-300">{alert.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brief.calendarIssues.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={18} className="text-slate-600 dark:text-slate-400" />
                <h4 className="font-semibold">Calendar Issues</h4>
              </div>
              <ul className="space-y-2">
                {brief.calendarIssues.map((issue) => (
                  <li key={issue.id} className="text-sm text-slate-600 dark:text-slate-300">
                    {issue.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} className="text-slate-600 dark:text-slate-400" />
              <h4 className="font-semibold">Metric Insights</h4>
            </div>
            <div className="space-y-3">
              {brief.metricInsights.map((insight, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{insight.agent.toUpperCase()}: {insight.metric}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      insight.trend === "up"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : insight.trend === "down"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}>
                      {insight.trend}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-1">{insight.insight}</p>
                </div>
              ))}
            </div>
          </div>

          {brief.suggestedCorrections.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">Suggested Corrections</h4>
              <ul className="space-y-2">
                {brief.suggestedCorrections.map((correction) => (
                  <li key={correction.id} className="rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-800 dark:bg-yellow-900/20">
                    <p className="font-semibold text-yellow-800 dark:text-yellow-300">{correction.issue}</p>
                    <p className="text-yellow-700 dark:text-yellow-400 mt-1">{correction.suggestion}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brief.followUpList.length > 0 && (
            <div>
              <h4 className="font-semibold mb-3">Follow-up List</h4>
              <ul className="space-y-2">
                {brief.followUpList.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-500">•</span>
                    <span>{item.item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800">
            Generated at {new Date(brief.generatedAt).toLocaleString()}
          </p>
        </div>
      )}

      {!brief && !loading && !error && (
        <div className="mt-6 text-center py-8 text-slate-500">
          <FileText size={48} className="mx-auto mb-3 opacity-50" />

          <p>Click &quot;Generate Brief&quot; to create your daily command brief</p>
        </div>
      )}
    </div>
  );
}





