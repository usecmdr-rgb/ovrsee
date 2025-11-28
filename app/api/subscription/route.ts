import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import Stripe from "stripe";

import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { createErrorResponse } from "@/lib/validation";
import {
  isTrialExpired,
  expireTrial,
  hasEmailUsedTrial,
} from "@/lib/trial-eligibility";
import { getDataRetentionStatus } from "@/lib/subscription/data-retention";

/**
 * GET /api/subscription
 * 
 * Fetches subscription details for the authenticated user.
 * 
 * SECURITY:
 * - Requires user authentication
 * - User can only access their own subscription data
 * 
 * Returns:
 * - subscription: Subscription details (tier, status, period, etc.)
 * - paymentMethod: Payment method details (brand, last4, exp)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user - throws if not authenticated
    // User can only access their own subscription data
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const userEmail = user.email;

    const supabase = getSupabaseServerClient();

    // Get user profile with subscription info
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("subscription_tier, subscription_status, stripe_customer_id, stripe_subscription_id, trial_ends_at, has_used_trial")
      .eq("id", userId)
      .single();

    const buildDefaultResponse = async () => {
      const hasUsedTrialFallback = userEmail ? await hasEmailUsedTrial(userEmail) : false;
      const retentionStatus = await getDataRetentionStatus(userId);

      return NextResponse.json({
        subscription: {
          tier: null,
          status: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          trialEnd: null,
        },
        paymentMethod: null,
        trial: {
          hasUsedTrial: hasUsedTrialFallback,
          isExpired: false,
        },
        retention: {
          isInRetentionWindow: retentionStatus.hasRetentionWindow && !retentionStatus.isExpired,
          daysRemaining: retentionStatus.daysRemaining,
          isDataCleared: retentionStatus.isDataCleared,
          reason: retentionStatus.reason,
        },
      });
    };

    if (profileError) {
      console.warn("No profile found for user, returning default subscription state", {
        userId,
        code: profileError.code,
        message: profileError.message,
      });
    }

    if (!profile) {
      return buildDefaultResponse();
    }

    // ============================================
    // TRIAL EXPIRATION CHECK
    // ============================================
    // If user is on a trial, check if it has expired
    // This ensures expired trials are automatically transitioned
    if (
      (profile.subscription_tier === "trial" || profile.subscription_tier === "trial_expired") ||
      profile.subscription_status === "trialing"
    ) {
      const trialExpired = await isTrialExpired(userId);
      if (trialExpired) {
        // Automatically expire the trial
        await expireTrial(userId);
        // Update profile reference for response
        profile.subscription_tier = "trial_expired";
        profile.subscription_status = "expired";
      }
    }

    // If no Stripe customer, return basic info
    if (!profile.stripe_customer_id) {
      return NextResponse.json({
        subscription: {
          tier: profile.subscription_tier || null,
          status: profile.subscription_status || null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
        paymentMethod: null,
      });
    }

    // Fetch subscription details from Stripe
    let subscription: Stripe.Subscription | null = null;
    let paymentMethod: Stripe.PaymentMethod | null = null;

    if (profile.stripe_subscription_id) {
      try {
        subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
          expand: ["default_payment_method"],
        });

        // Get payment method if available
        if (subscription.default_payment_method) {
          const pm = subscription.default_payment_method;
          if (typeof pm === "string") {
            paymentMethod = await stripe.paymentMethods.retrieve(pm);
          } else {
            paymentMethod = pm as Stripe.PaymentMethod;
          }
        }
      } catch (error) {
        console.error("Error fetching Stripe subscription:", error);
        // Continue without subscription details
      }
    }

    // If no subscription but we have a customer, try to get default payment method
    if (!paymentMethod && profile.stripe_customer_id) {
      try {
        const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
        if (typeof customer !== "string" && !customer.deleted && customer.invoice_settings?.default_payment_method) {
          const pmId = customer.invoice_settings.default_payment_method;
          if (typeof pmId === "string") {
            paymentMethod = await stripe.paymentMethods.retrieve(pmId);
          }
        }
      } catch (error) {
        console.error("Error fetching default payment method:", error);
      }
    }

    // Format payment method info
    let paymentMethodInfo = null;
    if (paymentMethod && paymentMethod.type === "card" && paymentMethod.card) {
      paymentMethodInfo = {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
      };
    }

    // Get trial eligibility check (userEmail already declared above)
    const hasUsedTrial = userEmail
      ? await hasEmailUsedTrial(userEmail)
      : profile.has_used_trial || false;

    // Get data retention status
    const retentionStatus = await getDataRetentionStatus(userId);

    return NextResponse.json({
      subscription: {
        tier: profile.subscription_tier || subscription?.metadata?.tier || null,
        status: subscription?.status || profile.subscription_status || null,
        currentPeriodEnd: subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
        trialEnd: subscription?.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : profile.trial_ends_at || null,
      },
      paymentMethod: paymentMethodInfo,
      trial: {
        hasUsedTrial,
        isExpired: profile.subscription_tier === "trial_expired",
      },
      retention: {
        isInRetentionWindow: retentionStatus.hasRetentionWindow && !retentionStatus.isExpired,
        daysRemaining: retentionStatus.daysRemaining,
        isDataCleared: retentionStatus.isDataCleared,
        reason: retentionStatus.reason,
      },
    });
  } catch (error: any) {
    // Handle authentication errors
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }

    return createErrorResponse(
      "Failed to fetch subscription details",
      500,
      error
    );
  }
}

