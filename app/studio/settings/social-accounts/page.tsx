"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Instagram, Facebook, Music, Loader2, CheckCircle2, Link2 } from "lucide-react";

interface SocialAccount {
  platform: string;
  status: string;
  handle: string | null;
  connected_at: string | null;
}

const PLATFORMS = ["instagram", "facebook"];

export default function StudioSocialAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/studio/social/accounts", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load accounts");
      }

      const data = await res.json();
      if (data.ok && data.data?.accounts) {
        setAccounts(data.data.accounts);
      } else {
        // Fallback: create default disconnected accounts
        setAccounts(
          PLATFORMS.map((platform) => ({
            platform,
            status: "disconnected",
            handle: null,
            connected_at: null,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
      // Fallback: create default disconnected accounts
      setAccounts(
        PLATFORMS.map((platform) => ({
          platform,
          status: "disconnected",
          handle: null,
          connected_at: null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    try {
      setConnecting(platform);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      // Route to OAuth start endpoint based on platform
      let oauthUrl: string;
      
      switch (platform) {
        case "instagram":
          // Instagram uses Facebook OAuth (Instagram Business Account)
          oauthUrl = "/api/oauth/facebook/start";
          break;
        case "facebook":
          // Facebook uses Facebook OAuth
          oauthUrl = "/api/oauth/facebook/start";
          break;
        case "tiktok":
          // TikTok has its own OAuth flow
          oauthUrl = "/api/oauth/tiktok/start";
          break;
        default:
          console.error(`Unknown platform: ${platform}`);
          setConnecting(null);
          return;
      }

      // Redirect to OAuth start endpoint
      window.location.href = oauthUrl;
    } catch (error) {
      console.error("Error connecting account:", error);
      setConnecting(null);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram":
        return Instagram;
      case "tiktok":
        return Music;
      case "facebook":
        return Facebook;
      default:
        return Link2;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "instagram":
        return "bg-gradient-to-br from-purple-500 to-pink-500";
      case "tiktok":
        return "bg-black";
      case "facebook":
        return "bg-blue-600";
      default:
        return "bg-slate-600";
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "instagram":
        return "Instagram";
      case "tiktok":
        return "TikTok";
      case "facebook":
        return "Facebook";
      default:
        return platform;
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Connect Social Accounts
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Connect your Instagram, TikTok, or Facebook accounts to start publishing content
        </p>
      </div>

      <div className="space-y-4">
        {PLATFORMS.map((platform) => {
          const account = accounts.find((acc) => acc.platform === platform) || {
            platform,
            status: "disconnected",
            handle: null,
            connected_at: null,
          };
          const PlatformIcon = getPlatformIcon(account.platform);
          const isConnected = account.status !== "disconnected";
          const isConnecting = connecting === account.platform;

          return (
            <div
              key={account.platform}
              className={`p-6 rounded-lg border-2 ${
                isConnected
                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${getPlatformColor(
                      account.platform
                    )}`}
                  >
                    <PlatformIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {getPlatformName(account.platform)}
                    </h3>
                    {isConnected && account.handle && (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Connected as {account.handle}
                      </p>
                    )}
                    {!isConnected && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Not connected
                      </p>
                    )}
                    {isConnected && account.connected_at && (
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        Connected {new Date(account.connected_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isConnected ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">
                        Connected
                      </span>
                    </>
                  ) : (
                    <button
                      onClick={() => handleConnect(account.platform)}
                      disabled={isConnecting || connecting !== null}
                      className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-2"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Link2 className="w-4 h-4" />
                          Connect {getPlatformName(account.platform)}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {accounts.every((acc) => acc.status === "disconnected") && (
        <div className="mt-6 p-4 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Connect at least one account to start using Studio. You can connect multiple accounts and switch between them when creating posts.
          </p>
        </div>
      )}
    </div>
  );
}

