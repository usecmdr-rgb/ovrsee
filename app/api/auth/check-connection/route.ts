import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * GET /api/auth/check-connection
 * 
 * Diagnostic endpoint to check Supabase connection and configuration
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const config = {
    supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'NOT SET',
    supabaseUrlLength: supabaseUrl?.length || 0,
    supabaseAnonKey: supabaseAnonKey ? 'SET' : 'NOT SET',
    supabaseAnonKeyLength: supabaseAnonKey?.length || 0,
    hasValidUrl: !!supabaseUrl && supabaseUrl.startsWith('http'),
    hasValidKey: !!supabaseAnonKey && supabaseAnonKey.length > 20,
  };

  // Try to create a client and make a test request
  let connectionTest = {
    canCreateClient: false,
    canConnect: false,
    error: null as string | null,
  };

  if (supabaseUrl && supabaseAnonKey) {
    try {
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

      connectionTest.canCreateClient = true;

      // Try to get session (this will test the connection)
      const { error } = await supabase.auth.getSession();
      
      if (error) {
        connectionTest.error = error.message;
      } else {
        connectionTest.canConnect = true;
      }
    } catch (error: any) {
      connectionTest.error = error.message || 'Unknown error';
    }
  } else {
    connectionTest.error = 'Missing Supabase configuration';
  }

  return NextResponse.json({
    configuration: config,
    connection: connectionTest,
    recommendations: [
      !supabaseUrl ? '❌ NEXT_PUBLIC_SUPABASE_URL is not set' : '✅ NEXT_PUBLIC_SUPABASE_URL is set',
      !supabaseAnonKey ? '❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set' : '✅ NEXT_PUBLIC_SUPABASE_ANON_KEY is set',
      !config.hasValidUrl ? '❌ Supabase URL format appears invalid' : '✅ Supabase URL format is valid',
      !config.hasValidKey ? '❌ Supabase anon key appears invalid' : '✅ Supabase anon key format is valid',
      !connectionTest.canCreateClient ? '❌ Cannot create Supabase client' : '✅ Can create Supabase client',
      !connectionTest.canConnect ? '❌ Cannot connect to Supabase' : '✅ Can connect to Supabase',
    ],
  });
}




