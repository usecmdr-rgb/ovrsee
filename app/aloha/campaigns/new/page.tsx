"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";
import { getAllPurposes, type CampaignPurpose, type ScriptStyle } from "@/lib/aloha/campaign-purposes";

type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type CampaignType = "cold_call" | "feedback" | "appointment_reminder";

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: "mon", label: "Monday" },
  { value: "tue", label: "Tuesday" },
  { value: "wed", label: "Wednesday" },
  { value: "thu", label: "Thursday" },
  { value: "fri", label: "Friday" },
  { value: "sat", label: "Saturday" },
  { value: "sun", label: "Sunday" },
];

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export default function NewCampaignPage() {
  const router = useRouter();
  const t = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CampaignType>("cold_call");
  const [purpose, setPurpose] = useState<CampaignPurpose | "">("");
  const [purposeDetails, setPurposeDetails] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [scriptStyle, setScriptStyle] = useState<ScriptStyle>("professional");
  const [phoneNumbers, setPhoneNumbers] = useState("");
  const [scriptPreview, setScriptPreview] = useState<any>(null);
  const [showScriptPreview, setShowScriptPreview] = useState(false);

  // Time window settings
  const [timezone, setTimezone] = useState("America/New_York");
  const [allowedDays, setAllowedDays] = useState<DayOfWeek[]>([
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const toggleDay = (day: DayOfWeek) => {
    setAllowedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Update script style when purpose changes
  useEffect(() => {
    if (purpose) {
      const purposeDef = getAllPurposes().find((p) => p.id === purpose);
      if (purposeDef) {
        setScriptStyle(purposeDef.defaultScriptStyle);
      }
    }
  }, [purpose]);

  // Generate script preview
  const handleGeneratePreview = async () => {
    if (!purpose) {
      alert("Please select a campaign purpose first");
      return;
    }

    try {
      // Create a temporary campaign to generate preview
      // In production, this would call the script preview API
      const response = await fetch("/api/campaigns/preview-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          purposeDetails: purposeDetails || undefined,
          extraInstructions: extraInstructions || undefined,
          scriptStyle,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setScriptPreview(data.script);
        setShowScriptPreview(true);
      } else {
        alert("Failed to generate script preview");
      }
    } catch (error) {
      console.error("Error generating preview:", error);
      alert("Failed to generate script preview");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate purpose_details for required purposes
      if (purpose) {
        const purposeDef = getAllPurposes().find((p) => p.id === purpose);
        if (purposeDef?.requiresPurposeDetails && !purposeDetails.trim()) {
          setError(`Campaign message is required for ${purposeDef.label} campaigns. Please describe what Aloha should tell these contacts.`);
          setLoading(false);
          return;
        }
      }

      // Parse phone numbers
      const phoneArray = phoneNumbers
        .split(/[\n,]/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      if (phoneArray.length === 0) {
        setError("Please provide at least one phone number");
        setLoading(false);
        return;
      }

      // Format time for database (HH:MM:SS)
      const formatTime = (time: string) => {
        const [hours, minutes] = time.split(":");
        return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
      };

      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          type,
          purpose: purpose || null,
          purposeDetails: purposeDetails || null,
          extraInstructions: extraInstructions || null,
          scriptStyle: scriptStyle || null,
          phoneNumbers: phoneArray,
          timezone,
          allowedCallStartTime: formatTime(startTime),
          allowedCallEndTime: formatTime(endTime),
          allowedDaysOfWeek: allowedDays,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to create campaign");
      }

      // Redirect to campaigns list
      router.push("/aloha/campaigns");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <Link
          href="/aloha/campaigns"
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4 inline-block"
        >
          ← Back to Campaigns
        </Link>
        <p className="text-sm uppercase tracking-widest text-slate-500">Aloha Agent</p>
        <h1 className="text-3xl font-semibold">Create Call Campaign</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2">
          Campaigns will only run when you explicitly start them and will respect your time window settings.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold mb-4">Campaign Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Campaign Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
                placeholder="Q1 Outreach Campaign"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
                placeholder="Optional description of this campaign"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Campaign Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CampaignType)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="cold_call">Cold Call</option>
                <option value="feedback">Feedback Collection</option>
                <option value="appointment_reminder">Appointment Reminder</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Legacy type field (for backward compatibility). Use Purpose below for new campaigns.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Campaign Purpose *</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as CampaignPurpose)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Select a purpose...</option>
                {getAllPurposes().map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {purpose && (
                <p className="text-xs text-slate-500 mt-1">
                  {getAllPurposes().find((p) => p.id === purpose)?.description}
                </p>
              )}
            </div>
            {/* Campaign Message - Required for urgent/custom, recommended for others */}
            {purpose && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  What should Aloha tell these contacts?{" "}
                  {getAllPurposes().find((p) => p.id === purpose)?.requiresPurposeDetails ? (
                    <span className="text-red-500">*</span>
                  ) : (
                    <span className="text-slate-500 text-xs">(Recommended)</span>
                  )}
                </label>
                <textarea
                  value={purposeDetails}
                  onChange={(e) => setPurposeDetails(e.target.value)}
                  required={getAllPurposes().find((p) => p.id === purpose)?.requiresPurposeDetails || false}
                  rows={5}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
                  placeholder="Describe what Aloha should tell these contacts and how it should behave during the calls..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  {getAllPurposes().find((p) => p.id === purpose)?.requiresPurposeDetails
                    ? "Required: This is the exact message Aloha will deliver. Be specific and clear."
                    : "Recommended: Provide specific instructions for what Aloha should tell contacts. This helps Aloha deliver the right message."}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-2">Script Style</label>
              <select
                value={scriptStyle}
                onChange={(e) => setScriptStyle(e.target.value as ScriptStyle)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="energetic">Energetic</option>
                <option value="calm">Calm</option>
                <option value="casual">Casual</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                The tone Aloha will use during calls. Default is set based on campaign purpose.
              </p>
            </div>
            {purpose && (
              <div>
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                >
                  Preview Behavior
                </button>
                <p className="text-xs text-slate-500 mt-1">
                  Preview how Aloha will behave. The actual script is generated internally and not directly editable.
                </p>
              </div>
            )}
            {showScriptPreview && scriptPreview && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-4">
                <h3 className="font-semibold mb-2">Behavior Preview</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 italic">
                  <strong>Note:</strong> This is a preview of how Aloha will behave. The base script is generated internally from your campaign purpose and message. You cannot edit the base script directly, but you can influence Aloha&apos;s behavior with additional instructions above. For the best experience, use the &quot;Test Call&quot; feature after creating the campaign to hear Aloha in action.
                </p>
                <div className="space-y-3 text-sm">
                  <div>
                    <strong>Introduction:</strong>
                    <p className="text-slate-700 dark:text-slate-300 mt-1">{scriptPreview.intro}</p>
                  </div>
                  {scriptPreview.keyPoints && scriptPreview.keyPoints.length > 0 && (
                    <div>
                      <strong>Key Points:</strong>
                      <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 mt-1">
                        {scriptPreview.keyPoints.map((point: string, idx: number) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {scriptPreview.questions && scriptPreview.questions.length > 0 && (
                    <div>
                      <strong>Questions:</strong>
                      <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 mt-1">
                        {scriptPreview.questions.map((q: string, idx: number) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <strong>Closing:</strong>
                    <p className="text-slate-700 dark:text-slate-300 mt-1">{scriptPreview.closing}</p>
                  </div>
                  <div>
                    <strong>Tone:</strong> {scriptPreview.tone}
                  </div>
                  {extraInstructions && (
                    <div>
                      <strong>Additional Instructions Applied:</strong>
                      <p className="text-slate-700 dark:text-slate-300 mt-1 italic">{extraInstructions}</p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowScriptPreview(false)}
                  className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Hide Preview
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Phone Numbers */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold mb-4">Phone Numbers</h2>
          <div>
            <label className="block text-sm font-medium mb-2">
              Phone Numbers * (one per line or comma-separated)
            </label>
            <textarea
              value={phoneNumbers}
              onChange={(e) => setPhoneNumbers(e.target.value)}
              required
              rows={8}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
              placeholder="+1 (555) 123-4567&#10;+1 (555) 234-5678&#10;+1 (555) 345-6789"
            />
            <p className="text-xs text-slate-500 mt-2">
              Enter phone numbers in E.164 format (e.g., +1234567890) or any format. One per line or comma-separated.
            </p>
          </div>
        </div>

        {/* Time Window Settings */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold mb-4">Call Time Window</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Calls will <strong>only</strong> be placed within this time window. This ensures compliance and respects recipient preferences.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Timezone *</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Allowed Days of Week *</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      allowedDays.includes(day.value)
                        ? "bg-brand-accent text-white"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {allowedDays.length === 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  Please select at least one day
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Time *</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Time *</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
              <strong>Time Window Summary:</strong> Calls will be allowed on{" "}
              {allowedDays.map((d) => DAYS.find((day) => day.value === d)?.label).join(", ")}{" "}
              between {startTime} and {endTime} ({timezone.replace("_", " ")}).
            </div>
          </div>
        </div>

        {/* Additional Instructions */}
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold mb-4">Additional Instructions for Aloha (Optional)</h2>
          <textarea
            value={extraInstructions}
            onChange={(e) => setExtraInstructions(e.target.value)}
            rows={5}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800"
            placeholder={
              purpose === "urgent_notifications"
                ? t("campaignInstructionsPlaceholderUrgent")
                : purpose === "feedback_satisfaction"
                ? t("campaignInstructionsPlaceholderFeedback")
                : purpose === "lead_generation_sales"
                ? t("campaignInstructionsPlaceholderLead")
                : t("campaignInstructionsPlaceholderUrgent")
            }
          />
          <p className="text-xs text-slate-500 mt-2">
            {t("campaignInstructionsDescription")}
          </p>
          <p className="text-xs text-slate-400 mt-1 italic">
            {t("campaignInstructionsNote")}
          </p>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={loading || allowedDays.length === 0}
            className="px-6 py-3 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create Campaign"}
          </button>
          <Link
            href="/aloha/campaigns"
            className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

