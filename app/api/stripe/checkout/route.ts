import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { validateRequestBody, stripeCheckoutRequestSchema, createErrorResponse } from "@/lib/validation";
import {
  PLAN_PRICING,
  PRICING_CONFIG,
  getStripePriceId,
  mapTierToPlanCode,
  type BillingInterval,
  type CorePlanCode,
} from "@/lib/pricingConfig";
import { hasUserUsedEssentialsTrial } from "@/lib/trial-eligibility";
import Stripe from "stripe";

/**
 * POST /api/stripe/checkout
 * 
 * Creates a Stripe Checkout session for subscription purchase.
 * 
 * TRIAL POLICY:
 * - The 3-day free trial applies ONLY to Essentials (Sync) plan
 * - Professional and Executive plans NEVER include a free trial
 * - Each user can receive the Essentials trial at most once
 * - We track has_used_essentials_trial per user to prevent multiple trials
 * 
 * SECURITY:
 * - Requires user authentication (verifies session from cookies)
 * - Validates planCode and billingInterval input with Zod (tier/billingCycle supported for legacy clients)
 * - Uses Stripe Checkout (PCI-compliant, card data never touches our servers)
 * - Links Stripe customer to authenticated user
 * 
 * Request body:
 * - planCode: "essentials" | "professional" | "executive"
 * - billingInterval: "monthly" | "yearly" (optional, defaults to "monthly")
 *   (legacy: tier + billingCycle are still accepted and mapped to planCode/billingInterval)
 * 
 * Returns:
 * - sessionId: Stripe Checkout session ID
 * - url: Stripe Checkout URL to redirect user to
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user - throws if not authenticated
    const user = await requireAuthFromRequest(request);

    // Validate request body
    const validation = await validateRequestBody(request, stripeCheckoutRequestSchema);
    if (!validation.success) {
      return validation.error;
    }

    const {
      planCode: rawPlanCode,
      billingInterval,
      tier: legacyTier,
      billingCycle: legacyBillingInterval,
      seatCount,
      seats: seatData,
    } = validation.data as {
      planCode?: CorePlanCode;
      billingInterval?: BillingInterval;
      tier?: "free" | "basic" | "advanced" | "elite";
      billingCycle?: BillingInterval;
      seatCount?: number;
      seats?: Array<{
        tier: "basic" | "advanced" | "elite";
        email?: string;
        name?: string;
      }>;
    };

    // Canonical inputs (new API)
    let planCode: CorePlanCode | null = rawPlanCode ?? null;
    let interval: BillingInterval = billingInterval ?? legacyBillingInterval ?? "monthly";

    // Backwards compatibility: map legacy tier → planCode if planCode not provided
    if (!planCode) {
      if (!legacyTier || !["basic", "advanced", "elite"].includes(legacyTier)) {
        return createErrorResponse(
          "Invalid request. Provide a valid planCode (essentials, professional, executive) or tier (basic, advanced, elite).",
          400
        );
      }
      planCode = mapTierToPlanCode(legacyTier as "basic" | "advanced" | "elite") as CorePlanCode;
    }

    const userId = user.id; // Use authenticated user's ID, ignore any userId in request

    // Compute quantity from seatCount (default to 1 for backward compatibility)
    const quantity = seatCount && seatCount > 0 ? seatCount : 1;

    // Get Stripe price ID based on billing interval
    const priceId = getStripePriceId(planCode, interval);
    
    // Validate price ID: must be a non-empty string starting with "price_"
    // Never pass a number or empty string to Stripe
    if (!priceId || typeof priceId !== 'string' || priceId.trim() === '' || !priceId.startsWith('price_')) {
      console.error(`Invalid Stripe price ID for ${planCode} (${interval}):`, priceId, `(type: ${typeof priceId})`);
      return createErrorResponse(
        `Stripe price ID not configured for ${planCode} (${interval}). Please check your environment variables (STRIPE_PRICE_ID_${planCode.toUpperCase()}_${interval.toUpperCase()}).`,
        500
      );
    }
    
    // Double-check: ensure priceId is definitely a string and not accidentally a number
    const validatedPriceId = String(priceId).trim();
    if (!validatedPriceId.startsWith('price_')) {
      console.error(`Price ID validation failed for ${planCode} (${interval}):`, validatedPriceId);
      return createErrorResponse(
        `Invalid Stripe price ID format for ${planCode} (${interval}). Price IDs must start with "price_".`,
        500
      );
    }

    const supabase = getSupabaseServerClient();

    // Get or create Stripe customer
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      // PGRST116 = not found, which is okay
      console.error("Error fetching profile:", profileError);
      return createErrorResponse("Failed to fetch user profile", 500, profileError);
    }

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        metadata: {
          supabase_user_id: userId,
        },
        email: user.email || undefined,
      });

      customerId = customer.id;

      // Save customer ID to Supabase
      // Use upsert with onConflict to only update stripe_customer_id, avoiding trigger issues
      const { error: updateError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            stripe_customer_id: customerId,
          },
          {
            onConflict: "id",
            ignoreDuplicates: false,
          }
        );

      if (updateError) {
        // If upsert fails due to missing updated_at column, try simple update
        if (updateError.message?.includes("updated_at")) {
          const { error: simpleUpdateError } = await supabase
            .from("profiles")
            .update({ stripe_customer_id: customerId })
            .eq("id", userId);
          
          if (simpleUpdateError) {
            console.error("Error saving Stripe customer ID:", simpleUpdateError);
          }
        } else {
          console.error("Error saving Stripe customer ID:", updateError);
        }
        // Continue anyway - we can sync this later
      }
    }

    // Get plan config to check trial eligibility (use PRICING_CONFIG for hasTrial/trialDays)
    const planConfig = PRICING_CONFIG.plans[planCode];
    
    // Check if user is converting from a previous subscription/trial
    const { data: currentSubscription } = await supabase
      .from("subscriptions")
      .select("tier, status, trial_ends_at")
      .eq("user_id", userId)
      .single();

    const isTrialConversion = currentSubscription?.tier === "trial" || currentSubscription?.tier === "trial_expired";
    
    // ============================================
    // ESSENTIALS-ONLY TRIAL LOGIC
    // ============================================
    // The 3-day free trial applies ONLY to Essentials plan
    // Professional and Executive NEVER get a free trial
    const isEssentials = planCode === "essentials";
    const hasUsedTrial = await hasUserUsedEssentialsTrial(userId);
    const canUseTrial = isEssentials && !hasUsedTrial && !isTrialConversion;
    
    // Professional and Executive NEVER get trials - planConfig.hasTrial is false for them

    // Derive a legacy tier label for backwards compatibility in metadata
    const legacyTierForMetadata =
      legacyTier && ["basic", "advanced", "elite"].includes(legacyTier)
        ? legacyTier
        : (planCode === "essentials"
            ? "basic"
            : planCode === "professional"
              ? "advanced"
              : "elite");

    // Prepare subscription metadata
    const subscriptionMetadata: Record<string, string> = {
      tier: legacyTierForMetadata, // Keep legacy tier for backward compatibility
      planCode, // Store new plan code
      userId,
      billingInterval: interval, // Store billing interval
    };

    // Prepare subscription data
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: subscriptionMetadata,
    };

    // Apply trial_period_days ONLY for Essentials if eligible
    // Professional and Executive subscriptions NEVER include trial_period_days
    if (canUseTrial && planConfig.hasTrial && planConfig.trialDays && planConfig.trialDays > 0) {
      subscriptionData.trial_period_days = planConfig.trialDays; // 3 days for Essentials
      subscriptionMetadata.is_essentials_trial = "true";
    }

    // If converting from an existing trial/subscription, mark it
    // Upgrades from Essentials to Professional/Executive do NOT get a trial
    if (isTrialConversion) {
      subscriptionMetadata.converted_from_trial = "true";
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: validatedPriceId, // Use validated price ID (must start with "price_")
          quantity,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000"}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000"}/pricing`,
      metadata: {
        tier: legacyTierForMetadata, // Keep legacy tier for backward compatibility
        planCode, // Store new plan code
        billingInterval: interval, // Store billing interval for webhook processing
        userId, // Store userId in metadata for webhook processing
        is_trial_conversion: isTrialConversion ? "true" : "false",
        is_essentials_trial: canUseTrial ? "true" : "false", // Track if this is an Essentials trial
        seatCount: String(quantity), // Store seat count for webhook processing
        // Store seat emails if provided (for post-checkout invite creation)
        ...(seatData && seatData.length > 0
          ? {
              seatEmails: JSON.stringify(
                seatData
                  .filter((s) => s.email && s.email.trim() !== "")
                  .map((s) => ({ email: s.email, tier: s.tier, name: s.name }))
              ),
            }
          : {}),
      },
      // Apply trial_period_days ONLY for Essentials if eligible (Professional/Executive get no trial)
      subscription_data: subscriptionData,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    // Handle authentication errors
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }

    return createErrorResponse(
      "Failed to create checkout session",
      500,
      error
    );
  }
}





