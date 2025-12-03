import { NextRequest, NextResponse } from "next/server";
import { stripe, tierConfig, type TierId } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import {
  hasEmailUsedTrial,
  markTrialAsUsed,
  isUserOnActiveTrial,
  hasUserUsedEssentialsTrial,
} from "@/lib/trial-eligibility";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * POST /api/trial/start
 * 
 * Starts a 3-day free trial for Essentials plan ONLY.
 * 
 * TRIAL POLICY:
 * - The 3-day free trial applies ONLY to Essentials (Sync) plan
 * - Professional and Executive plans do NOT have free trials
 * - Each user can receive the Essentials trial at most once
 * - We track has_used_essentials_trial per user to prevent multiple trials
 * 
 * SECURITY & TRIAL ENFORCEMENT:
 * - User must be authenticated
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

    // TRIAL POLICY: Only Essentials (basic) plan includes a free trial
    // Professional and Executive do NOT have free trials
    if (tier !== "basic") {
      return NextResponse.json(
        {
          error: "Free trial is only available for Essentials plan",
          code: "TRIAL_NOT_AVAILABLE",
          message: "Only Essentials plan includes a 3-day free trial. Professional and Executive plans require immediate payment.",
        },
        { status: 400 }
      );
    }

    // ============================================
    // ONE-TIME TRIAL ENFORCEMENT - ESSENTIALS ONLY
    // ============================================
    // Check if user has already used their Essentials trial
    // Only Essentials plan includes a free trial
    const hasUsedEssentialsTrial = await hasUserUsedEssentialsTrial(userId);
    
    if (hasUsedEssentialsTrial) {
      return NextResponse.json(
        {
          error: "You have already used your Essentials free trial",
          code: "TRIAL_ALREADY_USED",
          message:
            "Each account can only use the Essentials free trial once. Please choose a paid plan to continue.",
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
        planCode: "essentials", // Mark as Essentials plan
        userId,
        is_trial: "true",
        is_essentials_trial: "true", // Mark as Essentials trial
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
    // MARK ESSENTIALS TRIAL AS USED (ONE-TIME ENFORCEMENT)
    // ============================================
    // This flag is NEVER reset, even if:
    // - Trial ends
    // - User cancels
    // - Account is deleted
    // This prevents the same account from getting another Essentials trial
    // Also mark the generic has_used_trial for backward compatibility
    await markTrialAsUsed(userId, userEmail);
    
    // Mark Essentials trial as used specifically
    const { error: essentialsTrialError } = await supabase
      .from("profiles")
      .update({ has_used_essentials_trial: true })
      .eq("id", userId);
    
    if (essentialsTrialError) {
      // Handle missing column error gracefully
      if (essentialsTrialError.code !== '42703') {
        console.error("Error marking Essentials trial as used:", essentialsTrialError);
      }
    }

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


