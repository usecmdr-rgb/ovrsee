"use client";

import { useState, useEffect } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Calendar, Sparkles, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
// Simple markdown renderer (basic support)
const renderMarkdown = (markdown: string) => {
  // Split by double newlines for paragraphs
  const paragraphs = markdown.split(/\n\n+/);
  
  return paragraphs.map((para, idx) => {
    para = para.trim();
    if (!para) return null;
    
    // Headers
    if (para.startsWith("# ")) {
      return <h1 key={idx} className="text-2xl font-bold mt-6 mb-3">{para.substring(2)}</h1>;
    }
    if (para.startsWith("## ")) {
      return <h2 key={idx} className="text-xl font-semibold mt-5 mb-2">{para.substring(3)}</h2>;
    }
    if (para.startsWith("### ")) {
      return <h3 key={idx} className="text-lg font-semibold mt-4 mb-2">{para.substring(4)}</h3>;
    }
    
    // Bullet lists
    if (para.includes("\n- ") || para.startsWith("- ")) {
      const items = para.split(/\n- /).filter(item => item.trim());
      return (
        <ul key={idx} className="list-disc list-inside space-y-1 my-3">
          {items.map((item, itemIdx) => (
            <li key={itemIdx} className="text-slate-700 dark:text-slate-300">
              {item.replace(/^-\s*/, "").trim()}
            </li>
          ))}
        </ul>
      );
    }
    
    // Numbered lists
    if (para.match(/^\d+\.\s/)) {
      const items = para.split(/\n\d+\.\s/).filter(item => item.trim());
      return (
        <ol key={idx} className="list-decimal list-inside space-y-1 my-3">
          {items.map((item, itemIdx) => (
            <li key={itemIdx} className="text-slate-700 dark:text-slate-300">
              {item.replace(/^\d+\.\s*/, "").trim()}
            </li>
          ))}
        </ol>
      );
    }
    
    // Bold text
    para = para.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Regular paragraph
    return (
      <p key={idx} className="text-slate-700 dark:text-slate-300 my-3 leading-relaxed">
        <span dangerouslySetInnerHTML={{ __html: para }} />
      </p>
    );
  }).filter(Boolean);
};

interface WeeklyReport {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  summary_markdown: string;
  created_at: string;
  created_by: string | null;
}

export default function StudioReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/studio/reports", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load reports");
      }

      const data = await res.json();
      if (data.ok) {
        setReports(data.data.reports || []);
        if (data.data.reports && data.data.reports.length > 0 && !selectedReport) {
          setSelectedReport(data.data.reports[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      setError(null);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/studio/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate report");
      }

      const data = await res.json();
      if (data.ok) {
        // Reload reports and select the new one
        await loadReports();
        if (data.data.report) {
          setSelectedReport(data.data.report);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectReport = async (reportId: string) => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const res = await fetch(`/api/studio/reports/${reportId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load report");
      }

      const data = await res.json();
      if (data.ok) {
        setSelectedReport(data.data.report);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load report");
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Weekly Reports
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            AI-powered performance insights, what worked, and what to do next
          </p>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Generate Report
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Reports
            </h2>
            {reports.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium mb-1">No reports yet</p>
                <p className="text-xs mb-4">Get AI-powered insights on your social media performance</p>
                <button
                  onClick={handleGenerateReport}
                  disabled={generating}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 inline mr-1" />
                      Generate First Report
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map((report) => {
                  const isSelected = selectedReport?.id === report.id;
                  const periodStart = parseISO(report.period_start);
                  const periodEnd = parseISO(report.period_end);
                  
                  return (
                    <button
                      key={report.id}
                      onClick={() => handleSelectReport(report.id)}
                      className={`
                        w-full text-left p-3 rounded-lg border transition-colors
                        ${
                          isSelected
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700"
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-medium">
                          {format(periodStart, "MMM d")} - {format(periodEnd, "MMM d")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {format(parseISO(report.created_at), "MMM d, yyyy")}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Report View */}
        <div className="lg:col-span-2">
          {selectedReport ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <h2 className="text-xl font-semibold">
                    {format(parseISO(selectedReport.period_start), "MMM d")} -{" "}
                    {format(parseISO(selectedReport.period_end), "MMM d, yyyy")}
                  </h2>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Generated on {format(parseISO(selectedReport.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>

              <div className="text-slate-900 dark:text-slate-100">
                {renderMarkdown(selectedReport.summary_markdown)}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="text-lg font-semibold mb-2">No Report Selected</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Select a report from the list or generate a new one
              </p>
              <button
                onClick={handleGenerateReport}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Generate Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

