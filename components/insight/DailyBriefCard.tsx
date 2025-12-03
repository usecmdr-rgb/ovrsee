"use client";

import { FileText, Loader2 } from "lucide-react";
import { useInsightsBrief } from "@/hooks/useInsightsBrief";
import { useMemo } from "react";

interface DailyBriefCardProps {
  range?: 'daily' | 'weekly' | 'monthly';
}

export default function DailyBriefCard({ range = 'daily' }: DailyBriefCardProps) {
  const { generateBrief, loading, error, brief, range: briefRange } = useInsightsBrief();

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

  const handleGenerateBrief = () => {
    generateBrief(dateRange);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold">Daily Command Brief</h3>
          <p className="text-sm text-slate-500 mt-1">Unified briefing from all agents</p>
        </div>
        <button
          onClick={handleGenerateBrief}
          disabled={loading}
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating your daily brief…
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
        <div className="mt-4 text-sm text-red-500">
          Couldn&apos;t generate a brief right now. Please try again.
        </div>
      )}

      {brief && (
        <div className="mt-6">
          <div 
            className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {brief}
          </div>
          {briefRange && (
            <p className="text-xs text-slate-500 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
              Generated for {briefRange.from} to {briefRange.to}
            </p>
          )}
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





