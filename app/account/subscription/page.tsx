"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Calendar, Check, X, AlertCircle, Loader2, Users } from "lucide-react";
import { useSupabase } from "@/components/SupabaseProvider";
import { useAppState } from "@/context/AppStateContext";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/Modal";
import TeamSeatsSection from "@/components/subscription/TeamSeatsSection";
import BillingPreview from "@/components/subscription/BillingPreview";
import PlanAdvisor from "@/components/pricing/PlanAdvisor";
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

      // Only fetch from database - no Stripe calls
      const { data: subscriptionFromDb } = await supabase
        .from("subscriptions")
        .select("tier, status, current_period_end, cancel_at_period_end, trial_end")
        .eq("user_id", session.user.id)
        .single();

      // Check if user is workspace owner and get team member count
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_user_id", session.user.id)
        .single();

      let teamMemberCount = 0;
      if (workspace) {
        const { count } = await supabase
          .from("workspace_seats")
          .select("*", { count: "exact", head: true })
          .eq("workspace_id", workspace.id)
          .in("status", ["active", "pending"]);
        teamMemberCount = count || 0;
      }

      // Build subscription data without Stripe calls
      setSubscriptionData({
        subscription: {
          tier: subscriptionFromDb?.tier || null,
          status: subscriptionFromDb?.status || null,
          currentPeriodEnd: subscriptionFromDb?.current_period_end || null,
          cancelAtPeriodEnd: subscriptionFromDb?.cancel_at_period_end || false,
          trialEnd: subscriptionFromDb?.trial_end || null,
        },
        paymentMethod: null, // Don't fetch payment method unless user wants to update
        teamMemberCount, // Add team member count
      });
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

  // Removed handleUpgradeDowngrade - users should use "Update Subscription" button to change plans

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

      {/* Minimal Subscription Info */}
      {subscriptionData && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{getTierDisplayName(currentTier)}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t("status")}{" "}
                  <span className="font-medium capitalize">
                    {subscriptionData.subscription.status || t("inactive")}
                  </span>
                </p>
                
                {/* Team Members Info */}
                {(subscriptionData as any)?.teamMemberCount !== undefined && (subscriptionData as any).teamMemberCount > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {(subscriptionData as any).teamMemberCount} {(subscriptionData as any).teamMemberCount === 1 ? "team member" : "team members"}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons - Only show when subscription is active */}
              {currentTier && subscriptionData.subscription.status === "active" && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={handleManageBilling}
                    variant="secondary"
                    className="text-sm"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t("updateSubscription") || "Update Subscription"}
                  </Button>
                  <Button
                    onClick={() => setShowCancelModal(true)}
                    variant="secondary"
                    className="text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950"
                  >
                    {t("cancelSubscription")}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team & Seats Section */}
      <TeamSeatsSection />

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

