"use client";

import { useState, useEffect } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, Plus, Sparkles, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  post_count: number;
}

export default function StudioCampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [campaignDetail, setCampaignDetail] = useState<{
    campaign: Campaign;
    posts: Array<{
      id: string;
      platform: string;
      caption: string | null;
      status: string;
      scheduled_for: string | null;
      published_at: string | null;
      predicted_score_label?: string | null;
    }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    objective: "",
    start_date: "",
    end_date: "",
  });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      loadCampaignDetail(selectedCampaign);
    }
  }, [selectedCampaign]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/studio/campaigns", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load campaigns");
      }

      const data = await res.json();
      if (data.ok) {
        setCampaigns(data.data.campaigns || []);
        if (data.data.campaigns && data.data.campaigns.length > 0 && !selectedCampaign) {
          setSelectedCampaign(data.data.campaigns[0].id);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignDetail = async (campaignId: string) => {
    try {
      setLoadingDetail(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      const res = await fetch(`/api/studio/campaigns/${campaignId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load campaign details");
      }

      const data = await res.json();
      if (data.ok) {
        setCampaignDetail(data.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load campaign details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddCampaign = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      setError("Name, start date, and end date are required");
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

      const res = await fetch("/api/studio/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          objective: formData.objective || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create campaign");
      }

      // Reset form and reload
      setFormData({ name: "", description: "", objective: "", start_date: "", end_date: "" });
      setShowAddForm(false);
      await loadCampaigns();
    } catch (err: any) {
      setError(err.message || "Failed to create campaign");
    } finally {
      setAdding(false);
    }
  };

  const handlePlanForCampaign = async (campaignId: string) => {
    if (!campaignDetail) return;

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        return;
      }

      // Calculate next Monday within campaign dates
      const campaignStart = new Date(campaignDetail.campaign.start_date);
      const campaignEnd = new Date(campaignDetail.campaign.end_date);
      const today = new Date();
      
      // Use campaign start if in future, otherwise use next Monday
      let weekStart = campaignStart > today ? campaignStart : today;
      
      // Find next Monday
      const daysUntilMonday = (8 - weekStart.getDay()) % 7 || 7;
      weekStart.setDate(weekStart.getDate() + daysUntilMonday);

      if (weekStart > campaignEnd) {
        alert("No valid week found within campaign dates");
        return;
      }

      const res = await fetch("/api/studio/plans/weekly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          week_start: weekStart.toISOString(),
          campaign_id: campaignId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate plan");
      }

      alert("Weekly plan generated for campaign!");
      await loadCampaignDetail(campaignId);
    } catch (err: any) {
      setError(err.message || "Failed to generate plan");
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
            Campaigns
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Plan and track multi-week content campaigns with objectives and date ranges
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Campaign
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
          <h2 className="text-lg font-semibold mb-4">Create Campaign</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Objective</label>
              <input
                type="text"
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                placeholder="e.g., launch, awareness, promo"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date *</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date *</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAddCampaign}
                disabled={adding}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 text-sm font-medium"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Campaign"}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormData({ name: "", description: "", objective: "", start_date: "", end_date: "" });
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaigns List */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Campaigns
            </h2>
            {campaigns.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No campaigns yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.map((campaign) => {
                  const isSelected = selectedCampaign === campaign.id;
                  return (
                    <button
                      key={campaign.id}
                      onClick={() => setSelectedCampaign(campaign.id)}
                      className={`
                        w-full text-left p-3 rounded-lg border transition-colors
                        ${
                          isSelected
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700"
                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }
                      `}
                    >
                      <div className="font-medium mb-1">{campaign.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {format(parseISO(campaign.start_date), "MMM d")} -{" "}
                        {format(parseISO(campaign.end_date), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {campaign.post_count} posts
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Campaign Detail */}
        <div className="lg:col-span-2">
          {campaignDetail ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 space-y-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2">{campaignDetail.campaign.name}</h2>
                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <span>
                    {format(parseISO(campaignDetail.campaign.start_date), "MMM d, yyyy")} -{" "}
                    {format(parseISO(campaignDetail.campaign.end_date), "MMM d, yyyy")}
                  </span>
                  {campaignDetail.campaign.objective && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{campaignDetail.campaign.objective}</span>
                    </>
                  )}
                </div>
                {campaignDetail.campaign.description && (
                  <p className="mt-2 text-slate-700 dark:text-slate-300">
                    {campaignDetail.campaign.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePlanForCampaign(campaignDetail.campaign.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  Plan Content for Campaign
                </button>
                <button
                  onClick={() => router.push(`/studio/calendar?campaign=${campaignDetail.campaign.id}`)}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium"
                >
                  <Calendar className="w-4 h-4" />
                  View in Calendar
                </button>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Campaign Posts ({campaignDetail.posts.length})</h3>
                {campaignDetail.posts.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No posts yet. Use &quot;Plan Content for Campaign&quot; to generate posts.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {campaignDetail.posts.map((post) => (
                      <div
                        key={post.id}
                        className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium capitalize">{post.platform}</span>
                            <span className="text-xs text-slate-500 capitalize">{post.status}</span>
                            {post.predicted_score_label && (
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  post.predicted_score_label === "high"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                    : post.predicted_score_label === "medium"
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                }`}
                              >
                                {post.predicted_score_label}
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
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="text-lg font-semibold mb-2">No Campaign Selected</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select a campaign from the list to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

