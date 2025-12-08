import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { isSuperAdminEmail } from "@/lib/config/superAdmins";

/**
 * GET /api/auth/diagnose-user
 * 
 * Comprehensive diagnostic endpoint to check why a user account might not work on production
 * Compares session, profile, subscription, and access status
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

  const diagnostics: any = {
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hostname: request.nextUrl.hostname,
      protocol: request.nextUrl.protocol,
      isHttps: request.nextUrl.protocol === 'https:',
      isLocalhost: request.nextUrl.hostname === 'localhost' || request.nextUrl.hostname === '127.0.0.1',
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET',
    },
    session: {
      exists: !!session,
      error: sessionError?.message || null,
      userId: session?.user?.id || null,
      email: session?.user?.email || null,
      emailVerified: session?.user?.email_confirmed_at ? true : false,
      createdAt: session?.user?.created_at || null,
    },
    cookies: {
      total: request.cookies.getAll().length,
      supabaseCookies: request.cookies.getAll()
        .filter(c => c.name.startsWith('sb-') || c.name.includes('supabase') || c.name.includes('auth'))
        .map(c => ({
          name: c.name,
          hasValue: !!c.value,
          valueLength: c.value?.length || 0,
        })),
    },
  };

  // If no session, return early
  if (!session) {
    return NextResponse.json({
      ...diagnostics,
      profile: { exists: false, error: "No session - cannot check profile" },
      subscription: { exists: false, error: "No session - cannot check subscription" },
      access: { error: "No session - cannot check access" },
      recommendations: [
        "❌ No active session found",
        "Check if cookies are being set correctly",
        "Verify Supabase URL and anon key are correct",
        "Check browser console for authentication errors",
        "Try logging in again",
      ],
    });
  }

  const userId = session.user.id;
  const userEmail = session.user.email;

  // Check profile
  const serverSupabase = getSupabaseServerClient();
  const { data: profile, error: profileError } = await serverSupabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  diagnostics.profile = {
    exists: !!profile,
    error: profileError?.message || null,
    errorCode: profileError?.code || null,
    data: profile ? {
      id: profile.id,
      email: profile.email,
      has_used_trial: profile.has_used_trial,
      trial_ends_at: profile.trial_ends_at,
      subscription_tier: profile.subscription_tier,
      subscription_status: profile.subscription_status,
      created_at: profile.created_at,
    } : null,
  };

  // Check subscription
  const { data: subscription, error: subscriptionError } = await serverSupabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  diagnostics.subscription = {
    exists: !!subscription,
    error: subscriptionError?.message || null,
    errorCode: subscriptionError?.code || null,
    data: subscription ? {
      id: subscription.id,
      tier: subscription.tier,
      status: subscription.status,
      trial_ends_at: subscription.trial_ends_at,
      created_at: subscription.created_at,
    } : null,
  };

  // Check superadmin status
  const isSuperAdmin = userEmail ? isSuperAdminEmail(userEmail) : false;

  // Check access
  diagnostics.access = {
    isSuperAdmin,
    userEmail,
    hasProfile: !!profile,
    hasSubscription: !!subscription,
    subscriptionTier: subscription?.tier || profile?.subscription_tier || null,
    subscriptionStatus: subscription?.status || profile?.subscription_status || null,
  };

  // Generate recommendations
  const recommendations: string[] = [];

  if (!profile) {
    recommendations.push("❌ Profile does not exist - this is the main issue!");
    recommendations.push("The profile should be created automatically when user signs up");
    recommendations.push("Check if database trigger is working: `handle_new_user()`");
    recommendations.push("Try calling `/api/auth/ensure-profile` to create profile");
  } else {
    recommendations.push("✅ Profile exists");
  }

  if (!subscription && !isSuperAdmin) {
    recommendations.push("⚠️ No subscription found");
    recommendations.push("User may be in preview mode (no trial or subscription)");
    if (profile?.has_used_trial) {
      recommendations.push("User has used trial - may need to subscribe");
    }
  } else if (isSuperAdmin) {
    recommendations.push("✅ Superadmin - has full access");
  } else {
    recommendations.push("✅ Subscription exists");
  }

  if (sessionError) {
    recommendations.push(`❌ Session error: ${sessionError.message}`);
  }

  if (!session.user.email_confirmed_at) {
    recommendations.push("⚠️ Email not verified (may affect some features)");
  }

  // Check cookie domain
  const cookieDomain = request.cookies.get('sb-access-token') || request.cookies.get('sb-refresh-token');
  if (!cookieDomain) {
    recommendations.push("⚠️ No Supabase cookies found - session may not persist");
    recommendations.push("Check middleware cookie configuration");
    recommendations.push("Verify domain is set correctly for production");
  }

  diagnostics.recommendations = recommendations;

  return NextResponse.json(diagnostics);
}




