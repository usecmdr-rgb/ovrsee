import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * GET /api/auth/check-duplicates
 * 
 * Diagnostic endpoint to check for duplicate accounts/profiles for the authenticated user.
 * This helps identify if there are multiple accounts with the same email.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userEmail = user.email;
    const userId = user.id;

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Check for multiple auth users with the same email
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    const duplicateAuthUsers = authUsers?.users.filter(u => 
      u.email?.toLowerCase() === userEmail.toLowerCase()
    ) || [];

    // Check for multiple profiles with the same email
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, created_at, updated_at")
      .eq("email", userEmail);

    // Check for multiple subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select("id, user_id, tier, status, created_at")
      .eq("user_id", userId);

    // Check for multiple workspaces for this user
    const { data: workspaces, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, owner_id, name, created_at")
      .eq("owner_id", userId);

    return NextResponse.json({
      user: {
        id: userId,
        email: userEmail,
      },
      diagnostics: {
        authUsers: {
          total: duplicateAuthUsers.length,
          users: duplicateAuthUsers.map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            providers: u.app_metadata?.providers || [],
          })),
          hasDuplicates: duplicateAuthUsers.length > 1,
        },
        profiles: {
          total: profiles?.length || 0,
          profiles: profiles || [],
          hasDuplicates: (profiles?.length || 0) > 1,
        },
        subscriptions: {
          total: subscriptions?.length || 0,
          subscriptions: subscriptions || [],
          hasDuplicates: (subscriptions?.length || 0) > 1,
        },
        workspaces: {
          total: workspaces?.length || 0,
          workspaces: workspaces || [],
          hasDuplicates: (workspaces?.length || 0) > 1,
        },
      },
      issues: {
        hasDuplicateAuthUsers: duplicateAuthUsers.length > 1,
        hasDuplicateProfiles: (profiles?.length || 0) > 1,
        hasMultipleSubscriptions: (subscriptions?.length || 0) > 1,
        hasMultipleWorkspaces: (workspaces?.length || 0) > 1,
        profileMismatch: !profiles?.some(p => p.id === userId),
      },
    });
  } catch (error: any) {
    console.error("Error checking duplicates:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check duplicates" },
      { status: 500 }
    );
  }
}



