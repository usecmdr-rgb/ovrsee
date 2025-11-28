"use client";

import { useState } from "react";
import { Sparkles, Loader2, Send, TrendingUp, AlertTriangle, Lightbulb, CheckCircle } from "lucide-react";
import type { InsightResponse } from "@/types";
import { useAppState } from "@/context/AppStateContext";
import { getLanguageFromLocale } from "@/lib/localization";
import { useTranslation } from "@/hooks/useTranslation";

export default function InsightGenerator() {
  const { language } = useAppState();
  const t = useTranslation();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestedQuestions = [
    t("insightSuggestedQuestion1"),
    t("insightSuggestedQuestion2"),
    t("insightSuggestedQuestion3"),
    t("insightSuggestedQuestion4"),
    t("insightSuggestedQuestion5"),
  ];

  const generateInsights = async (query?: string) => {
    const queryToUse = query || question;
    if (!queryToUse.trim()) return;

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/insight/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          question: queryToUse,
          language: getLanguageFromLocale(language),
        }),
      });

      const result = await response.json();

      if (result.ok) {
        setInsights(result.data);
        setQuestion("");
      } else {
        setError(result.error || t("insightFailedToGenerate"));
      }
    } catch (err: any) {
      setError(err.message || t("insightFailedToGenerate"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-2xl bg-emerald-500 p-2">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">{t("insightAskInsightTitle")}</h3>
          <p className="text-sm text-slate-500">{t("insightAskInsightDescription")}</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !loading && generateInsights()}
            placeholder={t("insightAskPlaceholder")}
            className="flex-1 rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700"
            disabled={loading}
          />
          <button
            onClick={() => generateInsights()}
            disabled={loading || !question.trim()}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t("insightThinking")}
              </>
            ) : (
              <>
                <Send size={16} />
                {t("insightAsk")}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-2">{t("insightSuggestedQuestions")}</p>
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((suggested, idx) => (
            <button
              key={idx}
              onClick={() => generateInsights(suggested)}
              disabled={loading}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {suggested}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 mb-4">
          {error}
        </div>
      )}

      {insights && (
        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={18} className="text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-semibold">{t("insightKeyInsights")}</h4>
            </div>
            <ul className="space-y-2">
              {insights.keyInsights.map((insight, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="text-emerald-500 mt-1">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>

          {insights.priorityDecisions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={18} className="text-slate-600 dark:text-slate-400" />
                <h4 className="font-semibold">{t("insightPriorityDecisions")}</h4>
              </div>
              <div className="space-y-3">
                {insights.priorityDecisions.map((decision) => (
                  <div key={decision.id} className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{decision.decision}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        decision.urgency === "high"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : decision.urgency === "medium"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}>
                        {decision.urgency === "high" ? t("insightHigh") : decision.urgency === "medium" ? t("insightMedium") : t("insightLow")}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{decision.context}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.trends.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={18} className="text-slate-600 dark:text-slate-400" />
                <h4 className="font-semibold">{t("insightTrends")}</h4>
              </div>
              <div className="space-y-2">
                {insights.trends.map((trend, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
                    <div>
                      <span className="font-semibold">{trend.agent.toUpperCase()}: </span>
                      <span className="text-slate-600 dark:text-slate-300">{trend.trend}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        trend.direction === "up"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : trend.direction === "down"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}>
                        {trend.direction === "up" ? t("insightUp") : trend.direction === "down" ? t("insightDown") : trend.direction}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.risks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                <h4 className="font-semibold">{t("insightRisks")}</h4>
              </div>
              <ul className="space-y-2">
                {insights.risks.map((risk) => (
                  <li key={risk.id} className="rounded-2xl bg-red-50 border border-red-200 p-3 text-sm dark:bg-red-900/20 dark:border-red-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-red-700 dark:text-red-300">{risk.risk}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        risk.severity === "high"
                          ? "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200"
                          : risk.severity === "medium"
                          ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200"
                          : "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                      }`}>
                        {risk.severity === "high" ? t("insightHigh") : risk.severity === "medium" ? t("insightMedium") : t("insightLow")}
                      </span>
                    </div>
                    {risk.deadline && (
                      <p className="text-red-600 dark:text-red-400 text-xs mt-1">{t("insightDeadline")} {new Date(risk.deadline).toLocaleDateString()}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb size={18} className="text-yellow-600 dark:text-yellow-400" />
                <h4 className="font-semibold">{t("insightRecommendations")}</h4>
              </div>
              <div className="space-y-3">
                {insights.recommendations.map((rec) => (
                  <div key={rec.id} className="rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-sm dark:border-yellow-800 dark:bg-yellow-900/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-yellow-800 dark:text-yellow-300">{rec.recommendation}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        rec.priority === "high"
                          ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200"
                          : rec.priority === "medium"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}>
                        {rec.priority === "high" ? t("insightHigh") : rec.priority === "medium" ? t("insightMedium") : t("insightLow")}
                      </span>
                    </div>
                    <p className="text-yellow-700 dark:text-yellow-400 text-xs mt-1">{rec.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800">
            {t("insightGeneratedAt").replace("{time}", new Date(insights.generatedAt).toLocaleString())}
          </p>
        </div>
      )}

      {!insights && !loading && !error && (
        <div className="mt-6 text-center py-8 text-slate-500">
          <Sparkles size={48} className="mx-auto mb-3 opacity-50" />
          <p>{t("insightAskToGetInsights")}</p>
        </div>
      )}
    </div>
  );
}





