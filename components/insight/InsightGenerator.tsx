"use client";

import { useState, useMemo } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useInsightsAgent } from "@/hooks/useInsightsAgent";

interface InsightGeneratorProps {
  range?: 'daily' | 'weekly' | 'monthly';
}

export default function InsightGenerator({ range = 'daily' }: InsightGeneratorProps) {
  const t = useTranslation();
  const [question, setQuestion] = useState("");
  const { sendQuestion, loading, error, answer } = useInsightsAgent();

  // Calculate date range based on timeframe
  const dateRange = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    let fromDate: Date;
    if (range === "daily") {
      fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 1);
    } else if (range === "weekly") {
      fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 7);
    } else {
      fromDate = new Date(today);
      fromDate.setDate(fromDate.getDate() - 30);
    }
    fromDate.setHours(0, 0, 0, 0);
    
    return {
      from: fromDate.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
    };
  }, [range]);

  const suggestedQuestions = [
    t("insightSuggestedQuestion1") || "What changed today?",
    t("insightSuggestedQuestion2") || "What do I need to focus on?",
    t("insightSuggestedQuestion3") || "What decisions are waiting for me?",
    t("insightSuggestedQuestion4") || "What are the biggest risks right now?",
    t("insightSuggestedQuestion5") || "What should I prioritize this week?",
  ];

  const handleSubmit = async (query?: string) => {
    const queryToUse = query || question;
    if (!queryToUse.trim()) return;

    await sendQuestion(queryToUse, dateRange);
    if (!error) {
      setQuestion("");
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
            onKeyPress={(e) => e.key === "Enter" && !loading && handleSubmit()}
            placeholder={t("insightAskPlaceholder")}
            className="flex-1 rounded-2xl border border-slate-200 bg-transparent px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700"
            disabled={loading}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !question.trim()}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <Send size={16} />
                Ask
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-2">Suggested questions</p>
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((suggested, idx) => (
            <button
              key={idx}
              onClick={() => handleSubmit(suggested)}
              disabled={loading}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {suggested}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-500">
          Couldn&apos;t get an answer right now. Please try again.
        </div>
      )}

      {answer && (
        <div className="mt-6">
          <div 
            className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {answer}
          </div>
        </div>
      )}

      {!answer && !loading && !error && (
        <div className="mt-6 text-center py-8 text-slate-500">
          <Sparkles size={48} className="mx-auto mb-3 opacity-50" />
          <p>Ask a question to get insights about your business metrics</p>
        </div>
      )}
    </div>
  );
}





