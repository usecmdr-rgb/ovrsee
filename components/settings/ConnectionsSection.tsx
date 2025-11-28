"use client";

import { useState } from "react";
import { Facebook, Globe, Instagram, Linkedin, Loader2, RefreshCcw, X as TwitterX } from "lucide-react";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import type { ConnectedAccountType } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";

const SettingsConnectionsSection = () => {
  const { accounts, isLoading, error, connectAccount, disconnectAccount, refresh } = useConnectedAccounts();
  const t = useTranslation();
  const [connecting, setConnecting] = useState<ConnectedAccountType | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const platformLabelMap: Record<ConnectedAccountType, string> = {
    facebook: t("connectionsPlatformFacebook"),
    instagram: t("connectionsPlatformInstagram"),
    x: t("connectionsPlatformX"),
    linkedin: t("connectionsPlatformLinkedIn"),
    website: t("connectionsPlatformWebsite"),
    other: t("connectionsPlatformOther"),
  };

  const platformIconMap: Record<ConnectedAccountType, JSX.Element> = {
    facebook: <Facebook className="h-5 w-5" />,
    instagram: <Instagram className="h-5 w-5" />,
    x: <TwitterX className="h-5 w-5" />,
    linkedin: <Linkedin className="h-5 w-5" />,
    website: <Globe className="h-5 w-5" />,
    other: <Globe className="h-5 w-5" />,
  };

  const handleConnect = async (type: ConnectedAccountType) => {
    try {
      setLocalError(null);
      setConnecting(type);
      await connectAccount(type);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t("connectionsUnableToConnect"));
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      setLocalError(null);
      setDisconnectingId(accountId);
      await disconnectAccount(accountId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t("connectionsUnableToDisconnect"));
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("connectionsTitle")}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("connectionsDescription")}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          {t("connectionsRefresh")}
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-700">
            {t("connectionsLoading")}
          </div>
        )}
        {!isLoading && accounts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500 dark:border-slate-700">
            {t("connectionsNoAccounts")}
          </div>
        )}
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
          >
            <div className="flex items-center gap-3">
              <div className="text-slate-600 dark:text-slate-400">
                {platformIconMap[account.type]}
              </div>
              <div>
                <p className="text-sm font-semibold">{platformLabelMap[account.type]}</p>
                <p className="text-xs text-slate-500">{account.displayName || "Not connected"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  account.isConnected
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {account.isConnected ? t("connectionsConnected") : t("connectionsNotConnected")}
              </span>
              {account.isConnected ? (
                <button
                  type="button"
                  onClick={() => handleDisconnect(account.id)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-60"
                  disabled={disconnectingId === account.id}
                >
                  {disconnectingId === account.id ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("connectionsDisconnecting")}
                    </span>
                  ) : (
                    t("connectionsDisconnect")
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleConnect(account.type)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-60"
                  disabled={connecting === account.type}
                >
                  {connecting === account.type ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("connectionsConnecting")}
                    </span>
                  ) : (
                    t("connectionsConnect")
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
        {(error || localError) && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {localError || error}
          </div>
        )}
      </div>
    </section>
  );
};

export default SettingsConnectionsSection;




