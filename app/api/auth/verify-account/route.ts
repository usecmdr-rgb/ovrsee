import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/auth/verify-account
 * 
 * Verifies that the authenticated user's account is properly set up
 * with all required data (profile, subscription, workspace)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const userEmail = user.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Check profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    // Check subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Check workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("owner_user_id", userId)
      .single();

    // Check auth user details
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: userEmail,
        created_at: authUser?.user?.created_at,
        last_sign_in_at: authUser?.user?.last_sign_in_at,
        providers: authUser?.user?.app_metadata?.providers || [],
      },
      accountStatus: {
        hasProfile: !!profile && !profileError,
        hasSubscription: !!subscription && !subError,
        hasWorkspace: !!workspace && !workspaceError,
        profile: profile || null,
        subscription: subscription || null,
        workspace: workspace || null,
      },
      errors: {
        profileError: profileError?.message || null,
        subscriptionError: subError?.message || null,
        workspaceError: workspaceError?.message || null,
        authError: authError?.message || null,
      },
      isComplete: !!profile && !!subscription && !!workspace,
    });
  } catch (error: any) {
    console.error("Error verifying account:", error);
    return NextResponse.json(
      { 
        error: error.message || "Failed to verify account",
        success: false 
      },
      { status: 500 }
    );
  }
}




