import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getUserSession } from "@/lib/auth/session";
import { ensureUserProfileAndSubscription } from "@/lib/auth/signup";

/**
 * POST /api/auth/login
 * Authenticates user and syncs subscription data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Authenticate user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Invalid email or password" },
        { status: 401 }
      );
    }

    const userId = authData.user.id;

    // Ensure user has profile and subscription (for existing users who might not have them)
    await ensureUserProfileAndSubscription(userId, email);

    // Get complete session data (this will sync subscription with Stripe if needed)
    const session = await getUserSession(userId, email);

    if (!session) {
      return NextResponse.json(
        { error: "Failed to load user session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      session,
      accessToken: authData.session?.access_token,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to authenticate" },
      { status: 500 }
    );
  }
}

