"use client";

import { useState, useEffect } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface Experiment {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
  variant_count: number;
  winner_variant_label?: string | null;
}

interface VariantPost {
  id: string;
  platform: string;
  caption: string | null;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  experiment_variant_label: string;
  predicted_score_label?: string | null;
}

interface ExperimentResults {
  variant_metrics: Array<{
    variant_label: string;
    post_id: string;
    platform: string;
    caption: string | null;
    impressions: number;
    engagement_rate: number;
  }>;
  winner_variant_label: string | null;
  winner_reason: string | null;
  total_impressions: number;
  avg_engagement_rate: number;
}

export default function StudioExperimentsPage() {
  const router = useRouter();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);
  const [experimentDetail, setExperimentDetail] = useState<{
    experiment: Experiment;
    variant_posts: VariantPost[];
    results: ExperimentResults;
    summary?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExperiments();
  }, []);

  useEffect(() => {
    if (selectedExperiment) {
      loadExperimentDetail(selectedExperiment);
    }
  }, [selectedExperiment]);

  const loadExperiments = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/studio/experiments", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load experiments");
      }

      const data = await res.json();
      if (data.ok) {
        setExperiments(data.data.experiments || []);
        if (data.data.experiments && data.data.experiments.length > 0 && !selectedExperiment) {
          setSelectedExperiment(data.data.experiments[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load experiments");
    } finally {
      setLoading(false);
    }
  };

  const loadExperimentDetail = async (experimentId: string) => {
    try {
      setLoadingDetail(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const res = await fetch(`/api/studio/experiments/${experimentId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load experiment details");
      }

      const data = await res.json();
      if (data.ok) {
        setExperimentDetail(data.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load experiment details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleFinalize = async (experimentId: string) => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const res = await fetch(`/api/studio/experiments/${experimentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "finalize" }),
      });

      if (!res.ok) {
        throw new Error("Failed to finalize experiment");
      }

      // Reload experiments and detail
      await loadExperiments();
      if (selectedExperiment === experimentId) {
        await loadExperimentDetail(experimentId);
      }
    } catch (err: any) {
      setError(err.message || "Failed to finalize experiment");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "running":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-300";
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
            Experiments
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            A/B test hooks, captions, posting times, and hashtags to discover what actually works
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Experiments List */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FlaskConical className="w-5 h-5" />
              Experiments
            </h2>
            {experiments.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium mb-1">No experiments yet</p>
                <p className="text-xs mb-4 max-w-xs mx-auto">
                  A/B test hooks, captions, or posting times to see what actually works. Ask Studio Agent to create your first experiment.
                </p>
                <button
                  onClick={() => router.push("/studio/chat")}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium"
                >
                  Ask Studio Agent
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {experiments.map((exp) => {
                  const isSelected = selectedExperiment === exp.id;
                  return (
                    <button
                      key={exp.id}
                      onClick={() => setSelectedExperiment(exp.id)}
                      className={`
                        w-full text-left p-3 rounded-lg border transition-colors
                        ${
                          isSelected
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700"
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{exp.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(exp.status)}`}
                        >
                          {exp.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="capitalize">{exp.type}</span>
                        <span>•</span>
                        <span>{exp.variant_count} variants</span>
                        {exp.winner_variant_label && (
                          <>
                            <span>•</span>
                            <span className="text-green-600 dark:text-green-400">
                              Winner: {exp.winner_variant_label}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {format(new Date(exp.created_at), "MMM d, yyyy")}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Experiment Detail */}
        <div className="lg:col-span-2">
          {experimentDetail ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-semibold">{experimentDetail.experiment.name}</h2>
                  {experimentDetail.experiment.status === "running" && (
                    <button
                      onClick={() => handleFinalize(experimentDetail.experiment.id)}
                      className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium"
                    >
                      Finalize
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <span className="capitalize">{experimentDetail.experiment.type}</span>
                  <span>•</span>
                  <span>{experimentDetail.variant_posts.length} variants</span>
                  <span>•</span>
                  <span>{format(new Date(experimentDetail.experiment.created_at), "MMM d, yyyy")}</span>
                </div>
              </div>

              {/* Results Summary */}
              {experimentDetail.results && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    <h3 className="font-semibold">Results</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total Impressions</p>
                      <p className="text-lg font-semibold">
                        {experimentDetail.results.total_impressions.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Avg Engagement Rate</p>
                      <p className="text-lg font-semibold">
                        {experimentDetail.results.avg_engagement_rate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Winner</p>
                      <p className="text-lg font-semibold">
                        {experimentDetail.results.winner_variant_label ? (
                          <span className="text-green-600 dark:text-green-400">
                            Variant {experimentDetail.results.winner_variant_label}
                          </span>
                        ) : (
                          <span className="text-slate-400">TBD</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {experimentDetail.results.winner_reason && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {experimentDetail.results.winner_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Variants Table */}
              <div>
                <h3 className="font-semibold mb-3">Variants</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left p-2">Variant</th>
                        <th className="text-left p-2">Platform</th>
                        <th className="text-left p-2">Caption</th>
                        <th className="text-right p-2">Impressions</th>
                        <th className="text-right p-2">Engagement</th>
                        <th className="text-right p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {experimentDetail.variant_posts.map((post) => {
                        const metrics = experimentDetail.results?.variant_metrics.find(
                          (v) => v.variant_label === post.experiment_variant_label
                        );
                        const isWinner =
                          experimentDetail.results?.winner_variant_label === post.experiment_variant_label;

                        return (
                          <tr
                            key={post.id}
                            className={`border-b border-slate-100 dark:border-slate-800 ${
                              isWinner ? "bg-green-50 dark:bg-green-900/10" : ""
                            }`}
                          >
                            <td className="p-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{post.experiment_variant_label}</span>
                                {isWinner && (
                                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                )}
                              </div>
                            </td>
                            <td className="p-2 capitalize">{post.platform}</td>
                            <td className="p-2">
                              <span className="truncate max-w-[200px] block">
                                {post.caption?.substring(0, 50) || "No caption"}
                                {post.caption && post.caption.length > 50 ? "..." : ""}
                              </span>
                            </td>
                            <td className="p-2 text-right">
                              {metrics?.impressions.toLocaleString() || "—"}
                            </td>
                            <td className="p-2 text-right">
                              {metrics ? `${metrics.engagement_rate.toFixed(1)}%` : "—"}
                            </td>
                            <td className="p-2 text-right">
                              <span className="capitalize text-xs">{post.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              {experimentDetail.summary && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <h3 className="font-semibold mb-2">Summary</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {experimentDetail.summary}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
              <FlaskConical className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="text-lg font-semibold mb-2">No Experiment Selected</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select an experiment from the list to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

