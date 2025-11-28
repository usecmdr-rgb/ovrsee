"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  purpose: string | null;
  purpose_details: string | null;
  script_style: string | null;
  status: string;
  timezone: string;
  allowed_call_start_time: string;
  allowed_call_end_time: string;
  allowed_days_of_week: string[];
  progress: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    percentage: number;
  };
  timeWindowSummary: string;
  timeWindowStatus: {
    isWithinWindow: boolean;
    reason?: string;
    nextWindowOpens?: string;
  };
  created_at: string;
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslation();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/campaigns");
      if (!response.ok) {
        throw new Error("Failed to fetch campaigns");
      }
      const data = await response.json();
      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (campaignId: string, action: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || data.error || "Action failed");
        return;
      }

      // Refresh campaigns
      fetchCampaigns();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "paused":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "canceled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "cold_call":
        return "Cold Call";
      case "feedback":
        return "Feedback";
      case "appointment_reminder":
        return "Appointment Reminder";
      default:
        return type;
    }
  };

  const getPurposeLabel = (purpose: string | null) => {
    if (!purpose) return null;
    const purposeLabels: Record<string, string> = {
      lead_generation_sales: "Lead Generation / Sales",
      feedback_satisfaction: "Feedback & Satisfaction",
      appointment_management: "Appointment Management",
      order_project_updates: "Order / Project Updates",
      administrative_operations: "Administrative Operations",
      loyalty_relationship: "Loyalty & Relationship",
      urgent_notifications: "Urgent Notifications",
      custom: "Custom",
    };
    return purposeLabels[purpose] || purpose;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">{t("loadingCampaigns")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-500">{t("alohaAgent")}</p>
          <h1 className="text-3xl font-semibold">{t("callCampaigns")}</h1>
        </div>
        <Link
          href="/aloha/campaigns/new"
          className="px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
        >
          {t("createCampaign")}
        </Link>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-slate-500 mb-4">{t("noCampaignsYet")}</p>
          <Link
            href="/aloha/campaigns/new"
            className="inline-block px-4 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
          >
            {t("createYourFirstCampaign")}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{campaign.name}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                        campaign.status
                      )}`}
                    >
                      {campaign.status}
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {getTypeLabel(campaign.type)}
                    </span>
                    {campaign.purpose && (
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {getPurposeLabel(campaign.purpose)}
                      </span>
                    )}
                  </div>
                  {campaign.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                      {campaign.description}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mb-2">
                    {campaign.timeWindowSummary}
                  </p>
                  {!campaign.timeWindowStatus.isWithinWindow && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      ⚠️ {campaign.timeWindowStatus.reason}
                      {campaign.timeWindowStatus.nextWindowOpens && (
                        <span className="ml-1">
                          ({campaign.timeWindowStatus.nextWindowOpens})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600 dark:text-slate-300">{t("progress")}</span>
                  <span className="font-semibold">
                    {campaign.progress.completed} / {campaign.progress.total} (
                    {campaign.progress.percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                  <div
                    className="bg-brand-accent h-2 rounded-full transition-all"
                    style={{ width: `${campaign.progress.percentage}%` }}
                  />
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span>{t("pending")}: {campaign.progress.pending}</span>
                  <span>{t("completed")}: {campaign.progress.completed}</span>
                  {campaign.progress.failed > 0 && (
                    <span>{t("failed")}: {campaign.progress.failed}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {campaign.status === "draft" && (
                  <button
                    onClick={() => handleAction(campaign.id, "start")}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {t("start")}
                  </button>
                )}
                {campaign.status === "running" && (
                  <button
                    onClick={() => handleAction(campaign.id, "pause")}
                    className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    {t("pause")}
                  </button>
                )}
                {campaign.status === "paused" && (
                  <button
                    onClick={() => handleAction(campaign.id, "resume")}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    {t("resume")}
                  </button>
                )}
                {campaign.status !== "completed" && campaign.status !== "canceled" && (
                  <button
                    onClick={() => {
                      if (confirm(t("areYouSureCancelCampaign"))) {
                        handleAction(campaign.id, "cancel");
                      }
                    }}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    {t("cancel")}
                  </button>
                )}
                <Link
                  href={`/aloha/campaigns/${campaign.id}` as any}
                  className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {t("viewDetails")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
