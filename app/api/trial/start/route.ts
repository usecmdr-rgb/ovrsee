import { NextRequest, NextResponse } from "next/server";
import { stripe, tierConfig, type TierId } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import {
  hasEmailUsedTrial,
  markTrialAsUsed,
  isUserOnActiveTrial,
} from "@/lib/trial-eligibility";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * POST /api/trial/start
 * 
 * Starts a 3-day free trial for a user.
 * 
 * SECURITY & TRIAL ENFORCEMENT:
 * - User must be authenticated
 * - Email-based trial eligibility check (one trial per email, ever)
 * - Server-side enforcement prevents trial abuse
 * - Cannot restart trial even if account is deleted and recreated
 * 
 * Returns:
 * - success: boolean
 * - subscriptionId: Stripe subscription ID
 * - trialEndsAt: ISO timestamp when trial ends
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication - get user from session
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const userEmail = user.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const { tier } = await request.json();

    if (!tier || !["basic", "advanced", "elite"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    // ============================================
    // ONE-TIME TRIAL ENFORCEMENT
    // ============================================
    // Check if this email has already used a trial
    // This check survives account deletion and prevents trial abuse
    const emailHasUsedTrial = await hasEmailUsedTrial(userEmail);
    if (emailHasUsedTrial) {
      return NextResponse.json(
        {
          error: "You have already used your free trial",
          code: "TRIAL_ALREADY_USED",
          message:
            "Each email address can only use the free trial once. Please choose a paid plan to continue.",
        },
        { status: 403 }
      );
    }

    // Check if user is already on an active trial
    const isOnTrial = await isUserOnActiveTrial(userId);
    if (isOnTrial) {
      return NextResponse.json(
        {
          error: "You already have an active trial",
          code: "TRIAL_ALREADY_ACTIVE",
        },
        { status: 400 }
      );
    }

    const tierData = tierConfig[tier as TierId];
    const supabase = getSupabaseServerClient();

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        metadata: {
          supabase_user_id: userId,
        },
      });

      customerId = customer.id;

      // Save customer ID to Supabase
      await supabase
        .from("profiles")
        .upsert({
          id: userId,
          stripe_customer_id: customerId,
        });
    }

    // Check if user already has an active subscription or trial in Stripe
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
    });

    if (existingSubscriptions.data.length > 0) {
      const activeSub = existingSubscriptions.data[0];
      if (activeSub.status === "active" || activeSub.status === "trialing") {
        return NextResponse.json(
          { error: "You already have an active subscription or trial" },
          { status: 400 }
        );
      }
    }

    // Create subscription with 3-day free trial
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: tierData.priceId,
        },
      ],
      trial_period_days: 3,
      metadata: {
        tier,
        userId,
        is_trial: "true",
      },
    });

    // Calculate trial start and end dates
    const trialStartedAt = subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : new Date().toISOString();
    const trialEndsAt = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // ============================================
    // MARK TRIAL AS USED (ONE-TIME ENFORCEMENT)
    // ============================================
    // This flag is NEVER reset, even if:
    // - Trial ends
    // - User cancels
    // - Account is deleted
    // This prevents the same email from getting another trial
    await markTrialAsUsed(userId, userEmail);

    // Store subscription info in Supabase
    // IMPORTANT: Set trial_started_at to mark when user activated (for metrics filtering)
    await supabase.from("profiles").update({
      subscription_tier: tier,
      subscription_status: "trialing",
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      stripe_subscription_id: subscription.id,
    }).eq("id", userId);
    
    // Also create/update subscription record in subscriptions table
    await supabase.from("subscriptions").upsert({
      user_id: userId,
      tier: tier,
      status: "trialing",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      trial_started_at: trialStartedAt,
      trial_ends_at: trialEndsAt,
      cancel_at_period_end: false,
      current_period_start: subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : null,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      trialEndsAt: trialEndsAt,
    });
  } catch (error: any) {
    console.error("Trial start error:", error);
    
    // Handle authentication errors
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to start trial" },
      { status: 500 }
    );
  }
}


