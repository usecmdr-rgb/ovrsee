"use client";

import { Check, Loader2 } from "lucide-react";

interface UserSettings {
  theme: "light" | "dark" | "system";
  notif_daily_summary: boolean;
  notif_payment_alerts: boolean;
  notif_weekly_digest: boolean;
  notif_missed_calls: boolean;
  notif_subscription_alerts: boolean;
}

interface NotificationsSectionProps {
  settings: UserSettings;
  onUpdate: (key: keyof UserSettings, value: any) => void;
  saveStatus: { [key: string]: "saved" | "saving" | null };
}

export default function NotificationsSection({
  settings,
  onUpdate,
  saveStatus,
}: NotificationsSectionProps) {
  const notificationOptions: Array<{
    key: keyof UserSettings;
    label: string;
    description: string;
  }> = [
    {
      key: "notif_daily_summary",
      label: "Daily Summary",
      description: "Receive a daily email with your activity summary",
    },
    {
      key: "notif_payment_alerts",
      label: "Payment Alerts",
      description: "Get notified about payment-related updates",
    },
    {
      key: "notif_weekly_digest",
      label: "Weekly Digest",
      description: "Receive a weekly summary of your activity",
    },
    {
      key: "notif_missed_calls",
      label: "Missed Calls & Voicemails",
      description: "Get notified when you miss calls or receive voicemails",
    },
    {
      key: "notif_subscription_alerts",
      label: "Subscription Alerts",
      description: "Receive notifications about subscription changes",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Notifications</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Choose which notifications you want to receive
        </p>
      </div>

      <div className="space-y-4">
        {notificationOptions.map((option) => {
          const isEnabled = settings[option.key] as boolean;
          const status = saveStatus[option.key];

          return (
            <div
              key={option.key}
              className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <div className="flex-1">
                <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {option.description}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {status === "saved" && (
                  <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                    <Check size={14} />
                    <span className="sr-only">Saved</span>
                  </div>
                )}
                {status === "saving" && (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                )}
                <button
                  onClick={() => onUpdate(option.key, !isEnabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 dark:focus:ring-white ${
                    isEnabled ? "bg-slate-900 dark:bg-white" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                  role="switch"
                  aria-checked={isEnabled}
                  aria-label={`Toggle ${option.label}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

