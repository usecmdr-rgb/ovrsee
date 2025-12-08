"use client";

import { useState, useEffect } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Users, Loader2, Plus, Trash2, Instagram, Video, Facebook } from "lucide-react";
import { format } from "date-fns";

interface Competitor {
  id: string;
  platform: "instagram" | "tiktok" | "facebook";
  handle: string;
  label: string | null;
  created_at: string;
  latest_metrics?: {
    followers: number | null;
    posts_count: number | null;
    captured_at: string;
  } | null;
}

export default function StudioCompetitorsPage() {
  const router = useRouter();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    platform: "instagram" as "instagram" | "tiktok" | "facebook",
    handle: "",
    label: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompetitors();
  }, []);

  const loadCompetitors = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/studio/competitors", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load competitors");
      }

      const data = await res.json();
      if (data.ok) {
        setCompetitors(data.data.competitors || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load competitors");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!formData.handle.trim()) {
      setError("Handle is required");
      return;
    }

    try {
      setAdding(true);
      setError(null);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/studio/competitors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          platform: formData.platform,
          handle: formData.handle.trim(),
          label: formData.label.trim() || null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add competitor");
      }

      // Reset form and reload
      setFormData({ platform: "instagram", handle: "", label: "" });
      setShowAddForm(false);
      await loadCompetitors();
    } catch (err: any) {
      setError(err.message || "Failed to add competitor");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCompetitor = async (id: string) => {
    if (!confirm("Are you sure you want to remove this competitor?")) {
      return;
    }

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      // Note: We'd need a DELETE endpoint for this, but for v1 we can skip it
      // or implement a simple delete via Supabase client
      setError("Delete functionality not yet implemented. Use Supabase dashboard for now.");
    } catch (err: any) {
      setError(err.message || "Failed to delete competitor");
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram":
        return Instagram;
      case "tiktok":
        return Video;
      case "facebook":
        return Facebook;
      default:
        return Users;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "instagram":
        return "text-pink-600 dark:text-pink-400";
      case "tiktok":
        return "text-black dark:text-white";
      case "facebook":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-slate-600 dark:text-slate-400";
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
            Competitors
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Track competitor accounts and compare their performance with yours
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Competitor
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Add Competitor</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Platform</label>
              <select
                value={formData.platform}
                onChange={(e) =>
                  setFormData({ ...formData, platform: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Handle</label>
              <input
                type="text"
                value={formData.handle}
                onChange={(e) =>
                  setFormData({ ...formData, handle: e.target.value })
                }
                placeholder="@username"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Label (optional)
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                placeholder="Friendly name"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAddCompetitor}
                disabled={adding}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium"
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Add Competitor"
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ platform: "instagram", handle: "", label: "" });
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Competitors List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {competitors.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-slate-100">No competitors yet</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-w-md mx-auto">
              Track competitor accounts to see how your performance compares. Studio uses competitor insights in weekly planning and reports.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium"
            >
              Add Your First Competitor
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left p-4 text-sm font-semibold">Platform</th>
                <th className="text-left p-4 text-sm font-semibold">Handle</th>
                <th className="text-left p-4 text-sm font-semibold">Label</th>
                <th className="text-right p-4 text-sm font-semibold">Followers</th>
                <th className="text-right p-4 text-sm font-semibold">Posts</th>
                <th className="text-left p-4 text-sm font-semibold">Last Updated</th>
                <th className="text-right p-4 text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {competitors.map((comp) => {
                const PlatformIcon = getPlatformIcon(comp.platform);
                return (
                  <tr
                    key={comp.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <PlatformIcon
                          className={`w-5 h-5 ${getPlatformColor(comp.platform)}`}
                        />
                        <span className="capitalize text-sm">{comp.platform}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium">@{comp.handle}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {comp.label || "—"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm">
                        {comp.latest_metrics?.followers
                          ? comp.latest_metrics.followers.toLocaleString()
                          : "—"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-sm">
                        {comp.latest_metrics?.posts_count
                          ? comp.latest_metrics.posts_count.toLocaleString()
                          : "—"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {comp.latest_metrics?.captured_at
                          ? format(
                              new Date(comp.latest_metrics.captured_at),
                              "MMM d, yyyy"
                            )
                          : "Never"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDeleteCompetitor(comp.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Remove competitor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300">
        <p>
          <strong>Note:</strong> Competitor metrics are refreshed daily via cron job.
          If metrics are not available, it may be because the competitor account is
          private or the API doesn't provide public data access.
        </p>
      </div>
    </div>
  );
}

