"use client";

import Modal from "@/components/ui/Modal";
import { useAppState } from "@/context/AppStateContext";
import SettingsConnectionsSection from "@/components/settings/ConnectionsSection";
import { useTranslation } from "@/hooks/useTranslation";

const colorChoices = [
  "#ef4444",
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#14b8a6",
  "#facc15",
  "#94a3b8",
];

const SettingsModal = () => {
  const {
    showSettingsModal,
    setShowSettingsModal,
    theme,
    setTheme,
    alertCategories,
    updateAlertColor,
  } = useAppState();
  const t = useTranslation();

  const notificationLabels = [t("settingsDailySummary"), t("settingsPaymentAlerts"), t("settingsWeeklyDigest")];

  return (
    <Modal
      title={t("settingsModalTitle")}
      description={t("settingsModalDescription")}
      open={showSettingsModal}
      onClose={() => setShowSettingsModal(false)}
      size="lg"
    >
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("settingsThemeTitle")}
          </h3>
          <div className="mt-3 flex gap-3">
            {(["light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold capitalize ${
                  theme === mode
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                    : "border-slate-200 dark:border-slate-700"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("settingsSyncAlertColors")}
          </h3>
          <div className="mt-3 space-y-4">
            {alertCategories.map((category) => (
              <div key={category.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold">{category.name}</p>
                  <p className="text-xs text-slate-500">{category.count} {t("settingsItems")}</p>
                </div>
                <div className="flex gap-2">
                  {colorChoices.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateAlertColor(category.id, color)}
                      style={{ backgroundColor: color }}
                      className={`h-8 w-8 rounded-full border-2 ${
                        category.color === color ? "border-slate-900" : "border-transparent"
                      }`}
                      aria-label={`Set color ${color} for ${category.name}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("settingsNotifications")}
          </h3>
          <div className="space-y-3">
            {notificationLabels.map((label) => (
              <label key={label} className="flex items-center justify-between rounded-2xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                <span>{label}</span>
                <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-brand-accent focus:ring-brand-accent" />
              </label>
            ))}
          </div>
        </section>
        <SettingsConnectionsSection />
      </div>
    </Modal>
  );
};

export default SettingsModal;
