"use client";

import { useState } from "react";
import { mockCalls } from "@/lib/data";
import type { CallRecord } from "@/types";
import { useAgentStats, emptyAgentStats } from "@/hooks/useAgentStats";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import PreviewBanner from "@/components/agent/PreviewBanner";
import { AGENT_BY_ID } from "@/lib/config/agents";

const appointments = [
  { title: "Discovery call", when: "Fri - 9:30 AM", with: "Maria Gomez" },
  { title: "Onboarding", when: "Tue - 1:00 PM", with: "Alex Chen" },
];

export default function AlohaPage() {
  const { hasAccess, isLoading: accessLoading } = useAgentAccess("aloha");
  const { stats, loading, error } = useAgentStats();
  
  // Use preview/mock data if user doesn't have access
  const isPreview = !hasAccess && !accessLoading;
  
  // Fallback to realistic random numbers if no stats available or in preview mode
  const fallbackStats = {
    ...emptyAgentStats,
    alpha_calls_total: isPreview ? 156 : 247,
    alpha_calls_missed: isPreview ? 5 : 8,
    alpha_appointments: isPreview ? 18 : 32,
  };
  const latestStats = stats ?? fallbackStats;
  const answeredCalls = Math.max(latestStats.alpha_calls_total - latestStats.alpha_calls_missed, 0);
  const noStats = !stats && !loading && !error;
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(mockCalls[0]);

  const agentConfig = AGENT_BY_ID["aloha"];

  return (
    <div className="space-y-8">
      {isPreview && (
        <PreviewBanner 
          agentName={agentConfig.label} 
          requiredTier={agentConfig.requiredTier}
        />
      )}
      <header>
        <p className="text-sm uppercase tracking-widest text-slate-500">Aloha agent</p>
        <h1 className="text-3xl font-semibold">Calls & appointments overview</h1>
      </header>
      <section className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Latest stats</p>
          {loading && <p className="text-xs text-slate-500">Loading stats…</p>}
          {error && <p className="text-xs text-red-500">Couldn&apos;t load stats</p>}
          {noStats && <p className="text-xs text-slate-500">No stats yet</p>}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[{ label: "Total calls", value: latestStats.alpha_calls_total }, { label: "Answered", value: answeredCalls }, { label: "Missed", value: latestStats.alpha_calls_missed }, { label: "New appointments", value: latestStats.alpha_appointments }].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-xs uppercase tracking-widest text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Call transcripts</h2>
            <p className="text-sm text-slate-500">Click to inspect</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Caller</th>
                  <th className="py-2">Time</th>
                  <th className="py-2">Outcome</th>
                  <th className="py-2">Summary</th>
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
                    <td className="py-3 text-slate-500">{call.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <h3 className="text-lg font-semibold">Call details</h3>
            {selectedCall ? (
              <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>
                  <span className="font-semibold">Caller:</span> {selectedCall.caller}
                </p>
                <p>
                  <span className="font-semibold">Outcome:</span> {selectedCall.outcome}
                </p>
                <p>
                  <span className="font-semibold">Summary:</span> {selectedCall.summary}
                </p>
                <p>
                  <span className="font-semibold">Contact:</span> {selectedCall.contact}
                </p>
                {selectedCall.appointmentLink && (
                  <a href={selectedCall.appointmentLink} className="text-brand-accent underline">
                    View appointment
                  </a>
                )}
                <p className="rounded-2xl bg-slate-100/70 p-3 dark:bg-slate-800/60">
                  {selectedCall.transcript}
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Follow up: {selectedCall.followUp}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a call to inspect the transcript.</p>
            )}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <h3 className="text-lg font-semibold">Upcoming appointments</h3>
            <ul className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-300">
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
    </div>
  );
}




