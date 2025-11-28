"use client";

import { useState, useEffect, useMemo } from "react";
import { mockCalls } from "@/lib/data";
import type { CallRecord } from "@/types";
import { useAgentStats, emptyAgentStats } from "@/hooks/useAgentStats";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import PreviewBanner from "@/components/agent/PreviewBanner";
import { AGENT_BY_ID } from "@/lib/config/agents";
import Link from "next/link";
import { 
  Phone, 
  Users, 
  TrendingUp, 
  MessageSquare, 
  Heart,
  Brain,
  Settings,
  BarChart3,
  Shield,
  Clock
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { UserPhoneNumber } from "@/types/database";

const appointments = [
  { title: "Discovery call", when: "Fri - 9:30 AM", with: "Maria Gomez" },
  { title: "Onboarding", when: "Tue - 1:00 PM", with: "Alex Chen" },
];

interface ContactMemoryStats {
  totalContacts: number;
  doNotCallCount: number;
  recentlyContacted: number;
  averageContactFrequency: number;
}

interface ConversationStats {
  intentAccuracy: number;
  sentimentDistribution: {
    happy: number;
    neutral: number;
    upset: number;
    angry: number;
  };
  avgConversationDuration: number;
  empathyUsed: number;
}

export default function AlohaPage() {
  const { hasAccess, isLoading: accessLoading } = useAgentAccess("aloha");
  const { stats, loading, error } = useAgentStats();
  const [contactStats, setContactStats] = useState<ContactMemoryStats | null>(null);
  const [conversationStats, setConversationStats] = useState<ConversationStats | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "calls" | "contacts" | "analytics">("overview");
  const [phoneNumber, setPhoneNumber] = useState<UserPhoneNumber | null>(null);
  const t = useTranslation();
  
  // Wait for access to be determined before showing stats to prevent flashing
  const isAccessReady = !accessLoading;
  
  // Use preview/mock data if user doesn't have access (only after access check is complete)
  const isPreview = isAccessReady && !hasAccess;
  
  // Fallback to realistic random numbers if no stats available or in preview mode
  // Only show fallback stats when access check is complete to prevent number flashing
  const fallbackStats = useMemo(() => {
    if (!isAccessReady) {
      // Return empty stats while loading to prevent flash
      return emptyAgentStats;
    }
    return {
      ...emptyAgentStats,
      alpha_calls_total: isPreview ? 156 : 247,
      alpha_calls_missed: isPreview ? 5 : 8,
      alpha_appointments: isPreview ? 18 : 32,
    };
  }, [isPreview, isAccessReady]);
  
  const latestStats = stats ?? fallbackStats;
  const answeredCalls = Math.max(latestStats.alpha_calls_total - latestStats.alpha_calls_missed, 0);
  const noStats = !stats && !loading && !error;
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(mockCalls[0]);

  const agentConfig = AGENT_BY_ID["aloha"];

  useEffect(() => {
    // Fetch contact memory stats
    if (hasAccess && !accessLoading) {
      fetchContactStats();
      fetchConversationStats();
      fetchPhoneNumber();
    }
  }, [hasAccess, accessLoading]);

  const fetchPhoneNumber = async () => {
    try {
      const response = await fetch("/api/telephony/twilio/active-number");
      if (response.ok) {
        const data = await response.json();
        if (data.ok && data.phoneNumber) {
          setPhoneNumber(data.phoneNumber);
        }
      }
    } catch (err) {
      console.error("Error fetching phone number:", err);
    }
  };

  const fetchContactStats = async () => {
    try {
      // TODO: Create API endpoint for contact stats
      // For now, use mock data
      setContactStats({
        totalContacts: 142,
        doNotCallCount: 8,
        recentlyContacted: 23,
        averageContactFrequency: 2.4,
      });
    } catch (err) {
      console.error("Error fetching contact stats:", err);
    }
  };

  const fetchConversationStats = async () => {
    try {
      // TODO: Create API endpoint for conversation stats
      // For now, use mock data
      setConversationStats({
        intentAccuracy: 94.2,
        sentimentDistribution: {
          happy: 45,
          neutral: 38,
          upset: 12,
          angry: 5,
        },
        avgConversationDuration: 245, // seconds
        empathyUsed: 17,
      });
    } catch (err) {
      console.error("Error fetching conversation stats:", err);
    }
  };

  return (
    <div className="space-y-8">
      {isPreview && (
        <PreviewBanner 
          agentName={agentConfig.label} 
          requiredTier={agentConfig.requiredTier}
        />
      )}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-500">{t("alohaAgent")}</p>
          <h1 className="text-3xl font-semibold">{t("callsAppointmentsOverview")}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/aloha/contacts"
            className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <Users className="w-4 h-4" />
            {t("alohaContacts")}
          </Link>
          <Link
            href="/aloha/settings"
            className="px-4 py-2 text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {t("alohaSettings")}
          </Link>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-brand-accent text-brand-accent"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {t("overview")}
          </button>
          <button
            onClick={() => setActiveTab("calls")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "calls"
                ? "border-brand-accent text-brand-accent"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {t("callTranscripts")}
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "contacts"
                ? "border-brand-accent text-brand-accent"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {t("contactMemory")}
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "analytics"
                ? "border-brand-accent text-brand-accent"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            {t("conversationIntelligence")}
          </button>
        </div>
        {(phoneNumber || isPreview) && (
          <p className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 font-mono">
            {isPreview ? "+1 (555) 123-4567" : phoneNumber?.phone_number}
          </p>
        )}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <>
          {/* Key Stats */}
          <section className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t("latestStats")}</p>
              {loading && <p className="text-xs text-slate-500">{t("loadingStats")}</p>}
              {error && <p className="text-xs text-red-500">{t("couldntLoadStats")}</p>}
              {noStats && <p className="text-xs text-slate-500">{t("noStatsYet")}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: t("totalCalls"), value: latestStats.alpha_calls_total, icon: Phone },
                { label: t("answered"), value: answeredCalls, icon: MessageSquare },
                { label: t("missed"), value: latestStats.alpha_calls_missed, icon: Phone },
                { label: t("newAppointmentsLabel"), value: latestStats.alpha_appointments, icon: Clock },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon className="w-4 h-4 text-slate-500" />
                    <p className="text-xs uppercase tracking-widest text-slate-500">{item.label}</p>
                  </div>
                  <p className="mt-2 text-2xl">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Feature Highlights */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Contact Memory Card */}
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{t("alohaContactMemoryTitle")}</h3>
                  <p className="text-xs text-slate-500">{t("alohaLightweightPerPhoneMemory")}</p>
                </div>
              </div>
              {contactStats ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{t("alohaTotalContacts")}</span>
                    <span className="text-lg font-semibold">{contactStats.totalContacts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{t("alohaDoNotCall")}</span>
                    <span className="text-lg font-semibold text-red-600">{contactStats.doNotCallCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{t("alohaRecentlyContacted")}</span>
                    <span className="text-lg font-semibold">{contactStats.recentlyContacted}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("alohaLoadingContactStats")}</p>
              )}
              <Link
                href="/aloha/contacts"
                className="mt-4 inline-block text-sm text-brand-accent hover:underline"
              >
                {t("alohaViewAllContacts")}
              </Link>
            </div>

            {/* Conversation Intelligence Card */}
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{t("alohaConversationIntelligence")}</h3>
                  <p className="text-xs text-slate-500">{t("alohaConversationIntelligenceDescription")}</p>
                </div>
              </div>
              {conversationStats ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{t("alohaIntentClassificationAccuracy")}</span>
                    <span className="text-lg font-semibold">{conversationStats.intentAccuracy}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{t("alohaEmpathyUsed")}</span>
                    <span className="text-lg font-semibold">{conversationStats.empathyUsed} calls</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{t("alohaAverageConversationDuration")}</span>
                    <span className="text-lg font-semibold">{Math.floor(conversationStats.avgConversationDuration / 60)}m</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("alohaLoadingConversationStats")}</p>
              )}
              <Link
                href="/aloha?tab=analytics"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab("analytics");
                }}
                className="mt-4 inline-block text-sm text-brand-accent hover:underline"
              >
                {t("alohaViewAnalytics")}
              </Link>
            </div>

            {/* Voice Dynamics Card */}
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{t("alohaNaturalVoiceDynamics")}</h3>
                  <p className="text-xs text-slate-500">{t("alohaHumanLikePauses")}</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {t("alohaMicroPauses")}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {t("alohaContextAwareDisfluencies")}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {t("alohaEmotionAwareAdjustments")}
                </li>
              </ul>
            </div>

            {/* Communication Resilience Card */}
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Shield className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{t("alohaCommunicationResilience")}</h3>
                  <p className="text-xs text-slate-500">{t("alohaHandlesConnectionIssues")}</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                  {t("alohaBadConnectionDetection")}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                  {t("alohaSilenceHandling")}
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                  {t("alohaTalkativeCallerManagement")}
                </li>
              </ul>
            </div>
          </div>
        </>
      )}

      {/* Calls Tab */}
      {activeTab === "calls" && (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Call transcripts</h2>
              <p className="text-sm text-slate-500">Click to inspect</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">{t("alohaCaller")}</th>
                    <th className="py-2">{t("alohaTime")}</th>
                    <th className="py-2">{t("alohaOutcome")}</th>
                    <th className="py-2">{t("alohaSentiment")}</th>
                    <th className="py-2">{t("alohaSummary")}</th>
                  </tr>
                </thead>
                <tbody>
                  {mockCalls.map((call) => (
                    <tr
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className={`cursor-pointer border-t border-slate-100 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/60 ${
                        selectedCall?.id === call.id ? "bg-slate-100 dark:bg-slate-800/80" : ""
                      }`}
                    >
                      <td className="py-3 font-semibold">{call.caller}</td>
                      <td className="py-3">{call.time}</td>
                      <td className="py-3 capitalize">{call.outcome}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {t("alohaNeutral")}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">{call.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
              <h3 className="text-lg font-semibold mb-3">{t("callDetails")}</h3>
              {selectedCall ? (
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    <span className="font-semibold">{t("alohaCaller")}:</span> {selectedCall.caller}
                  </p>
                  <p>
                    <span className="font-semibold">{t("alohaOutcome")}:</span> {selectedCall.outcome}
                  </p>
                  <div>
                    <span className="font-semibold">{t("alohaIntentClassification")}:</span>
                    <div className="mt-1 space-y-1">
                      <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Question: Services
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold">{t("alohaEmotionalState")}:</span>
                    <div className="mt-1">
                      <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {t("alohaNeutral")}
                      </span>
                    </div>
                  </div>
                  <p>
                    <span className="font-semibold">{t("alohaSummary")}:</span> {selectedCall.summary}
                  </p>
                  <p>
                    <span className="font-semibold">{t("contact")}:</span> {selectedCall.contact}
                  </p>
                  {selectedCall.appointmentLink && (
                    <a href={selectedCall.appointmentLink} className="text-brand-accent underline">
                      {t("alohaViewAppointment")}
                    </a>
                  )}
                  <div className="rounded-2xl bg-slate-100/70 p-3 dark:bg-slate-800/60">
                    <p className="text-xs font-semibold mb-1">Transcript:</p>
                    <p className="text-xs">{selectedCall.transcript}</p>
                  </div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {t("followUp")}: {selectedCall.followUp}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("alohaSelectCallToInspect")}</p>
              )}
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
              <h3 className="text-lg font-semibold mb-3">{t("upcomingAppointments")}</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                {appointments.map((appt) => (
                  <li key={appt.title} className="rounded-2xl border border-slate-100 p-3 dark:border-slate-800">
                    <p className="font-semibold">{appt.title}</p>
                    <p>{appt.when}</p>
                    <p className="text-slate-500">with {appt.with}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === "contacts" && (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Contact Memory</h2>
            <Link
              href="/aloha/contacts"
              className="px-4 py-2 text-sm bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors"
            >
              Manage Contacts
            </Link>
          </div>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            Aloha remembers basic information about callers to provide personalized, context-aware conversations.
          </p>
          {contactStats ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Total Contacts</p>
                <p className="text-2xl font-semibold">{contactStats.totalContacts}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Do-Not-Call</p>
                <p className="text-2xl font-semibold text-red-600">{contactStats.doNotCallCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Recently Contacted</p>
                <p className="text-2xl font-semibold">{contactStats.recentlyContacted}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Avg Frequency</p>
                <p className="text-2xl font-semibold">{contactStats.averageContactFrequency}x</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading contact statistics...</p>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {conversationStats ? (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
                  <h3 className="text-lg font-semibold mb-4">{t("alohaSentimentDistribution")}</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{t("alohaHappy")}</span>
                        <span>{conversationStats.sentimentDistribution.happy}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${conversationStats.sentimentDistribution.happy}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{t("alohaNeutral")}</span>
                        <span>{conversationStats.sentimentDistribution.neutral}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                        <div className="bg-slate-400 h-2 rounded-full" style={{ width: `${conversationStats.sentimentDistribution.neutral}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{t("alohaUpset")}</span>
                        <span>{conversationStats.sentimentDistribution.upset}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${conversationStats.sentimentDistribution.upset}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{t("alohaAngry")}</span>
                        <span>{conversationStats.sentimentDistribution.angry}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 dark:bg-slate-700">
                        <div className="bg-red-500 h-2 rounded-full" style={{ width: `${conversationStats.sentimentDistribution.angry}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
                  <h3 className="text-lg font-semibold mb-4">{t("alohaConversationMetrics")}</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">{t("alohaIntentClassificationAccuracy")}</p>
                      <p className="text-3xl font-semibold">{conversationStats.intentAccuracy}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">{t("alohaAverageConversationDuration")}</p>
                      <p className="text-3xl font-semibold">{Math.floor(conversationStats.avgConversationDuration / 60)}m {conversationStats.avgConversationDuration % 60}s</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">{t("alohaEmpathyUsed")}</p>
                      <p className="text-3xl font-semibold">{conversationStats.empathyUsed} calls</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">{t("alohaLoadingConversationAnalytics")}</p>
          )}
        </div>
      )}
    </div>
  );
}
