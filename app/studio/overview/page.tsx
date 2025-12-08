"use client";

import { useState, useEffect } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  Calendar,
  TrendingUp,
  FileText,
  Sparkles,
  MessageSquare,
  BarChart3,
  FlaskConical,
  Tag,
  Loader2,
  ArrowRight,
  Link2,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface OverviewData {
  schedule: {
    next_7_days: Array<{
      id: string;
      platform: string;
      caption: string | null;
      status: string;
      scheduled_for: string | null;
      published_at: string | null;
      predicted_score_label?: string | null;
      experiment_variant_label?: string | null;
    }>;
  };
  metrics_snapshot: {
    total_posts: number;
    total_impressions: number;
    avg_engagement_rate: number;
    period_days: number;
  };
  latest_report: {
    id: string;
    period_start: string;
    period_end: string;
    summary_preview: string;
  } | null;
  top_hashtags: Array<{
    name: string;
    engagement_rate: number;
  }>;
  recent_experiments: Array<{
    id: string;
    name: string;
    status: string;
    winner_variant_label: string | null;
  }>;
}

export default function StudioOverviewPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/studio/overview", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load overview");
      }

      const data = await res.json();
      if (data.ok) {
        setOverview(data.data);
      }
    } catch (error) {
      console.error("Error loading overview:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWeeklyPlan = async () => {
    try {
      setGeneratingPlan(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const res = await fetch("/api/studio/plans/weekly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error("Failed to generate plan");
      }

      alert("Weekly plan generated! Check the calendar.");
      await loadOverview();
    } catch (error) {
      console.error("Error generating plan:", error);
      alert("Failed to generate weekly plan");
    } finally {
      setGeneratingPlan(false);
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

  if (!overview) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-slate-600 dark:text-slate-400">Unable to load overview data</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Studio Overview
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Your AI social strategist, scheduler, and analyst in one
        </p>
      </div>

      {/* Getting Started Panel - Show if low activity or onboarding incomplete */}
      {(overview.metrics_snapshot.total_posts < 5 || overview.schedule.next_7_days.length === 0) && (
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg border border-violet-200 dark:border-violet-800 p-6">
          <h2 className="text-lg font-semibold mb-3 text-slate-900 dark:text-slate-100">
            Get Started with Studio
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Start planning your content strategy with AI-powered insights and automation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={handleGenerateWeeklyPlan}
              disabled={generatingPlan}
              className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-colors text-left"
            >
              {generatingPlan ? (
                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
              ) : (
                <Sparkles className="w-5 h-5 text-violet-500" />
              )}
              <div>
                <p className="font-medium text-sm">Generate Next Week&apos;s Plan</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">AI-powered content calendar</p>
              </div>
            </button>
            <button
              onClick={() => router.push("/studio/chat")}
              className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-colors text-left"
            >
              <MessageSquare className="w-5 h-5 text-violet-500" />
              <div>
                <p className="font-medium text-sm">Ask Studio Agent</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Create posts, schedule, repurpose</p>
              </div>
            </button>
            <button
              onClick={() => router.push("/studio/reports")}
              className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-violet-500" />
              <div>
                <p className="font-medium text-sm">Review Performance</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Weekly insights & recommendations</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Top Row: Schedule & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* This Week's Schedule */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              This Week&apos;s Schedule
            </h2>
            <button
              onClick={() => router.push("/studio/calendar")}
              className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
            >
              View All
            </button>
          </div>
          {overview.schedule.next_7_days.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No posts scheduled</p>
            </div>
          ) : (
            <div className="space-y-2">
              {overview.schedule.next_7_days.slice(0, 5).map((post) => (
                <div
                  key={post.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                  onClick={() => router.push(`/studio?postId=${post.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium capitalize">{post.platform}</span>
                      <span className="text-xs text-slate-500 capitalize">{post.status}</span>
                      {post.predicted_score_label && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            post.predicted_score_label === "high"
                              ? "bg-green-500"
                              : post.predicted_score_label === "medium"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        />
                      )}
                      {post.experiment_variant_label && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {post.experiment_variant_label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                      {post.caption || "No caption"}
                    </p>
                    {post.scheduled_for && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {format(parseISO(post.scheduled_for), "MMM d, h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metrics Snapshot */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Metrics Snapshot
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Posts</p>
              <p className="text-2xl font-bold">{overview.metrics_snapshot.total_posts}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Impressions</p>
              <p className="text-2xl font-bold">
                {overview.metrics_snapshot.total_impressions.toLocaleString()}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Avg Engagement Rate</p>
              <p className="text-2xl font-bold">
                {overview.metrics_snapshot.avg_engagement_rate.toFixed(1)}%
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
            Last {overview.metrics_snapshot.period_days} days
          </p>
        </div>
      </div>

      {/* Middle Row: Latest Report & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Report */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Latest Report
            </h2>
            {overview.latest_report && (
              <button
                onClick={() => router.push("/studio/reports")}
                className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
              >
                View All
              </button>
            )}
          </div>
          {overview.latest_report ? (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                {format(parseISO(overview.latest_report.period_start), "MMM d")} -{" "}
                {format(parseISO(overview.latest_report.period_end), "MMM d, yyyy")}
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-4">
                {overview.latest_report.summary_preview}...
              </p>
              <button
                onClick={() => router.push(`/studio/reports?reportId=${overview.latest_report?.id}`)}
                className="mt-4 text-sm text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1"
              >
                Read full report <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No reports yet</p>
            </div>
          )}
        </div>

        {/* Hashtag & Experiment Insights */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Insights
          </h2>
          <div className="space-y-4">
            {/* Top Hashtags */}
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Top Hashtags
              </h3>
              {overview.top_hashtags.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">No data yet</p>
              ) : (
                <div className="space-y-1">
                  {overview.top_hashtags.map((hashtag) => (
                    <div
                      key={hashtag.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-700 dark:text-slate-300">#{hashtag.name}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {hashtag.engagement_rate.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Experiments */}
            {overview.recent_experiments.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" />
                  Recent Experiments
                </h3>
                <div className="space-y-1">
                  {overview.recent_experiments.map((exp) => (
                    <div
                      key={exp.id}
                      className="flex items-center justify-between text-sm cursor-pointer hover:text-violet-600 dark:hover:text-violet-400"
                      onClick={() => router.push(`/studio/experiments`)}
                    >
                      <span className="text-slate-700 dark:text-slate-300 truncate">
                        {exp.name}
                      </span>
                      {exp.winner_variant_label && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          Winner: {exp.winner_variant_label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={handleGenerateWeeklyPlan}
            disabled={generatingPlan}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            {generatingPlan ? (
              <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            ) : (
              <Sparkles className="w-5 h-5 text-violet-500" />
            )}
            <span className="text-xs font-medium">Generate Plan</span>
          </button>
          <button
            onClick={() => router.push("/studio/chat")}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-violet-500" />
            <span className="text-xs font-medium">Ask Studio</span>
          </button>
          <button
            onClick={() => router.push("/studio/calendar")}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <Calendar className="w-5 h-5 text-violet-500" />
            <span className="text-xs font-medium">Calendar</span>
          </button>
          <button
            onClick={() => router.push("/studio/reports")}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <FileText className="w-5 h-5 text-violet-500" />
            <span className="text-xs font-medium">Reports</span>
          </button>
          <button
            onClick={() => router.push("/studio/experiments")}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <FlaskConical className="w-5 h-5 text-violet-500" />
            <span className="text-xs font-medium">Experiments</span>
          </button>
          <button
            onClick={() => router.push("/studio/settings/social-accounts")}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <Link2 className="w-5 h-5 text-violet-500" />
            <span className="text-xs font-medium">Connect Accounts</span>
          </button>
        </div>
      </div>
    </div>
  );
}

