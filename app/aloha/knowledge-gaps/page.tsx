"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/hooks/useTranslation";

interface KnowledgeGap {
  id: string;
  agent: string;
  source: string;
  question: string;
  requested_info: string;
  suggested_category: string;
  status: string;
  context_id: string | null;
  context_metadata: Record<string, any>;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
}

export default function KnowledgeGapsPage() {
  const t = useTranslation();
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [selectedGap, setSelectedGap] = useState<KnowledgeGap | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [addToKnowledgeBase, setAddToKnowledgeBase] = useState(false);
  const [knowledgeChunkContent, setKnowledgeChunkContent] = useState("");

  const fetchGaps = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== "all") {
        params.append("status", filter);
      }
      const response = await fetch(`/api/knowledge-gaps?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch knowledge gaps");
      }
      const data = await response.json();
      setGaps(data.gaps || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchGaps();
  }, [fetchGaps]);

  const handleResolve = async () => {
    if (!selectedGap || !resolutionNotes.trim()) {
      alert(t("pleaseProvideResolutionNotes"));
      return;
    }

    try {
      setResolving(true);
      const response = await fetch(`/api/knowledge-gaps/${selectedGap.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolutionNotes,
          resolutionAction: addToKnowledgeBase ? "added_knowledge_chunk" : "updated_business_info",
          addToKnowledgeBase,
          knowledgeChunkContent: addToKnowledgeBase ? knowledgeChunkContent : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || "Failed to resolve gap");
      }

      // Refresh gaps and close modal
      fetchGaps();
      setSelectedGap(null);
      setResolutionNotes("");
      setKnowledgeChunkContent("");
      setAddToKnowledgeBase(false);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setResolving(false);
    }
  };

  const getAgentLabel = (agent: string) => {
    switch (agent) {
      case "aloha":
        return "Aloha";
      case "sync":
        return "Sync";
      case "studio":
        return "Studio";
      case "insight":
        return "Insight";
      default:
        return agent;
    }
  };

  const getCategoryLabel = (category: string) => {
    return category
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">{t("loadingKnowledgeGaps")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm uppercase tracking-widest text-slate-500">{t("alohaAgent")}</p>
        <h1 className="text-3xl font-semibold">{t("knowledgeGaps")}</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2">
          {t("knowledgeGapsDescription")}
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("open")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "open"
              ? "bg-brand-accent text-white"
              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {t("open")} ({gaps.filter((g) => g.status === "open").length})
        </button>
        <button
          onClick={() => setFilter("resolved")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "resolved"
              ? "bg-brand-accent text-white"
              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {t("resolved")} ({gaps.filter((g) => g.status === "resolved").length})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-brand-accent text-white"
              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {t("all")}
        </button>
      </div>

      {gaps.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-slate-500">
            {filter === "open"
              ? t("noOpenGaps")
              : t("noKnowledgeGapsFound")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {gaps.map((gap) => (
            <div
              key={gap.id}
              className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {getAgentLabel(gap.agent)}
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {getCategoryLabel(gap.suggested_category)}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        gap.status === "open"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      }`}
                    >
                      {gap.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{gap.question}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    <strong>{t("requestedInfo")}</strong> {gap.requested_info}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(gap.created_at)} • {t("source")}: {gap.source}
                    {gap.context_id && ` • ${t("contextId")}: ${gap.context_id}`}
                  </p>
                  {gap.resolution_notes && (
                    <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">
                        {t("resolution")}
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {gap.resolution_notes}
                      </p>
                      {gap.resolved_at && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          {t("resolvedAt")} {formatDate(gap.resolved_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {gap.status === "open" && (
                <button
                  onClick={() => setSelectedGap(gap)}
                  className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors text-sm"
                >
                  {t("resolve")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolution Modal */}
      {selectedGap && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold mb-4">{t("resolveKnowledgeGap")}</h2>
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm font-semibold mb-1">{t("question")}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{selectedGap.question}</p>
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">{t("requestedInfo")}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {selectedGap.requested_info}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("resolutionNotesRequired")}
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={4}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
                  placeholder={t("resolutionNotesPlaceholder")}
                />
              </div>
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={addToKnowledgeBase}
                    onChange={(e) => setAddToKnowledgeBase(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">
                    {t("addToKnowledgeBase")}
                  </span>
                </label>
                {addToKnowledgeBase && (
                  <textarea
                    value={knowledgeChunkContent}
                    onChange={(e) => setKnowledgeChunkContent(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 mt-2"
                    placeholder={t("knowledgeChunkPlaceholder")}
                  />
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleResolve}
                disabled={resolving || !resolutionNotes.trim()}
                className="px-6 py-3 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolving ? t("resolving") : t("resolve")}
              </button>
              <button
                onClick={() => {
                  setSelectedGap(null);
                  setResolutionNotes("");
                  setKnowledgeChunkContent("");
                  setAddToKnowledgeBase(false);
                }}
                className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

