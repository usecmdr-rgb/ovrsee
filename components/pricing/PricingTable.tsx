"use client";

// Pricing comparison table with 3 tiers (Essentials, Professional, Executive) + Teams
// and a clean chart that shows which agent is included in which tier.
//
// YEARLY BILLING SUPPORT:
// - Toggle between Monthly and Yearly billing cycles
// - Yearly pricing = 11 × monthly (1 month free)
// - Prices update dynamically based on billing cycle selection
// - UI layout remains unchanged, only values and text update

import { useState, useMemo } from "react";
import { Check, X, AlertCircle, Calendar } from "lucide-react";
import Link from "next/link";
import { useSupabase } from "@/components/SupabaseProvider";
import { useAppState } from "@/context/AppStateContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { agents } from "@/lib/data";
import { formatPrice } from "@/lib/currency";
import { PLAN_PRICING, getPlanAmount, type BillingInterval, type CorePlanCode } from "@/lib/pricingConfig";
import { useBillingInterval } from "@/components/pricing/BillingIntervalContext";
import { useStartCheckout } from "@/components/pricing/useStartCheckout";

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
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
        <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
      </span>
    );
  }

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
      <X className="h-4 w-4 text-destructive" />
    </span>
  );
}

export default function PricingTable() {
  const { supabase } = useSupabase();
  const { isAuthenticated, openAuthModal, language } = useAppState();
  const [loading, setLoading] = useState(false);
  const [trialStarted, setTrialStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { billingInterval: billingCycle, setBillingInterval: setBillingCycle } = useBillingInterval();
  const t = useTranslation();
  
  // Get trial status to determine if user can start a trial
  const { hasUsedTrial, isOnTrial, isTrialExpired, canStartTrial, loading: trialStatusLoading } = useTrialStatus();

  // Map tier IDs to plan codes for pricing config
  const tierToPlanCode: Record<TierId, CorePlanCode> = {
    basic: "essentials",
    advanced: "professional",
    elite: "executive",
  };

  const tiers = useMemo(() => {
    return [
      {
        id: "basic" as TierId,
        name: "Essentials",
        planCode: "essentials" as CorePlanCode,
        description: "Start with Sync.", // Updated plan description
        hasTrial: true, // Essentials is the only plan with a 3-day free trial
      },
      {
        id: "advanced" as TierId,
        name: "Professional",
        planCode: "professional" as CorePlanCode,
        description: "Unlock Aloha & Studio social analytics.", // Updated plan description
        hasTrial: false, // Professional has NO free trial
      },
      {
        id: "elite" as TierId,
        name: "Executive",
        planCode: "executive" as CorePlanCode,
        description: "Everything, plus Insights.", // Updated plan description
        hasTrial: false, // Executive has NO free trial
      },
    ].map((tier) => {
      // Get price based on billing cycle
      const priceInCents = getPlanAmount(tier.planCode, billingCycle);
      const priceInDollars = priceInCents / 100;
      
      // Format price display
      const priceDisplay = billingCycle === "yearly" 
        ? formatPrice(priceInDollars, language) + "/year"
        : formatPrice(priceInDollars, language);
      
      return {
        ...tier,
        price: priceDisplay,
        priceInCents,
      };
    });
  }, [language, billingCycle]);

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

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const { startCheckout } = useStartCheckout();

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

      // Start trial with Essentials tier (default)
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

  const handleSubscribe = async (tierId: TierId) => {
    if (!isAuthenticated) {
      openAuthModal("signup");
      return;
    }

    try {
      setCheckoutLoading(tierId);
      setError(null);

      // Get current user
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        openAuthModal("signup");
        setCheckoutLoading(null);
        return;
      }

      const planCode = tierToPlanCode[tierId];

      await startCheckout(planCode, billingCycle);
    } catch (err: any) {
      setError(err.message || t("pleaseTryAgain"));
      setCheckoutLoading(null);
    }
  };

  return (
    <Card className="w-full h-full flex flex-col overflow-hidden">
      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center gap-2 mb-4 flex-shrink-0">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              billingCycle === "monthly"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              billingCycle === "yearly"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Yearly – Save 1 Month
          </button>
        </div>
        
        {/* Plan Title */}
        <div className="text-left mb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold font-sans flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {billingCycle === "yearly" ? "Annual Plan" : "Monthly Plan"}
          </h2>
        </div>
        {/* TABLE */}
        <div className="w-full flex-1 min-h-0 overflow-hidden">
          <div className="w-full h-full overflow-x-auto overflow-y-auto">
            <div className="min-w-full inline-block scale-[0.8] sm:scale-90 md:scale-100 origin-top-left">
              <table className="w-full border-separate border-spacing-0 text-xs bg-background min-w-[600px] md:min-w-0">
          <thead>
            <tr>
              {/* Empty top-left corner cell */}
              <th className="align-bottom bg-background/60 px-1 py-1 text-left text-xs font-medium uppercase tracking-wide border-b border-r border-slate-200 dark:border-slate-800">
                {/* Feature / Agent */}
              </th>

              {tiers.map((tier, index) => {
                const tierClass = tier.id === 'basic' ? 'tier-badge-basic' : tier.id === 'advanced' ? 'tier-badge-advanced' : 'tier-badge-elite';
                return (
                  <th
                    key={tier.id}
                    className={`align-bottom px-1.5 py-1.5 text-center border-b border-slate-200 dark:border-slate-800 ${
                      index === 0 ? "border-r border-slate-200 dark:border-slate-800" : "border-x border-slate-200 dark:border-slate-800"
                    }`}
                    style={{ width: '25%' }}
                  >
                    {/* Fixed height container for price, badge, and tagline */}
                    <div className="h-20 flex flex-col items-center justify-center w-full gap-0.5">
                      {/* Price */}
                      <div className="flex-shrink-0">
                        <span className="text-base font-semibold">{tier.price}</span>
                      </div>
                      {/* Yearly billing subtext */}
                      {billingCycle === "yearly" && (
                        <div className="flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            Billed annually • Save 1 month
                          </span>
                        </div>
                      )}
                      {/* Badge */}
                      <div className="flex-shrink-0">
                        <div className={`tier-badge ${tierClass} text-xs font-semibold tracking-wide uppercase`}>
                          {tier.name}
                        </div>
                      </div>
                      {/* Tagline */}
                      <div className="flex-shrink-0">
                        <span className="text-xs text-muted-foreground text-center leading-tight px-1">
                          {tier.description}
                        </span>
                      </div>
                    </div>
                  </th>
                );
              })}
              {/* Teams Column */}
              <th 
                className="align-bottom px-1.5 py-1.5 text-center border-b border-l border-slate-200 dark:border-slate-800"
                style={{ width: '25%' }}
              >
                {/* Fixed height container for price, badge, and tagline */}
                <div className="h-20 flex flex-col items-center justify-center w-full gap-0.5">
                  {/* Price */}
                  <div className="flex-shrink-0">
                    <span className="text-base font-semibold text-muted-foreground">Custom</span>
                  </div>
                  {/* Badge */}
                  <div className="flex-shrink-0">
                    <div className="tier-badge tier-badge-teams text-xs font-semibold tracking-wide uppercase">
                      Teams
                    </div>
                  </div>
                  {/* Tagline */}
                  <div className="flex-shrink-0">
                    <span className="text-xs text-muted-foreground text-center leading-tight px-1">
                      Mix & match users & tiers
                    </span>
                  </div>
                </div>
              </th>
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
                  <td className="sticky left-0 z-10 px-1.5 py-1.5 border-t border-r border-slate-200 dark:border-slate-800 bg-background/60 backdrop-blur">
                    <div className="flex flex-col items-center text-center">
                      <span className="text-xs font-semibold">{row.label}</span>
                      {row.sublabel && (
                        <span className="text-xs text-muted-foreground">
                          {row.sublabel}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Essentials */}
                  <td className="px-1.5 py-1.5 text-center border-t border-slate-200 dark:border-slate-800 bg-background/60">
                    <div className="flex flex-col items-center gap-1">
                      <CellValue value={row.basic} />
                      {/* Trial text for Sync row in Essentials column */}
                      {rowIndex === 0 && row.label.toLowerCase().includes("sync") && row.basic === true && (
                        <span className="text-xs text-muted-foreground">
                          Try Sync free for 3 days
                        </span>
                      )}
                      {/* Subscribe button in last row */}
                      {rowIndex === rows.length - 1 && (
                        <Button
                          onClick={() => handleSubscribe("basic")}
                          disabled={checkoutLoading === "basic"}
                          className="mt-2 w-full text-xs"
                        >
                          {checkoutLoading === "basic" ? "Loading..." : "Get Started"}
                        </Button>
                      )}
                    </div>
                  </td>

                  {/* Professional */}
                  <td className="px-1.5 py-1.5 text-center border-t border-l border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col items-center gap-1">
                      <CellValue value={row.advanced} />
                      {/* Subscribe button in last row */}
                      {rowIndex === rows.length - 1 && (
                        <Button
                          onClick={() => handleSubscribe("advanced")}
                          disabled={checkoutLoading === "advanced"}
                          className="mt-2 w-full text-xs"
                        >
                          {checkoutLoading === "advanced" ? "Loading..." : "Get Started"}
                        </Button>
                      )}
                    </div>
                  </td>

                  {/* Executive */}
                  <td className="px-1.5 py-1.5 text-center border-t border-l border-slate-200 dark:border-slate-800 bg-background/60">
                    <div className="flex flex-col items-center gap-1">
                      <CellValue value={row.elite} />
                      {/* Subscribe button in last row */}
                      {rowIndex === rows.length - 1 && (
                        <Button
                          onClick={() => handleSubscribe("elite")}
                          disabled={checkoutLoading === "elite"}
                          className="mt-2 w-full text-xs"
                        >
                          {checkoutLoading === "elite" ? "Loading..." : "Get Started"}
                        </Button>
                      )}
                    </div>
                  </td>

                  {/* Teams - show checkmarks for all features */}
                  <td className="px-1.5 py-1.5 text-center border-t border-l border-slate-200 dark:border-slate-800">
                    <CellValue value={true} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
            </div>
          </div>
        </div>

        {/* Free Trial Button */}
        <div className="mt-6 flex flex-col items-center gap-3 flex-shrink-0">
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
            {!hasUsedTrial && (
              <p className="text-xs text-muted-foreground text-center max-w-md">
                Start a 3-day Essentials (Sync) trial. No credit card required. Cancel anytime.
              </p>
            )}
            <Button
              onClick={handleStartTrial}
              disabled={loading || trialStatusLoading || !canStartTrial}
              className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 disabled:opacity-50"
            >
              {loading
                ? t("startingTrial")
                : isAuthenticated
                  ? "Start Essentials 3-day free trial"
                  : "Sign in to start Essentials 3-day free trial"}
            </Button>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 dark:border-red-800 dark:bg-red-900/20 max-w-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </>
        )}
        </div>
      </CardContent>
    </Card>
  );
}
