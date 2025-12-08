"use client";

import { useState } from "react";
import { Loader2, ExternalLink, X } from "lucide-react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { formatDistanceToNow } from "date-fns";

interface ConnectedAccount {
  id: string;
  provider: string;
  status: "connected" | "disconnected" | "error";
  scopes: string[];
  external_account_id?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface ConnectedAccountsSectionProps {
  accounts: ConnectedAccount[];
  onRefresh: () => void;
}

const PROVIDER_INFO: Record<string, { name: string; icon?: string; color: string }> = {
  gmail: { name: "Gmail", color: "bg-red-500" },
  outlook: { name: "Outlook", color: "bg-blue-500" },
  google_calendar: { name: "Google Calendar", color: "bg-blue-600" },
  instagram: { name: "Instagram", color: "bg-pink-500" },
  tiktok: { name: "TikTok", color: "bg-black dark:bg-white" },
  youtube: { name: "YouTube", color: "bg-red-600" },
  x: { name: "X (Twitter)", color: "bg-black dark:bg-white" },
  linkedin: { name: "LinkedIn", color: "bg-blue-700" },
};

export default function ConnectedAccountsSection({
  accounts,
  onRefresh,
}: ConnectedAccountsSectionProps) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    try {
      // For Gmail and Google Calendar, use the existing OAuth flow
      if (provider === "gmail" || provider === "google_calendar") {
        const { data: { session } } = await supabaseBrowserClient.auth.getSession();
        if (!session) {
          alert("Please sign in to connect accounts");
          return;
        }

        // Redirect to OAuth URL
        const response = await fetch(`/api/sync/google/oauth-url?provider=${provider}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const { url } = await response.json();
          window.location.href = url;
        } else {
          throw new Error("Failed to get OAuth URL");
        }
      } else {
        // For other providers, show a message that it's coming soon
        alert(`${PROVIDER_INFO[provider]?.name || provider} integration is coming soon!`);
      }
    } catch (error) {
      console.error("Error connecting account:", error);
      alert("Failed to connect account. Please try again.");
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: string, provider: string) => {
    if (!confirm(`Are you sure you want to disconnect ${PROVIDER_INFO[provider]?.name || provider}?`)) {
      return;
    }

    setDisconnecting(accountId);
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        alert("Please sign in to disconnect accounts");
        return;
      }

      // Call API to revoke tokens and disconnect
      const response = await fetch("/api/settings/connected-accounts/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ accountId, provider }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disconnect account");
      }

      // Refresh the list
      onRefresh();
    } catch (error: any) {
      console.error("Error disconnecting account:", error);
      alert(error.message || "Failed to disconnect account. Please try again.");
    } finally {
      setDisconnecting(null);
    }
  };

  const getProviderInfo = (provider: string) => {
    return PROVIDER_INFO[provider] || { name: provider, color: "bg-slate-500" };
  };

  const availableProviders = ["gmail", "google_calendar", "instagram", "tiktok", "youtube", "x", "linkedin"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Connected Accounts</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage your connected services and integrations
        </p>
      </div>

      {/* Connected Accounts */}
      {accounts.filter((a) => a.status === "connected").length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Connected</h3>
          {accounts
            .filter((account) => account.status === "connected")
            .map((account) => {
              const providerInfo = getProviderInfo(account.provider);
              return (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${providerInfo.color} flex items-center justify-center text-white text-sm font-semibold`}>
                      {providerInfo.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {providerInfo.name}
                      </div>
                      {account.external_account_id && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {account.external_account_id}
                        </div>
                      )}
                      {account.updated_at && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Last synced {formatDistanceToNow(new Date(account.updated_at), { addSuffix: true })}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDisconnect(account.id, account.provider)}
                    disabled={disconnecting === account.id}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                  >
                    {disconnecting === account.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Disconnect"
                    )}
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {/* Available Providers */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Available Integrations
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {availableProviders.map((provider) => {
            const providerInfo = getProviderInfo(provider);
            const isConnected = accounts.some(
              (a) => a.provider === provider && a.status === "connected"
            );
            const isConnecting = connecting === provider;

            if (isConnected) return null;

            return (
              <div
                key={provider}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${providerInfo.color} flex items-center justify-center text-white text-sm font-semibold`}>
                    {providerInfo.name.charAt(0)}
                  </div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {providerInfo.name}
                  </div>
                </div>
                <button
                  onClick={() => handleConnect(provider)}
                  disabled={isConnecting}
                  className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {accounts.length === 0 && availableProviders.every((p) => !accounts.some((a) => a.provider === p && a.status === "connected")) && (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          <p>No connected accounts yet</p>
          <p className="text-sm mt-2">Connect your accounts to get started</p>
        </div>
      )}
    </div>
  );
}

