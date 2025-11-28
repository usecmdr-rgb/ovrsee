"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Calendar, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { useSupabase } from "@/components/SupabaseProvider";
import { useAppState } from "@/context/AppStateContext";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/Modal";
import type { SubscriptionData, SubscriptionTier, PaymentMethodInfo } from "@/types";
import { tierConfig, type TierId } from "@/lib/stripe";
import { formatPrice, BASE_PRICES } from "@/lib/currency";
import { agents } from "@/lib/data";

const TIER_NAMES: Record<TierId, string> = {
  basic: "Basic",
  advanced: "Advanced",
  elite: "Elite",
};

const TIER_FEATURES: Record<TierId, string[]> = {
  basic: ["Sync Agent", "Email & Calendar Management", "Standard Support"],
  advanced: ["All Basic features", "Aloha Agent", "Studio Agent", "Priority Support"],
  elite: ["All Advanced features", "Insight Agent", "Business Intelligence", "Priority Support"],
};

export default function SubscriptionPage() {
  const router = useRouter();
  const { supabase } = useSupabase();
  const { isAuthenticated, openAuthModal, language } = useAppState();
  const t = useTranslation();
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const fetchSubscriptionData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setError(t("pleaseLogIn"));
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/subscription?userId=${session.user.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("loadingSubscriptionDetails"));
      }

      setSubscriptionData(data);
    } catch (err: any) {
      setError(err.message || t("pleaseTryAgain"));
    } finally {
      setLoading(false);
    }
  }, [supabase, t]);

  useEffect(() => {
    if (!isAuthenticated) {
      openAuthModal("login");
      return;
    }
    fetchSubscriptionData();
  }, [isAuthenticated, fetchSubscriptionData, openAuthModal]);

  const handleUpgradeDowngrade = async (tier: TierId) => {
    try {
      setUpgrading(tier);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        openAuthModal("login");
        return;
      }

      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tier,
          userId: session.user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("pleaseTryAgain"));
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      alert(err.message || t("pleaseTryAgain"));
      setUpgrading(null);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCanceling(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        return;
      }

      const response = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("pleaseTryAgain"));
      }

      setShowCancelModal(false);
      // Refresh subscription data
      await fetchSubscriptionData();
      alert(t("subscriptionCanceledMessage"));
    } catch (err: any) {
      alert(err.message || t("pleaseTryAgain"));
    } finally {
      setCanceling(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        return;
      }

      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.user.id,
        }),
      });

      const { url, error } = await response.json();

      if (error) {
        alert(t("billingFailedToOpenPortal"));
        return;
      }

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      alert(t("billingFailedToOpenPortal"));
    }
  };

  const formatCardBrand = (brand: string) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getTierDisplayName = (tier: SubscriptionTier | undefined | null) => {
    if (!tier) return "Free";
    return TIER_NAMES[tier as TierId] || tier;
  };

  const currentTier = subscriptionData?.subscription.tier;
  const isCurrentTier = (tier: TierId) => currentTier === tier;

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("loadingSubscriptionDetails")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold">{t("subscriptionBilling")}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {t("manageSubscriptionPlan")}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
          </div>
          <button
            onClick={fetchSubscriptionData}
            className="mt-3 text-sm text-red-600 underline dark:text-red-400"
          >
            {t("tryAgain")}
          </button>
        </div>
      )}

      {/* Current Plan Section */}
      {subscriptionData && (
        <Card>
          <CardHeader>
            <CardTitle>{t("currentPlan")}</CardTitle>
            <CardDescription>{t("activeSubscriptionDetails")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{getTierDisplayName(currentTier)}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t("status")}{" "}
                  <span className="font-medium capitalize">
                    {subscriptionData.subscription.status || t("inactive")}
                  </span>
                </p>
                {subscriptionData.subscription.currentPeriodEnd && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {t("renewsOn")} {formatDate(subscriptionData.subscription.currentPeriodEnd)}
                  </p>
                )}
                {subscriptionData.subscription.cancelAtPeriodEnd && (
                  <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                    {t("subscriptionWillCancel")}
                  </p>
                )}
                {subscriptionData.subscription.trialEnd && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {t("trialEnds")} {formatDate(subscriptionData.subscription.trialEnd)}
                  </p>
                )}
              </div>
              {currentTier && (
                <div className="text-right">
                  <p className="text-2xl font-semibold">
                    {formatPrice(BASE_PRICES[currentTier], language)}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t("perMonth")}</p>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-slate-400" />
                  <div>
                    {subscriptionData.paymentMethod ? (
                      <>
                        <p className="text-sm font-medium">
                          {formatCardBrand(subscriptionData.paymentMethod.brand)} ••••{" "}
                          {subscriptionData.paymentMethod.last4}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("subscriptionExpires")} {subscriptionData.paymentMethod.expMonth}/
                          {subscriptionData.paymentMethod.expYear}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">{t("noPaymentMethod")}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("addPaymentMethodToContinue")}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  onClick={handleManageBilling}
                  variant="secondary"
                  className="text-sm"
                >
                  {subscriptionData.paymentMethod ? t("update") : t("addPaymentMethod")}
                </Button>
              </div>
            </div>

            {/* Cancel Subscription Button */}
            {currentTier && subscriptionData.subscription.status === "active" && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  onClick={() => setShowCancelModal(true)}
                  variant="secondary"
                  className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
                >
                  {t("cancelSubscription")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <h2 className="mb-6 text-2xl font-semibold">{t("availablePlans")}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {(["basic", "advanced", "elite"] as TierId[]).map((tier) => {
            const isCurrent = isCurrentTier(tier);
            const isUpgrading = upgrading === tier;
            const syncAgent = agents.find((a) => a.key === "sync");
            const alohaAgent = agents.find((a) => a.key === "aloha");
            const studioAgent = agents.find((a) => a.key === "studio");
            const insightAgent = agents.find((a) => a.key === "insight");

            let description = "";
            if (tier === "basic") {
              description = `${t("startWith")} ${syncAgent?.name || t("agentSync")}.`;
            } else if (tier === "advanced") {
              description = `${t("unlock")} ${alohaAgent?.name || t("agentAloha")} & ${studioAgent?.name || t("agentStudio")}.`;
            } else {
              description = `${t("everythingPlus")} ${insightAgent?.name || t("agentInsight")}.`;
            }

            return (
              <Card
                key={tier}
                className={`relative flex flex-col ${
                  isCurrent
                    ? "ring-2 ring-slate-900 dark:ring-white"
                    : "hover:shadow-lg transition-shadow"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-slate-900">
                      {t("currentPlanBadge")}
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{TIER_NAMES[tier]}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-3xl font-semibold">
                      {formatPrice(BASE_PRICES[tier], language)}
                    </span>
                    <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                      /month
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 space-y-4">
                  <ul className="space-y-2 flex-1">
                    {TIER_FEATURES[tier].map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleUpgradeDowngrade(tier)}
                    disabled={isCurrent || isUpgrading}
                    className="w-full mt-auto"
                    variant={isCurrent ? "secondary" : "default"}
                  >
                    {isUpgrading
                      ? t("processing")
                      : isCurrent
                        ? t("currentPlanBadge")
                        : currentTier && BASE_PRICES[tier] > BASE_PRICES[currentTier as TierId]
                          ? t("upgrade")
                          : currentTier && BASE_PRICES[tier] < BASE_PRICES[currentTier as TierId]
                            ? t("downgrade")
                            : t("selectPlan")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        title={t("cancelSubscriptionTitle")}
        description={t("cancelSubscriptionConfirm")}
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{t("whatHappensWhenCancel")}</strong>
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
              <li>{t("continueAccessUntilEnd")}</li>
              <li>{t("willNotRenew")}</li>
              <li>{t("canReactivate")}</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleCancelSubscription}
              disabled={canceling}
              className="flex-1 bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
            >
              {canceling ? t("canceling") : t("yesCancelSubscription")}
            </Button>
            <Button
              onClick={() => setShowCancelModal(false)}
              variant="secondary"
              className="flex-1"
              disabled={canceling}
            >
              {t("keepSubscription")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

