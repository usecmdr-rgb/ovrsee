"use client";

// Pricing comparison table with 3 tiers (Basic, Advanced, Elite)
// and a clean chart that shows which agent is included in which tier.

import { useState, useMemo } from "react";
import { Check, X, AlertCircle } from "lucide-react";
import { useSupabase } from "@/components/SupabaseProvider";
import { useAppState } from "@/context/AppStateContext";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { agents } from "@/lib/data";
import { BASE_PRICES, formatPrice } from "@/lib/currency";

type TierId = "basic" | "advanced" | "elite";

function CellValue({ value }: { value: boolean | string | undefined }) {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return <span className="text-sm text-muted-foreground">{value}</span>;
  }

  if (value) {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
        <Check className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
      <X className="h-5 w-5 text-destructive" />
    </span>
  );
}

export default function PricingTable() {
  const { supabase } = useSupabase();
  const { isAuthenticated, openAuthModal, language } = useAppState();
  const [loading, setLoading] = useState(false);
  const [trialStarted, setTrialStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslation();
  
  // Get trial status to determine if user can start a trial
  const { hasUsedTrial, isOnTrial, isTrialExpired, canStartTrial, loading: trialStatusLoading } = useTrialStatus();

  const tiers = useMemo(() => {
    return [
      {
        id: "basic" as TierId,
        name: t("basic"),
        price: formatPrice(BASE_PRICES.basic, language),
        description: t("startWithXi"),
      },
      {
        id: "advanced" as TierId,
        name: t("advanced"),
        price: formatPrice(BASE_PRICES.advanced, language),
        badge: t("mostPopular"),
        description: t("unlockAlphaMu"),
      },
      {
        id: "elite" as TierId,
        name: t("elite"),
        price: formatPrice(BASE_PRICES.elite, language),
        description: t("everythingPlusBeta"),
      },
    ];
  }, [t, language]);

  const rows = useMemo(() => {
    // Get agents in the correct order: Sync, Aloha, Studio, Insight
    const syncAgent = agents.find(a => a.key === "sync");
    const alohaAgent = agents.find(a => a.key === "aloha");
    const studioAgent = agents.find(a => a.key === "studio");
    const insightAgent = agents.find(a => a.key === "insight");
    
    return [
      {
        label: syncAgent?.name || "Sync",
        sublabel: t("agentRoleEmailCalendar"),
        basic: true,
        advanced: true,
        elite: true,
      },
      {
        label: alohaAgent?.name || "Aloha",
        sublabel: t("agentRoleAssistant"),
        basic: false,
        advanced: true,
        elite: true,
      },
      {
        label: studioAgent?.name || "Studio",
        sublabel: t("agentRoleMediaBranding"),
        basic: false,
        advanced: true,
        elite: true,
      },
      {
        label: insightAgent?.name || "Insight",
        sublabel: t("agentRoleBusinessInsights"),
        basic: false,
        advanced: false,
        elite: true,
      },
      {
        label: t("support"),
        sublabel: t("emailVsPriority"),
        basic: t("standard"),
        advanced: t("priority"),
        elite: t("priority"),
      },
      {
        label: t("usage"),
        sublabel: t("idealTeamSize"),
        basic: t("soloSmallTeam"),
        advanced: t("growingTeams"),
        elite: t("agenciesCompanies"),
      },
    ];
  }, [t]);

  const handleStartTrial = async () => {
    if (!isAuthenticated) {
      openAuthModal("signup");
      return;
    }

    // Check if user has already used trial (client-side check, but server enforces)
    if (hasUsedTrial) {
      setError(t("subscriptionTrialAlreadyUsedDescription"));
      return;
    }

    if (isOnTrial) {
      setError(t("subscriptionCurrentlyOnTrial"));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get current user
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        openAuthModal("signup");
        setLoading(false);
        return;
      }

      // Start trial with Basic tier (default)
      // Server will enforce one-time trial rule
      const response = await fetch("/api/trial/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tier: "basic",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (data.code === "TRIAL_ALREADY_USED") {
          setError(data.message || t("subscriptionTrialAlreadyUsedDescription"));
        } else {
          setError(data.error || t("pleaseTryAgain"));
        }
        return;
      }

      setTrialStarted(true);
    } catch (err: any) {
      setError(err.message || t("pleaseTryAgain"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-16 flex flex-col items-center">
      {/* Header */}
      <div className="text-center mb-10 space-y-3">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {t("chooseTier")}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          {t("pricingDescription")}
        </p>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto rounded-2xl bg-card/60 backdrop-blur w-full max-w-5xl">
        <table className="w-full border-separate border-spacing-0 text-base">
          <thead>
            <tr>
              {/* Empty top-left corner cell */}
              <th className="align-bottom bg-background/60 sticky left-0 z-20 px-4 py-4 text-left text-sm font-medium uppercase tracking-wide border-b border-r border-border">
                {/* Feature / Agent */}
              </th>

              {tiers.map((tier, index) => (
                <th
                  key={tier.id}
                  className={`align-bottom px-4 py-4 text-center border-b border-border ${
                    index === 0 ? "border-r" : index === tiers.length - 1 ? "border-l" : "border-x"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {tier.badge && (
                      <span className="text-xs uppercase tracking-wider text-primary font-medium mb-1">
                        {tier.badge}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t-lg px-3 py-1.5 text-sm font-semibold tracking-wide uppercase bg-gradient-to-r ${
                        index === 0
                          ? "from-slate-300 to-slate-200 text-slate-700 dark:text-slate-800"
                          : index === 1
                            ? "from-orange-500 to-orange-600 text-background"
                            : "from-sky-600 to-sky-500 text-background"
                      }`}
                    >
                      {tier.name}
                    </div>
                    <div className="mt-2 text-xl font-semibold">{tier.price}</div>
                    <div className="text-sm uppercase text-muted-foreground">{t("perMonth")}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {tier.description}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, rowIndex) => {
              const isAgentRow = rowIndex < 4; // First 4 rows are agents
              return (
                <tr
                  key={row.label}
                  className={rowIndex % 2 === 0 ? "bg-background/40" : "bg-background/20"}
                >
                  {/* Row label */}
                  <td className="sticky left-0 z-10 px-4 py-4 border-t border-r border-border bg-background/60 backdrop-blur">
                    <div className="flex flex-col items-center text-center">
                      <span className="text-xl font-semibold">{row.label}</span>
                      {row.sublabel && (
                        <span className="text-sm text-muted-foreground">
                          {row.sublabel}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Basic */}
                  <td className="px-4 py-4 text-center border-t border-border bg-background/60">
                    <CellValue value={row.basic} />
                  </td>

                  {/* Advanced */}
                  <td className="px-4 py-4 text-center border-t border-l border-border">
                    <CellValue value={row.advanced} />
                  </td>

                  {/* Elite */}
                  <td className="px-4 py-4 text-center border-t border-l border-border bg-background/60">
                    <CellValue value={row.elite} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Free Trial Button */}
      <div className="mt-8 flex flex-col items-center gap-4">
        {trialStarted ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              ✨ {t("trialStarted")}
            </p>
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500">
              {t("trialStartedDescription")}
            </p>
          </div>
        ) : hasUsedTrial && !trialStatusLoading ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-center dark:border-amber-800 dark:bg-amber-900/20 max-w-md">
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {t("subscriptionTrialAlreadyUsed")}
              </p>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {t("subscriptionTrialAlreadyUsedDescription")}
            </p>
          </div>
        ) : isOnTrial && !trialStatusLoading ? (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-6 py-4 text-center dark:border-blue-800 dark:bg-blue-900/20 max-w-md">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">
              ✨ {t("subscriptionCurrentlyOnTrial")}
            </p>
            <p className="mt-1 text-xs text-blue-600 dark:text-blue-500">
              {t("subscriptionTrialActiveDescription")}
            </p>
          </div>
        ) : (
          <>
            <Button
              onClick={handleStartTrial}
              disabled={loading || trialStatusLoading || !canStartTrial}
              className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 disabled:opacity-50"
            >
              {loading
                ? t("startingTrial")
                : isAuthenticated
                  ? t("startTrial")
                  : t("signInToStartTrial")}
            </Button>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-900/20 max-w-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            {!hasUsedTrial && (
              <p className="text-xs text-muted-foreground text-center max-w-md">
                {t("trialNote")}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
