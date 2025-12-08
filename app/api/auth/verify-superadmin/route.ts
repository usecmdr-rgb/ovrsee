import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { isSuperAdminEmail, SUPER_ADMIN_EMAILS } from "@/lib/config/superAdmins";
import { getUserAccessibleAgents, isSuperAdmin } from "@/lib/auth";

/**
 * GET /api/auth/verify-superadmin
 * 
 * Comprehensive verification endpoint to check superadmin status
 * Tests all the different ways superadmin is checked in the codebase
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
      message: "Please log in to verify superadmin status",
      configuration: {
        superAdminEmails: SUPER_ADMIN_EMAILS,
      },
    });
  }

  const userEmail = session.user.email;
  const userId = session.user.id;

  // Test 1: Direct email check
  const directCheck = isSuperAdminEmail(userEmail);
  
  // Test 2: Using lib/auth.ts isSuperAdmin function
  const authLibCheck = isSuperAdmin(userEmail);
  
  // Test 3: Check via getUserAccessibleAgents (should return all agents for superadmin)
  const serverSupabase = getSupabaseServerClient();
  const accessibleAgents = await getUserAccessibleAgents(userId, userEmail);
  const hasAllAgents = accessibleAgents.length === 4 && 
    accessibleAgents.includes("sync") && 
    accessibleAgents.includes("aloha") && 
    accessibleAgents.includes("studio") && 
    accessibleAgents.includes("insight");

  // Test 4: Check profile email (in case session email differs)
  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();
  
  const profileEmailCheck = profile?.email ? isSuperAdminEmail(profile.email) : false;

  // Detailed email analysis
  const emailAnalysis = {
    sessionEmail: userEmail,
    sessionEmailLower: userEmail?.toLowerCase(),
    profileEmail: profile?.email || null,
    profileEmailLower: profile?.email?.toLowerCase() || null,
    configuredEmails: SUPER_ADMIN_EMAILS,
    exactMatch: userEmail?.toLowerCase() === "usecmdr@gmail.com",
    inList: userEmail ? SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase() as any) : false,
    profileInList: profile?.email ? SUPER_ADMIN_EMAILS.includes(profile.email.toLowerCase() as any) : false,
  };

  // Compile results
  const results = {
    authenticated: true,
    user: {
      id: userId,
      email: userEmail,
      profileEmail: profile?.email || null,
    },
    tests: {
      directEmailCheck: directCheck,
      authLibCheck: authLibCheck,
      hasAllAgents: hasAllAgents,
      accessibleAgentsCount: accessibleAgents.length,
      accessibleAgents: accessibleAgents,
      profileEmailCheck: profileEmailCheck,
    },
    emailAnalysis,
    configuration: {
      superAdminEmails: SUPER_ADMIN_EMAILS,
      expectedEmail: "usecmdr@gmail.com",
    },
    verdict: directCheck && authLibCheck && hasAllAgents
      ? "✅ SUPERADMIN VERIFIED - All checks passed"
      : "❌ SUPERADMIN NOT RECOGNIZED - Some checks failed",
    recommendations: [] as string[],
  };

  // Generate recommendations
  if (!directCheck) {
    results.recommendations.push("❌ Direct email check failed");
    results.recommendations.push(`Session email: "${userEmail}"`);
    results.recommendations.push(`Expected: "usecmdr@gmail.com"`);
    if (userEmail?.toLowerCase() !== "usecmdr@gmail.com") {
      results.recommendations.push("⚠️ Email doesn't match exactly (case-insensitive)");
    }
  }

  if (!authLibCheck) {
    results.recommendations.push("❌ lib/auth.ts isSuperAdmin() check failed");
  }

  if (!hasAllAgents) {
    results.recommendations.push(`❌ User doesn't have access to all agents`);
    results.recommendations.push(`Has access to: ${accessibleAgents.join(", ") || "none"}`);
    results.recommendations.push(`Expected: sync, aloha, studio, insight`);
  }

  if (profile?.email && profile.email !== userEmail) {
    results.recommendations.push(`⚠️ Profile email (${profile.email}) differs from session email (${userEmail})`);
  }

  if (directCheck && authLibCheck && hasAllAgents) {
    results.recommendations.push("✅ All superadmin checks passed!");
    results.recommendations.push("If you're still seeing issues, check client-side code (useAgentAccess hook)");
  }

  return NextResponse.json(results);
}




