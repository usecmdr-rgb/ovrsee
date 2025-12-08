"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Calendar,
  Loader2,
  AlertCircle,
  ExternalLink,
  Users,
  CheckCircle2,
  XCircle,
  Receipt,
} from "lucide-react";
import { useSupabase } from "@/components/SupabaseProvider";
import { useAppState } from "@/context/AppStateContext";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CONTACT_EMAILS } from "@/config/contacts";
import type { CorePlanCode } from "@/lib/pricingConfig";
import { formatPrice } from "@/lib/currency";
import { PLAN_PRICING } from "@/lib/pricingConfig";
import TeamSeatsSection from "@/components/subscription/TeamSeatsSection";
import BillingPreview from "@/components/subscription/BillingPreview";
import { BillingIntervalProvider } from "@/components/pricing/BillingIntervalContext";

type SubscriptionStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

interface SubscriptionData {
  subscription: {
    tier: string | null;
    planCode: CorePlanCode | null;
    status: SubscriptionStatus | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: string | null;
  };
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  isWorkspaceOwner: boolean;
  workspaceId: string | null;
  teamMemberCount?: number;
}

export default function BillingPage() {
  const router = useRouter();
  const { supabase } = useSupabase();
  const { isAuthenticated, openAuthModal, language } = useAppState();
  const t = useTranslation();
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      openAuthModal("login");
      return;
    }
    fetchSubscriptionData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, openAuthModal]);

  const fetchSubscriptionData = async () => {
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

      // Only fetch from database - no Stripe calls
      const { data: subscriptionFromDb } = await supabase
        .from("subscriptions")
        .select("plan, tier, status, current_period_end, cancel_at_period_end, trial_end")
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

      // Determine planCode - prefer plan from DB, then tier mapping
      let planCode: CorePlanCode | null = null;
      if (subscriptionFromDb?.plan) {
        planCode = subscriptionFromDb.plan as CorePlanCode;
      } else if (subscriptionFromDb?.tier) {
        // Map tier to planCode
        const tier = subscriptionFromDb.tier;
        planCode =
          tier === "basic"
            ? "essentials"
            : tier === "advanced"
              ? "professional"
              : tier === "elite"
                ? "executive"
                : null;
      }

      setSubscriptionData({
        subscription: {
          tier: subscriptionFromDb?.tier || null,
          planCode,
          status: (subscriptionFromDb?.status as SubscriptionStatus) || null,
          currentPeriodEnd: subscriptionFromDb?.current_period_end || null,
          cancelAtPeriodEnd: subscriptionFromDb?.cancel_at_period_end || false,
          trialEnd: subscriptionFromDb?.trial_end || null,
        },
        paymentMethod: null, // Don't fetch payment method unless user wants to update
        isWorkspaceOwner: !!workspace,
        workspaceId: workspace?.id || null,
        teamMemberCount, // Add team member count
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

  const formatCardBrand = (brand: string) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  const getPlanPrice = (planCode: CorePlanCode | null, billingInterval: "monthly" | "yearly" = "monthly") => {
    if (!planCode) return null;
    const plan = PLAN_PRICING[planCode];
    if (!plan) return null;
    return billingInterval === "yearly" ? plan.yearlyAmount : plan.monthlyAmount;
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
    <BillingIntervalProvider>
      <div className="mx-auto max-w-6xl space-y-8 py-8 px-4">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Minimal Subscription Info */}
        {subscriptionData && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">
                      {getPlanLabel(subscriptionData.subscription.planCode || null)}
                    </h3>
                    {subscriptionData.subscription.status === "active" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    )}
                  </div>
                  
                  {/* Team Members Info */}
                  {subscriptionData.isWorkspaceOwner && subscriptionData.teamMemberCount !== undefined && subscriptionData.teamMemberCount > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {subscriptionData.teamMemberCount} {subscriptionData.teamMemberCount === 1 ? "team member" : "team members"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons - Only show when subscription is active */}
                {subscriptionData.subscription.status === "active" && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={handleManageBilling} disabled={portalLoading} variant="secondary" className="text-sm">
                      {portalLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opening...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Update Subscription
                        </>
                      )}
                    </Button>
                    <Button onClick={handleChangePlan} variant="secondary" className="text-sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Change Plan
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Team Management Section - Only show if workspace owner */}
        {subscriptionData?.isWorkspaceOwner && (
          <div>
            <TeamSeatsSection />
          </div>
        )}
      </div>
    </BillingIntervalProvider>
  );
}
