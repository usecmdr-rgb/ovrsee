"use client";

import { FormEvent, useState, useEffect, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import { useAppState } from "@/context/AppStateContext";
import { useSupabase } from "@/components/SupabaseProvider";
import { useTranslation } from "@/hooks/useTranslation";

const BusinessInfoModal = () => {
  const { showBusinessModal, setShowBusinessModal, businessInfo, updateBusinessInfo } = useAppState();
  const { supabase } = useSupabase();
  const t = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [watermarkPosition, setWatermarkPosition] = useState("bottom_right");
  
  const fields = [
    { id: "businessName", label: t("businessNameLabel"), placeholder: t("placeholderCompany") },
    { id: "businessType", label: t("businessTypeLabel"), placeholder: t("businessTypePlaceholder") },
    { id: "location", label: t("locationLabel"), placeholder: t("locationPlaceholder") },
    { id: "operatingHours", label: t("operatingHoursLabel"), placeholder: t("operatingHoursPlaceholder") },
    { id: "serviceName", label: t("serviceNameLabel"), placeholder: t("serviceNamePlaceholder") },
    { id: "website", label: t("websiteLabel"), placeholder: t("websitePlaceholder") },
    { id: "contactEmail", label: t("contactEmailLabel"), placeholder: t("contactEmailPlaceholder") },
    { id: "contactPhone", label: t("contactPhoneLabel"), placeholder: t("contactPhonePlaceholder") },
    { id: "language", label: t("preferredLanguageLabel"), placeholder: t("preferredLanguagePlaceholder") },
    { id: "timezone", label: t("timezoneLabel"), placeholder: t("timezonePlaceholder") },
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
          // Update local state with profile data
          updateBusinessInfo({
            businessName: data.profile.businessName || "",
            businessType: data.profile.industry || "",
            location: data.profile.location || "",
            operatingHours: data.profile.hours || "",
            serviceName: data.profile.serviceName || "",
            website: data.profile.website || "",
            contactEmail: data.profile.contactEmail || "",
            contactPhone: data.profile.contactPhone || "",
            language: data.profile.language || t("preferredLanguagePlaceholder"),
            timezone: data.profile.timezone || t("timezonePlaceholder"),
            notes: data.profile.notes || "",
            services: typeof data.profile.services === "string" 
              ? data.profile.services 
              : Array.isArray(data.profile.services)
              ? data.profile.services.join("\n")
              : "",
          });

          // Load watermark settings
          if (data.profile.watermarkSettings) {
            setWatermarkEnabled(data.profile.watermarkSettings.enabled || false);
            setWatermarkText(data.profile.watermarkSettings.text || "");
            setWatermarkPosition(data.profile.watermarkSettings.position || "bottom_right");
          }
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

      const response = await fetch("/api/business-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...businessInfo,
          watermarkSettings: {
            enabled: watermarkEnabled,
            text: watermarkText || null,
            position: watermarkPosition,
            logoUrl: null, // Can be added later
          },
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
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.id}>
              <label htmlFor={`business-${field.id}`} className="text-sm font-medium">
                {field.label}
              </label>
              <input
                id={`business-${field.id}`}
                value={(businessInfo as any)[field.id] ?? ""}
                onChange={(event) =>
                  updateBusinessInfo({ [field.id]: event.target.value } as any)
                }
                placeholder={field.placeholder}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "business-error" : undefined}
                disabled={loading}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 dark:border-slate-700"
              />
            </div>
          ))}
        </div>
        <div>
          <label htmlFor="business-services" className="text-sm font-medium">
            {t("servicesProductsLabel")}
          </label>
          <textarea
            id="business-services"
            value={businessInfo.services}
            onChange={(event) => updateBusinessInfo({ services: event.target.value })}
            rows={6}
            placeholder={t("servicesProductsPlaceholder")}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "business-error" : undefined}
            disabled={loading}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 dark:border-slate-700"
          />
        </div>
        <div>
          <label htmlFor="business-notes" className="text-sm font-medium">
            {t("notesLabel")}
          </label>
          <textarea
            id="business-notes"
            value={businessInfo.notes}
            onChange={(event) => updateBusinessInfo({ notes: event.target.value })}
            rows={4}
            placeholder={t("notesPlaceholder")}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "business-error" : undefined}
            disabled={loading}
            className="mt-1 w-full rounded-2xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 dark:border-slate-700"
          />
        </div>

        {/* Watermark Settings Section */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <h3 className="mb-3 text-sm font-semibold">{t("watermarkSettingsTitle")}</h3>
          <div className="space-y-3">
            <label htmlFor="watermark-enabled" className="flex items-center gap-2">
              <input
                id="watermark-enabled"
                type="checkbox"
                checked={watermarkEnabled}
                onChange={(e) => setWatermarkEnabled(e.target.checked)}
                disabled={loading}
                className="rounded border-slate-300 focus:ring-2 focus:ring-brand-accent focus:ring-offset-2"
              />
              <span className="text-sm">{t("watermarkEnableAuto")}</span>
            </label>
            {watermarkEnabled && (
              <>
                <div>
                  <label htmlFor="watermark-text" className="text-xs font-medium">{t("watermarkTextLabel")}</label>
                  <input
                    id="watermark-text"
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder={t("watermarkTextPlaceholder")}
                    disabled={loading}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label htmlFor="watermark-position" className="text-xs font-medium">{t("watermarkPositionLabel")}</label>
                  <select
                    id="watermark-position"
                    value={watermarkPosition}
                    onChange={(e) => setWatermarkPosition(e.target.value)}
                    disabled={loading}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 dark:border-slate-700"
                  >
                    <option value="top_left">{t("watermarkPositionTopLeft")}</option>
                    <option value="top_right">{t("watermarkPositionTopRight")}</option>
                    <option value="top_center">{t("watermarkPositionTopCenter")}</option>
                    <option value="bottom_left">{t("watermarkPositionBottomLeft")}</option>
                    <option value="bottom_right">{t("watermarkPositionBottomRight")}</option>
                    <option value="bottom_center">{t("watermarkPositionBottomCenter")}</option>
                    <option value="center">{t("watermarkPositionCenter")}</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div 
            id="business-error"
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
          >
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setShowBusinessModal(false);
              // Mark as shown so it doesn't appear again
              if (typeof window !== "undefined") {
                window.localStorage.setItem("cx-business-modal-shown", "true");
              }
            }}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:focus-visible:outline-white"
          >
            {loading ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default BusinessInfoModal;
