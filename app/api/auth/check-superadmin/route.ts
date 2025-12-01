import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSuperAdminEmail } from "@/lib/config/superAdmins";
import { SUPER_ADMIN_EMAILS } from "@/lib/config/superAdmins";

/**
 * GET /api/auth/check-superadmin
 * 
 * Diagnostic endpoint to check if the current user is recognized as a superadmin
 * and verify superadmin configuration
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  // Create Supabase client to check session
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Don't set cookies in GET request
      },
    },
  });

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      error: sessionError?.message || "No session found",
      message: "Please log in to check superadmin status",
      configuration: {
        superAdminEmails: SUPER_ADMIN_EMAILS,
        checkFunction: "isSuperAdminEmail() is available",
      },
    });
  }

  const userEmail = session.user.email;
  const userId = session.user.id;
  const isSuperAdmin = userEmail ? isSuperAdminEmail(userEmail) : false;

  // Detailed check
  const emailCheck = {
    rawEmail: userEmail,
    lowercasedEmail: userEmail?.toLowerCase(),
    isInList: userEmail ? SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase() as any) : false,
    functionResult: isSuperAdmin,
  };

  return NextResponse.json({
    authenticated: true,
    user: {
      id: userId,
      email: userEmail,
    },
    superadmin: {
      isSuperAdmin,
      emailCheck,
      configuredEmails: SUPER_ADMIN_EMAILS,
    },
    configuration: {
      superAdminEmails: SUPER_ADMIN_EMAILS,
      emailMatch: emailCheck,
    },
    recommendations: isSuperAdmin
      ? ["✅ You are recognized as a superadmin. You should have access to all features."]
      : [
          "❌ You are NOT recognized as a superadmin.",
          `Your email: ${userEmail}`,
          `Configured superadmin emails: ${SUPER_ADMIN_EMAILS.join(", ")}`,
          "Check if your email matches exactly (case-insensitive).",
        ],
  });
}

