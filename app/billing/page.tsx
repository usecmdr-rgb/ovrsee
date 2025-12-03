"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Calendar, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useSupabase } from "@/components/SupabaseProvider";
import { useAppState } from "@/context/AppStateContext";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CONTACT_EMAILS } from "@/config/contacts";
import type { CorePlanCode } from "@/lib/pricingConfig";

type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due" | "incomplete" | "incomplete_expired" | "unpaid";

interface SubscriptionInfo {
  planCode: CorePlanCode | null;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
}

export default function BillingPage() {
  const router = useRouter();
  const { supabase } = useSupabase();
  const { isAuthenticated, openAuthModal } = useAppState();
  const t = useTranslation();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      openAuthModal("login");
      return;
    }
    fetchSubscription();
  }, [isAuthenticated, openAuthModal]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setError("Please log in to view billing information");
        setLoading(false);
        return;
      }

      // Fetch subscription from database
      const { data: subscriptionData, error: subError } = await supabase
        .from("subscriptions")
        .select("plan, tier, status, current_period_end, trial_ends_at")
        .eq("user_id", session.user.id)
        .single();

      if (subError && subError.code !== "PGRST116") {
        // PGRST116 = not found, which is okay
        throw new Error(subError.message);
      }

      // Prefer new plan column when available, otherwise map legacy tier → plan
      const planCode: CorePlanCode | null = subscriptionData?.plan
        ? (subscriptionData.plan as CorePlanCode)
        : subscriptionData?.tier === "basic"
          ? "essentials"
          : subscriptionData?.tier === "advanced"
            ? "professional"
            : subscriptionData?.tier === "elite"
              ? "executive"
              : null;

      setSubscription({
        planCode,
        status: subscriptionData?.status as SubscriptionStatus | null,
        currentPeriodEnd: subscriptionData?.current_period_end || null,
        trialEndsAt: subscriptionData?.trial_ends_at || null,
      });
    } catch (err: any) {
      setError(err.message || "Failed to load subscription information");
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setPortalLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        openAuthModal("login");
        return;
      }

      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      alert(err.message || "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleChangePlan = () => {
    router.push("/pricing");
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getPlanLabel = (planCode: CorePlanCode | null) => {
    if (!planCode) return "No active plan";
    switch (planCode) {
      case "essentials":
        return "Essentials";
      case "professional":
        return "Professional";
      case "executive":
        return "Executive";
      default:
        return "Unknown";
    }
  };

  const getStatusLabel = (status: SubscriptionStatus | null) => {
    if (!status) return "Inactive";
    return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
  };

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8 px-4">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-semibold">Billing</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Manage your subscription and billing information
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold">{getPlanLabel(subscription?.planCode || null)}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Status: <span className="font-medium capitalize">{getStatusLabel(subscription?.status || null)}</span>
              </p>
              {subscription?.currentPeriodEnd && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Next billing date: {formatDate(subscription.currentPeriodEnd)}
                </p>
              )}
              {subscription?.trialEndsAt && (
                <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                  Trial ends: {formatDate(subscription.trialEndsAt)}
                </p>
              )}
            </div>
          </div>

          {/* Security Notice */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Billing is handled securely by Stripe. Your payment information is never stored on our servers.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="flex-1"
            >
              {portalLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Billing
                </>
              )}
            </Button>
            <Button
              onClick={handleChangePlan}
              variant="secondary"
              className="flex-1"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Change Plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Support Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>Contact our support team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Questions about billing? Contact{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.billing}`}
                className="text-primary hover:underline font-medium"
              >
                {CONTACT_EMAILS.billing}
              </a>
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Need technical support? Contact{" "}
              <a
                href={`mailto:${CONTACT_EMAILS.support}`}
                className="text-primary hover:underline font-medium"
              >
                {CONTACT_EMAILS.support}
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

