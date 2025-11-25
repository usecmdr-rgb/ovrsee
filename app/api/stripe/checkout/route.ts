import { NextRequest, NextResponse } from "next/server";
import { stripe, tierConfig, type TierId } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { validateRequestBody, stripeCheckoutRequestSchema, createErrorResponse } from "@/lib/validation";

/**
 * POST /api/stripe/checkout
 * 
 * Creates a Stripe Checkout session for subscription purchase.
 * 
 * SECURITY:
 * - Requires user authentication (verifies session from cookies)
 * - Validates tier input with Zod
 * - Uses Stripe Checkout (PCI-compliant, card data never touches our servers)
 * - Links Stripe customer to authenticated user
 * 
 * Request body:
 * - tier: "basic" | "advanced" | "elite"
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

    const { tier } = validation.data;
    const userId = user.id; // Use authenticated user's ID, ignore any userId in request

    // Validate tier
    if (!tier || !["basic", "advanced", "elite"].includes(tier)) {
      return createErrorResponse("Invalid tier. Must be basic, advanced, or elite", 400);
    }

    const tierData = tierConfig[tier as TierId];
    
    if (!tierData.priceId) {
      return createErrorResponse(
        `Stripe price ID not configured for tier: ${tier}`,
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
      const { error: updateError } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          stripe_customer_id: customerId,
        });

      if (updateError) {
        console.error("Error saving Stripe customer ID:", updateError);
        // Continue anyway - we can sync this later
      }
    }

    // Check if user is converting from trial
    const { data: currentSubscription } = await supabase
      .from("subscriptions")
      .select("tier, status, trial_ends_at")
      .eq("user_id", userId)
      .single();

    const isTrialConversion = currentSubscription?.tier === "trial" || currentSubscription?.tier === "trial_expired";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: tierData.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/pricing?canceled=true`,
      metadata: {
        tier,
        userId, // Store userId in metadata for webhook processing
        is_trial_conversion: isTrialConversion ? "true" : "false",
      },
      // If converting from trial, subscription starts immediately (no trial period in Stripe)
      subscription_data: isTrialConversion ? {
        metadata: {
          tier,
          userId,
          converted_from_trial: "true",
        },
      } : undefined,
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





