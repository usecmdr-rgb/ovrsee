"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Loader2, Save, ChevronRight } from "lucide-react";
// Feature flag check moved to API call to avoid client-side process.env access

interface SyncPreferences {
  follow_up_threshold_days: number;
  default_meeting_duration_minutes: number;
  scheduling_time_window_days: number;
  prefers_auto_time_suggestions: boolean;
  tone_preset: "friendly" | "professional" | "direct" | "custom";
  tone_custom_instructions: string | null;
  follow_up_intensity: "light" | "normal" | "strong";
  auto_create_calendar_events: boolean;
  auto_create_tasks: boolean;
  auto_create_reminders: boolean;
  default_calendar_id: string;
  default_timezone: string;
}

const TONE_PRESETS = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "direct", label: "Direct & Concise" },
  { value: "custom", label: "Custom" },
];

const FOLLOW_UP_INTENSITIES = [
  { value: "light", label: "Light (soft nudges, longer gaps)" },
  { value: "normal", label: "Normal" },
  { value: "strong", label: "Strong (proactive, firmer language)" },
];

export default function SyncSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sequences, setSequences] = useState<any[]>([]);
  const [loadingSequences, setLoadingSequences] = useState(false);
  const [expandedSequenceId, setExpandedSequenceId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<SyncPreferences>({
    follow_up_threshold_days: 5,
    default_meeting_duration_minutes: 30,
    scheduling_time_window_days: 7,
    prefers_auto_time_suggestions: false,
    tone_preset: "professional",
    tone_custom_instructions: null,
    follow_up_intensity: "normal",
    auto_create_calendar_events: false,
    auto_create_tasks: false,
    auto_create_reminders: false,
    default_calendar_id: "primary",
    default_timezone: "America/New_York",
  });

  useEffect(() => {
    loadPreferences();
    checkFeatureFlagAndLoadSequences();
  }, []);

  const checkFeatureFlagAndLoadSequences = async () => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      // Check feature flag via API
      const res = await fetch("/api/sync/sequences", {
        method: "HEAD", // Just check if endpoint exists/is enabled
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok || res.status === 405) { // 405 = Method Not Allowed means endpoint exists
        loadSequences();
      }
    } catch (error) {
      // Silently fail - feature might not be enabled
      console.log("Sequences feature not available");
    }
  };

  const loadSequences = async () => {
    try {
      setLoadingSequences(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/sync/sequences", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setSequences(data.sequences || []);
      }
    } catch (error) {
      console.error("Error loading sequences:", error);
    } finally {
      setLoadingSequences(false);
    }
  };

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/settings/sync", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load sync preferences");
      }

      const data = await res.json();
      setPreferences(data);
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/settings/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(preferences),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save preferences");
      }

      alert("Settings saved successfully!");
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-700 pb-4">
        <h1 className="text-2xl font-semibold">Sync Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure how Sync handles emails, drafts, and follow-ups
        </p>
      </div>

      {/* Core Preferences */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Follow-Up & Scheduling</h2>
        
        <div>
          <label className="block text-sm font-semibold mb-1">
            Days before suggesting a follow-up
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="2"
              max="10"
              value={preferences.follow_up_threshold_days}
              onChange={(e) =>
                setPreferences({ ...preferences, follow_up_threshold_days: parseInt(e.target.value) })
              }
              className="flex-1"
            />
            <span className="text-sm font-semibold w-12 text-center">
              {preferences.follow_up_threshold_days}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Default Meeting Duration</label>
          <select
            value={preferences.default_meeting_duration_minutes}
            onChange={(e) =>
              setPreferences({ ...preferences, default_meeting_duration_minutes: parseInt(e.target.value) })
            }
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
          >
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">
            Suggest times within the next (days)
          </label>
          <select
            value={preferences.scheduling_time_window_days}
            onChange={(e) =>
              setPreferences({ ...preferences, scheduling_time_window_days: parseInt(e.target.value) })
            }
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={21}>21 days</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.prefers_auto_time_suggestions}
              onChange={(e) =>
                setPreferences({ ...preferences, prefers_auto_time_suggestions: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm">Suggest time slots in replies</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.auto_create_calendar_events}
              onChange={(e) =>
                setPreferences({ ...preferences, auto_create_calendar_events: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm">Automatically create calendar alerts after sending replies</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.auto_create_tasks}
              onChange={(e) =>
                setPreferences({ ...preferences, auto_create_tasks: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm">Automatically create tasks from emails</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences.auto_create_reminders}
              onChange={(e) =>
                setPreferences({ ...preferences, auto_create_reminders: e.target.checked })
              }
              className="rounded"
            />
            <span className="text-sm">Automatically create reminders from emails</span>
          </label>
        </div>
      </section>

      {/* AI Tone & Follow-Up Style */}
      <section className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
        <h2 className="text-lg font-semibold">AI Tone & Follow-Up Style</h2>

        <div>
          <label className="block text-sm font-semibold mb-1">Tone Preset</label>
          <select
            value={preferences.tone_preset}
            onChange={(e) =>
              setPreferences({ ...preferences, tone_preset: e.target.value as any })
            }
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
          >
            {TONE_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        {preferences.tone_preset === "custom" && (
          <div>
            <label className="block text-sm font-semibold mb-1">Custom Tone Instructions</label>
            <textarea
              value={preferences.tone_custom_instructions || ""}
              onChange={(e) =>
                setPreferences({ ...preferences, tone_custom_instructions: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
              rows={4}
              placeholder="Describe how you want Sync to write emails. For example: &apos;Use a warm but professional tone, avoid jargon, keep sentences short.&apos;"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold mb-1">Follow-Up Intensity</label>
          <select
            value={preferences.follow_up_intensity}
            onChange={(e) =>
              setPreferences({ ...preferences, follow_up_intensity: e.target.value as any })
            }
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
          >
            {FOLLOW_UP_INTENSITIES.map((intensity) => (
              <option key={intensity.value} value={intensity.value}>
                {intensity.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Follow-Up Sequences */}
      {sequences.length > 0 && (
        <section className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Follow-Up Sequences</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Multi-step follow-up sequences for leads
              </p>
            </div>
          </div>

          {loadingSequences ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            </div>
          ) : sequences.length === 0 ? (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No sequences configured yet. Sequences will appear here when created.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sequences.map((sequence) => (
                <div
                  key={sequence.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
                >
                  <button
                    onClick={() =>
                      setExpandedSequenceId(expandedSequenceId === sequence.id ? null : sequence.id)
                    }
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{sequence.name}</span>
                        {sequence.is_default && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            Default
                          </span>
                        )}
                      </div>
                      {sequence.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {sequence.description}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {sequence.step_count} step{sequence.step_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 text-slate-400 transition-transform ${
                        expandedSequenceId === sequence.id ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {expandedSequenceId === sequence.id && sequence.steps && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                      {sequence.steps.map((step: any) => (
                        <div
                          key={step.id}
                          className="flex items-start gap-3 p-2 rounded bg-slate-50 dark:bg-slate-800/60"
                        >
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold">
                            {step.step_order}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs">{step.label}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                                {step.intensity}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {step.days_after_last_activity} day{step.days_after_last_activity !== 1 ? "s" : ""} after last activity
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Save Button */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <button
          onClick={savePreferences}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}

