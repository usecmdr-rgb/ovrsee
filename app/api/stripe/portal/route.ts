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
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    // If profile doesn't exist, try to create it
    if (profileError && profileError.code === 'PGRST116') {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      if (authUser?.user?.email) {
        const { data: newProfile } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            email: authUser.user.email,
          })
          .select("stripe_customer_id")
          .single();
        if (newProfile) {
          profile = newProfile;
          profileError = null;
        }
      }
    }

    if (profileError || !profile) {
      return createErrorResponse("User profile not found", 404, profileError);
    }

    if (!profile.stripe_customer_id) {
      // Return a friendly message instead of an error
      return NextResponse.json({
        error: "No active subscription found. Please create a subscription first.",
        code: "NO_SUBSCRIPTION",
        message: "You don't have an active subscription yet. Visit the pricing page to get started.",
      }, { status: 200 }); // Return 200 so UI can handle it gracefully
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





