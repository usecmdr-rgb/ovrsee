import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /api/auth/check-config
 * 
 * Diagnostic endpoint to check OAuth and cookie configuration
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Check cookies
  const cookies = request.cookies.getAll();
  const supabaseCookies = cookies.filter(c => 
    c.name.startsWith('sb-') || 
    c.name.includes('supabase') ||
    c.name.includes('auth')
  );

  // Create Supabase client to check session
  let session = null;
  let sessionError = null;
  
  if (supabaseUrl && supabaseAnonKey) {
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

    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data.session;
    sessionError = sessionResult.error;
  }

  // Get current URL info
  const url = request.nextUrl;
  const origin = url.origin;
  const pathname = url.pathname;
  const searchParams = Object.fromEntries(url.searchParams.entries());

  return NextResponse.json({
    configuration: {
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'NOT SET',
      supabaseAnonKey: supabaseAnonKey ? 'SET' : 'NOT SET',
      appUrl: appUrl || 'NOT SET',
      currentOrigin: origin,
      currentPath: pathname,
      isHttps: url.protocol === 'https:',
    },
    cookies: {
      total: cookies.length,
      supabaseCookies: supabaseCookies.map(c => ({
        name: c.name,
        value: c.value ? `${c.value.substring(0, 20)}...` : 'empty',
        // Note: We can't read cookie options (httpOnly, secure, etc) from request
      })),
      allCookieNames: cookies.map(c => c.name),
    },
    session: {
      exists: !!session,
      userId: session?.user?.id || null,
      email: session?.user?.email || null,
      expiresAt: session?.expires_at || null,
      error: sessionError?.message || null,
    },
    oauthRedirect: {
      expectedRedirectUrl: appUrl ? `${appUrl}/app` : `${origin}/app`,
      currentUrl: url.toString(),
      hasCodeParam: !!searchParams.code,
      hasErrorParam: !!searchParams.error,
    },
    recommendations: {
      checkSupabaseDashboard: [
        '1. Go to Supabase Dashboard → Authentication → URL Configuration',
        `2. Verify "Site URL" is set to: ${appUrl || origin}`,
        `3. Verify "Redirect URLs" includes: ${appUrl ? `${appUrl}/app` : `${origin}/app`}`,
        '4. Also add wildcard: https://ovrsee.ai/** (if using production)',
      ],
      checkCookies: [
        '1. Open browser DevTools → Application → Cookies',
        '2. Look for cookies starting with "sb-"',
        '3. Verify they have correct Domain (should be .ovrsee.ai or ovrsee.ai)',
        '4. Verify SameSite is "lax" or "none"',
        '5. Verify Secure is true (for HTTPS)',
      ],
    },
  });
}



