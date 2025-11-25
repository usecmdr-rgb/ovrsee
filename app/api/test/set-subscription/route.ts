import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { TierId } from "@/lib/stripe";

/**
 * Test endpoint to set a user's subscription tier
 * This endpoint will create the columns if they don't exist
 * 
 * Usage: POST /api/test/set-subscription
 * Body: { email: string, tier: "basic" | "advanced" | "elite", status?: "active" | "trialing" | "past_due" | "canceled" }
 */
export async function POST(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "This endpoint is only available in development" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, tier, status = "active" } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    if (!tier || !["basic", "advanced", "elite"].includes(tier)) {
      return NextResponse.json(
        { error: "Valid tier (basic, advanced, or elite) is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Find user by email
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    const user = authData.users.find(u => u.email === email);

    if (!user) {
      return NextResponse.json(
        { error: `User with email ${email} not found. Please create the user first.` },
        { status: 404 }
      );
    }

    const userId = user.id;

    // Try to update with subscription columns
    // If columns don't exist, we'll get an error and can guide the user
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        subscription_tier: tier as TierId,
        subscription_status: status,
      }, {
        onConflict: "id"
      });

    if (profileError) {
      // Check if it's a column missing error
      if (profileError.message.includes("subscription_tier") || 
          profileError.message.includes("subscription_status")) {
        return NextResponse.json({
          error: "Subscription columns not found in database",
          message: "Please run the migration SQL in your Supabase dashboard first",
          migrationSQL: `
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_tier TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_status TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'stripe_subscription_id'
    ) THEN
        ALTER TABLE profiles ADD COLUMN stripe_subscription_id TEXT;
    END IF;
END $$;
          `.trim()
        }, { status: 400 });
      }
      
      return NextResponse.json(
        { error: profileError.message || "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User subscription updated to ${tier} tier`,
      user: {
        id: userId,
        email: email,
        tier: tier,
        status: status,
      },
    });
  } catch (error: any) {
    console.error("Error in set-subscription:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

