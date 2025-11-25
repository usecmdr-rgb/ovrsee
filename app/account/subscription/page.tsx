"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Calendar, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { useSupabase } from "@/components/SupabaseProvider";
import { useAppState } from "@/context/AppStateContext";
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
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      openAuthModal("login");
      return;
    }
    fetchSubscriptionData();
  }, [isAuthenticated]);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setError("Please log in to view your subscription");
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/subscription?userId=${session.user.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load subscription details");
      }

      setSubscriptionData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load subscription details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      alert(err.message || "Failed to start checkout. Please try again.");
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
        throw new Error(data.error || "Failed to cancel subscription");
      }

      setShowCancelModal(false);
      // Refresh subscription data
      await fetchSubscriptionData();
      alert("Your subscription has been scheduled for cancellation at the end of the billing period.");
    } catch (err: any) {
      alert(err.message || "Failed to cancel subscription. Please try again.");
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
        alert("Failed to open customer portal. Please try again.");
        return;
      }

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      alert("Failed to open customer portal. Please try again.");
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

  const getTierDisplayName = (tier: SubscriptionTier) => {
    if (!tier) return "Free";
    return TIER_NAMES[tier] || tier;
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
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold">Subscription & Billing</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Manage your subscription plan, payment methods, and billing information.
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
            Try again
          </button>
        </div>
      )}

      {/* Current Plan Section */}
      {subscriptionData && (
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your active subscription details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{getTierDisplayName(currentTier)}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Status:{" "}
                  <span className="font-medium capitalize">
                    {subscriptionData.subscription.status || "Inactive"}
                  </span>
                </p>
                {subscriptionData.subscription.currentPeriodEnd && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Renews on: {formatDate(subscriptionData.subscription.currentPeriodEnd)}
                  </p>
                )}
                {subscriptionData.subscription.cancelAtPeriodEnd && (
                  <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                    Subscription will cancel at the end of the billing period
                  </p>
                )}
                {subscriptionData.subscription.trialEnd && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Trial ends: {formatDate(subscriptionData.subscription.trialEnd)}
                  </p>
                )}
              </div>
              {currentTier && (
                <div className="text-right">
                  <p className="text-2xl font-semibold">
                    {formatPrice(BASE_PRICES[currentTier], language)}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">per month</p>
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
                          Expires {subscriptionData.paymentMethod.expMonth}/
                          {subscriptionData.paymentMethod.expYear}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">No payment method on file</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Add a payment method to continue your subscription
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
                  {subscriptionData.paymentMethod ? "Update" : "Add Payment Method"}
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
                  Cancel Subscription
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <h2 className="mb-6 text-2xl font-semibold">Available Plans</h2>
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
              description = `Start with ${syncAgent?.name || "Sync"}.`;
            } else if (tier === "advanced") {
              description = `Unlock ${alohaAgent?.name || "Aloha"} & ${studioAgent?.name || "Studio"}.`;
            } else {
              description = `Everything, plus ${insightAgent?.name || "Insight"}.`;
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
                      Current Plan
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
                      ? "Processing..."
                      : isCurrent
                        ? "Current Plan"
                        : currentTier && BASE_PRICES[tier] > BASE_PRICES[currentTier as TierId]
                          ? "Upgrade"
                          : currentTier && BASE_PRICES[tier] < BASE_PRICES[currentTier as TierId]
                            ? "Downgrade"
                            : "Select Plan"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        title="Cancel Subscription"
        description="Are you sure you want to cancel your subscription?"
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>What happens when you cancel:</strong>
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
              <li>You'll continue to have access until the end of your current billing period</li>
              <li>Your subscription will not renew automatically</li>
              <li>You can reactivate your subscription at any time before the period ends</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleCancelSubscription}
              disabled={canceling}
              className="flex-1 bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
            >
              {canceling ? "Canceling..." : "Yes, Cancel Subscription"}
            </Button>
            <Button
              onClick={() => setShowCancelModal(false)}
              variant="secondary"
              className="flex-1"
              disabled={canceling}
            >
              Keep Subscription
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

