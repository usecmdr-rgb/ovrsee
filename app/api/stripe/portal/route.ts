import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { createErrorResponse } from "@/lib/validation";

/**
 * POST /api/stripe/portal
 * 
 * Creates a Stripe Billing Portal session for subscription management.
 * 
 * SECURITY:
 * - Requires user authentication
 * - User can only access their own billing portal
 * 
 * Returns:
 * - url: Stripe Billing Portal URL to redirect user to
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user - throws if not authenticated
    const user = await requireAuthFromRequest(request);
    const userId = user.id; // Use authenticated user's ID

    const supabase = getSupabaseServerClient();

    // Get customer ID from Supabase
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return createErrorResponse("User profile not found", 404, profileError);
    }

    if (!profile.stripe_customer_id) {
      return createErrorResponse(
        "No Stripe customer found. Please create a subscription first.",
        404
      );
    }

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000"}/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    // Handle authentication errors
    if (error.message?.includes("Unauthorized")) {
      return createErrorResponse("Authentication required", 401);
    }

    return createErrorResponse(
      "Failed to create billing portal session",
      500,
      error
    );
  }
}





