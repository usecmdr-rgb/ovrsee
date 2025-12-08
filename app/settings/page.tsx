"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Loader2, Palette, Bell, Link2, Shield, Check } from "lucide-react";
import { useAppState } from "@/context/AppStateContext";
import ThemeSection from "@/components/settings/ThemeSection";
import NotificationsSection from "@/components/settings/NotificationsSection";
import ConnectedAccountsSection from "@/components/settings/ConnectedAccountsSection";
import SecuritySection from "@/components/settings/SecuritySection";

type SettingsSection = "theme" | "notifications" | "connected-accounts" | "security";

interface UserSettings {
  theme: "light" | "dark" | "system";
  notif_daily_summary: boolean;
  notif_payment_alerts: boolean;
  notif_weekly_digest: boolean;
  notif_missed_calls: boolean;
  notif_subscription_alerts: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAppState();
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SettingsSection>("theme");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [connectedAccounts, setConnectedAccounts] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<{ [key: string]: "saved" | "saving" | null }>({});

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  // Load settings on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      // Fetch user settings
      const { data: { user } } = await supabaseBrowserClient.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }

      // Get or create user settings
      let { data: userSettings, error: settingsError } = await supabaseBrowserClient
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (settingsError && settingsError.code === "PGRST116") {
        // No settings found, create defaults
        const { data: newSettings, error: createError } = await supabaseBrowserClient
          .from("user_settings")
          .insert({
            user_id: user.id,
            theme: "system",
            notif_daily_summary: true,
            notif_payment_alerts: true,
            notif_weekly_digest: true,
            notif_missed_calls: true,
            notif_subscription_alerts: true,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating user settings:", createError);
        } else {
          userSettings = newSettings;
        }
      } else if (settingsError) {
        console.error("Error loading user settings:", settingsError);
      }

      if (userSettings) {
        setSettings({
          theme: userSettings.theme as "light" | "dark" | "system",
          notif_daily_summary: userSettings.notif_daily_summary,
          notif_payment_alerts: userSettings.notif_payment_alerts,
          notif_weekly_digest: userSettings.notif_weekly_digest,
          notif_missed_calls: userSettings.notif_missed_calls,
          notif_subscription_alerts: userSettings.notif_subscription_alerts,
        });
      }

      // Fetch connected accounts
      const { data: accounts, error: accountsError } = await supabaseBrowserClient
        .from("user_connected_accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (accountsError) {
        console.error("Error loading connected accounts:", accountsError);
      } else {
        setConnectedAccounts(accounts || []);
      }

      // Also sync from integrations table to ensure we have the latest
      await syncConnectedAccounts();
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const syncConnectedAccounts = async () => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const response = await fetch("/api/settings/connected-accounts/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const { accounts } = await response.json();
        setConnectedAccounts(accounts || []);
      }
    } catch (error) {
      console.error("Error syncing connected accounts:", error);
    }
  };

  // Debounce timer ref
  const debounceTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const updateSetting = useCallback(async (key: keyof UserSettings, value: any) => {
    if (!settings) return;

    // Update local state immediately
    setSettings({ ...settings, [key]: value });
    setSaveStatus({ [key]: "saving" });

    // Clear existing debounce timer for this key
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    // Debounce the database update (500ms)
    debounceTimers.current[key] = setTimeout(async () => {
      const { data: { user } } = await supabaseBrowserClient.auth.getUser();
      if (!user) {
        setSaveStatus({ [key]: null });
        return;
      }

      try {
        const { error } = await supabaseBrowserClient
          .from("user_settings")
          .update({ [key]: value })
          .eq("user_id", user.id);

        if (error) {
          console.error("Error updating setting:", error);
          setSaveStatus({ [key]: null });
          return;
        }

        setSaveStatus({ [key]: "saved" });
        setTimeout(() => setSaveStatus({ [key]: null }), 2000);
      } catch (error) {
        console.error("Error updating setting:", error);
        setSaveStatus({ [key]: null });
      }
    }, 500);
  }, [settings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">Failed to load settings</p>
          <button
            onClick={loadSettings}
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 dark:bg-white dark:text-slate-900"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
    { id: "theme", label: "Theme", icon: <Palette size={18} /> },
    { id: "notifications", label: "Notifications", icon: <Bell size={18} /> },
    { id: "connected-accounts", label: "Connected Accounts", icon: <Link2 size={18} /> },
    { id: "security", label: "Security", icon: <Shield size={18} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Manage your account preferences and connected services
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Navigation */}
        <nav className="lg:w-64 flex-shrink-0">
          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                  activeSection === item.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Right Content Panel */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
            {activeSection === "theme" && (
              <ThemeSection
                theme={settings.theme}
                onUpdate={(theme) => updateSetting("theme", theme)}
                saveStatus={saveStatus.theme}
              />
            )}
            {activeSection === "notifications" && (
              <NotificationsSection
                settings={settings}
                onUpdate={updateSetting}
                saveStatus={saveStatus}
              />
            )}
            {activeSection === "connected-accounts" && (
              <ConnectedAccountsSection
                accounts={connectedAccounts}
                onRefresh={loadSettings}
              />
            )}
            {activeSection === "security" && <SecuritySection />}
          </div>
        </div>
      </div>
    </div>
  );
}

