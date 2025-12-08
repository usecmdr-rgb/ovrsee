"use client";

import { useSupabase } from "@/components/SupabaseProvider";
import { useAppState } from "@/context/AppStateContext";
import type { CorePlanCode, BillingInterval } from "@/lib/pricingConfig";

export function useStartCheckout() {
  const { supabase } = useSupabase();
  const { isAuthenticated, openAuthModal } = useAppState();

  const startCheckout = async (planCode: CorePlanCode, billingInterval: BillingInterval, seatCount?: number) => {
    if (!isAuthenticated) {
      openAuthModal("signup");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      openAuthModal("signup");
      return;
    }

    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planCode,
        billingInterval,
        ...(seatCount && seatCount > 0 ? { seatCount } : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to create checkout session");
    }

    if (data.url) {
      window.location.href = data.url;
    }
  };

  return { startCheckout };
}


