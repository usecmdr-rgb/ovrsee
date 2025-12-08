"use client";

import { FormEvent, useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { useAppState } from "@/context/AppStateContext";
import { useSupabase } from "@/components/SupabaseProvider";
import { useTranslation } from "@/hooks/useTranslation";

// Timezone options
const TIMEZONE_OPTIONS = [
  { value: "EST", label: "Eastern Time (EST/EDT)" },
  { value: "CST", label: "Central Time (CST/CDT)" },
  { value: "MST", label: "Mountain Time (MST/MDT)" },
  { value: "PST", label: "Pacific Time (PST/PDT)" },
  { value: "AKST", label: "Alaska Time (AKST/AKDT)" },
  { value: "HST", label: "Hawaii Time (HST)" },
  { value: "GMT", label: "Greenwich Mean Time (GMT)" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)" },
  { value: "CET", label: "Central European Time (CET/CEST)" },
  { value: "EET", label: "Eastern European Time (EET/EEST)" },
  { value: "IST", label: "India Standard Time (IST)" },
  { value: "JST", label: "Japan Standard Time (JST)" },
  { value: "AEST", label: "Australian Eastern Time (AEST/AEDT)" },
  { value: "NZST", label: "New Zealand Time (NZST/NZDT)" },
];

// Operating days options
const OPERATING_DAYS_OPTIONS = [
  { value: "24/7", label: "24/7 - Always Open" },
  { value: "Mon-Fri", label: "Monday - Friday" },
  { value: "Mon-Sat", label: "Monday - Saturday" },
  { value: "Mon-Sun", label: "Monday - Sunday" },
  { value: "Tue-Sat", label: "Tuesday - Saturday" },
  { value: "Wed-Sun", label: "Wednesday - Sunday" },
  { value: "Sat-Sun", label: "Saturday - Sunday" },
  { value: "Custom", label: "Custom Days (specify in notes)" },
];

// Operating times options
const OPERATING_TIMES_OPTIONS = [
  { value: "", label: "Select time range" },
  { value: "6am-6pm", label: "6:00 AM - 6:00 PM" },
  { value: "7am-7pm", label: "7:00 AM - 7:00 PM" },
  { value: "8am-5pm", label: "8:00 AM - 5:00 PM" },
  { value: "8am-6pm", label: "8:00 AM - 6:00 PM" },
  { value: "9am-5pm", label: "9:00 AM - 5:00 PM" },
  { value: "9am-6pm", label: "9:00 AM - 6:00 PM" },
  { value: "9am-9pm", label: "9:00 AM - 9:00 PM" },
  { value: "10am-6pm", label: "10:00 AM - 6:00 PM" },
  { value: "10am-8pm", label: "10:00 AM - 8:00 PM" },
  { value: "11am-7pm", label: "11:00 AM - 7:00 PM" },
  { value: "12pm-8pm", label: "12:00 PM - 8:00 PM" },
  { value: "Custom", label: "Custom Times (specify in notes)" },
];

const BusinessInfoModal = () => {
  const { showBusinessModal, setShowBusinessModal, businessInfo, updateBusinessInfo } = useAppState();
  const { supabase } = useSupabase();
  const t = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operatingDays, setOperatingDays] = useState<string>("");
  const [operatingTimes, setOperatingTimes] = useState<string>("");

  // Helper function to parse operating hours into days and times
  const parseOperatingHours = (hours: string): { days: string; times: string } => {
    if (!hours || hours === "") {
      return { days: "", times: "" };
    }
    
    const hoursLower = hours.toLowerCase().trim();
    
    if (hoursLower === "24/7" || hoursLower.includes("24/7") || hoursLower === "always open") {
      return { days: "24/7", times: "" };
    }
    
    if (hoursLower.includes("custom")) {
      return { days: "Custom", times: "Custom" };
    }
    
    // Try to parse "Mon-Fri 9am-5pm" format
    const daysPattern = /^(Mon-Fri|Mon-Sat|Mon-Sun|Tue-Sat|Wed-Sun|Sat-Sun)/i;
    const daysMatch = hours.match(daysPattern);
    
    // Try to match time patterns like "9am-5pm", "9:00am-5:00pm", etc.
    const timesPattern = /(\d{1,2}(?::\d{2})?(am|pm)-\d{1,2}(?::\d{2})?(am|pm))/i;
    const timesMatch = hours.match(timesPattern);
    
    // Normalize time format (remove colons and convert to lowercase for matching)
    let normalizedTime = "";
    if (timesMatch) {
      const timeStr = timesMatch[1].toLowerCase();
      // Convert "9:00am-5:00pm" to "9am-5pm" format
      normalizedTime = timeStr.replace(/:/g, "").replace(/(\d{1,2})(am|pm)/g, "$1$2");
    }
    
    return {
      days: daysMatch ? daysMatch[1] : "",
      times: normalizedTime || "",
    };
  };

  // Helper function to combine days and times into operating hours string
  const combineOperatingHours = (days: string, times: string): string => {
    if (days === "24/7") {
      return "24/7";
    }
    
    if (days === "Custom" || times === "Custom") {
      return "Custom";
    }
    
    if (!days || !times) {
      return "";
    }
    
    return `${days} ${times}`;
  };
  
  const fields = [
    { id: "fullName", label: "Your Full Name", placeholder: "John Doe", type: "text" },
    { id: "businessName", label: t("businessNameLabel"), placeholder: t("placeholderCompany"), type: "text" },
    { id: "businessType", label: t("businessTypeLabel"), placeholder: t("businessTypePlaceholder"), type: "text" },
    { id: "location", label: t("locationLabel"), placeholder: t("locationPlaceholder"), type: "text" },
    { id: "serviceName", label: t("serviceNameLabel"), placeholder: t("serviceNamePlaceholder"), type: "text" },
    { id: "website", label: t("websiteLabel"), placeholder: t("websitePlaceholder"), type: "text" },
    { id: "contactEmail", label: t("contactEmailLabel"), placeholder: t("contactEmailPlaceholder"), type: "email" },
    { id: "contactPhone", label: t("contactPhoneLabel"), placeholder: t("contactPhonePlaceholder"), type: "tel" },
    { id: "language", label: t("preferredLanguageLabel"), placeholder: t("preferredLanguagePlaceholder"), type: "text" },
  ];

  const loadBusinessProfile = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return;

      const response = await fetch("/api/business-profile");
      if (response.ok) {
        const data = await response.json();
        if (data.profile) {
          // Parse operating hours into days and times
          const parsedHours = parseOperatingHours(data.profile.hours || "");
          setOperatingDays(parsedHours.days);
          setOperatingTimes(parsedHours.times);
          
          // Update local state with profile data
          updateBusinessInfo({
            fullName: data.profile.fullName || "",
            businessName: data.profile.businessName || "",
            businessType: data.profile.industry || "",
            location: data.profile.location || "",
            operatingHours: data.profile.hours || "",
            serviceName: data.profile.serviceName || "",
            website: data.profile.website || "",
            contactEmail: data.profile.contactEmail || "",
            contactPhone: data.profile.contactPhone || "",
            language: data.profile.language || "English",
            timezone: data.profile.timezone || "EST",
            notes: data.profile.notes || "",
            services: typeof data.profile.services === "string" 
              ? data.profile.services 
              : Array.isArray(data.profile.services)
              ? data.profile.services.join("\n")
              : "",
          });

        }
      }
    } catch (err) {
      console.error("Error loading business profile:", err);
    }
  }, [supabase, updateBusinessInfo, t]);

  // Load existing business profile when modal opens
  useEffect(() => {
    if (showBusinessModal) {
      loadBusinessProfile();
    } else {
      // Reset operating days and times when modal closes
      setOperatingDays("");
      setOperatingTimes("");
    }
  }, [showBusinessModal, loadBusinessProfile]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setError(t("businessInfoPleaseLogin"));
        setLoading(false);
        return;
      }

      // Combine operating days and times before saving
      const combinedOperatingHours = combineOperatingHours(operatingDays, operatingTimes);
      
      const response = await fetch("/api/business-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...businessInfo,
          operatingHours: combinedOperatingHours,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("businessInfoFailedToSave"));
      }

      setShowBusinessModal(false);
      // Mark as shown so it doesn't appear again
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cx-business-modal-shown", "true");
      }
    } catch (err: any) {
      setError(err.message || t("businessInfoFailedToSave"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t("businessInfoModalTitle")}
      description={t("businessInfoModalDescription")}
      open={showBusinessModal}
      onClose={() => {
        setShowBusinessModal(false);
        // Mark as shown so it doesn't appear again
        if (typeof window !== "undefined") {
          window.localStorage.setItem("cx-business-modal-shown", "true");
        }
      }}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid gap-3 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.id}>
              <label htmlFor={`business-${field.id}`} className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {field.label}
              </label>
              <input
                id={`business-${field.id}`}
                type={field.type || "text"}
                value={(businessInfo as any)[field.id] ?? ""}
                onChange={(event) =>
                  updateBusinessInfo({ [field.id]: event.target.value } as any)
                }
                placeholder={field.placeholder}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "business-error" : undefined}
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          ))}
          
          {/* Operating Hours - Days and Times Combined */}
          <div className="md:col-span-2">
            <label htmlFor="business-operatingDays" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {t("operatingHoursLabel")}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <select
                id="business-operatingDays"
                value={operatingDays}
                onChange={(event) => {
                  const newDays = event.target.value;
                  setOperatingDays(newDays);
                  // If 24/7 is selected, clear times
                  if (newDays === "24/7") {
                    setOperatingTimes("");
                  }
                }}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "business-error" : undefined}
                disabled={loading}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select days</option>
                {OPERATING_DAYS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                id="business-operatingTimes"
                value={operatingTimes}
                onChange={(event) => setOperatingTimes(event.target.value)}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "business-error" : undefined}
                disabled={loading || operatingDays === "24/7"}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/20 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {operatingDays === "24/7" ? (
                  <option value="">24/7 - Times not applicable</option>
                ) : (
                  <>
                    <option value="">Select time range</option>
                    {OPERATING_TIMES_OPTIONS.filter(opt => opt.value !== "").map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Timezone Dropdown */}
          <div>
            <label htmlFor="business-timezone" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {t("timezoneLabel")}
            </label>
            <select
              id="business-timezone"
              value={businessInfo.timezone || ""}
              onChange={(event) =>
                updateBusinessInfo({ timezone: event.target.value })
              }
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "business-error" : undefined}
              disabled={loading}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">{t("timezonePlaceholder") || "Select timezone"}</option>
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="business-services" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
            {t("servicesProductsLabel")}
          </label>
          <textarea
            id="business-services"
            value={businessInfo.services}
            onChange={(event) => updateBusinessInfo({ services: event.target.value })}
            rows={4}
            placeholder={t("servicesProductsPlaceholder")}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "business-error" : undefined}
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="business-notes" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
            {t("notesLabel")}
          </label>
          <textarea
            id="business-notes"
            value={businessInfo.notes}
            onChange={(event) => updateBusinessInfo({ notes: event.target.value })}
            rows={3}
            placeholder={t("notesPlaceholder")}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "business-error" : undefined}
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {error && (
          <div 
            id="business-error"
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
          >
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setShowBusinessModal(false);
              // Set follow-up reminder (show again in 7 days)
              if (typeof window !== "undefined") {
                const followUpDate = new Date();
                followUpDate.setDate(followUpDate.getDate() + 7);
                window.localStorage.setItem("cx-business-modal-followup", followUpDate.toISOString());
                // Don't mark as permanently shown, so it can appear again after follow-up period
              }
            }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {t("followUp")}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowBusinessModal(false);
                // Mark as shown so it doesn't appear again
                if (typeof window !== "undefined") {
                  window.localStorage.setItem("cx-business-modal-shown", "true");
                }
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50 dark:bg-white dark:text-slate-100 dark:text-slate-900 dark:hover:bg-slate-100 dark:focus-visible:outline-white"
            >
              {loading ? t("saving") : t("save")}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default BusinessInfoModal;
