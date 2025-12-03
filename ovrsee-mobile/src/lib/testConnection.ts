/**
 * Utility functions to test Supabase connection
 */

import { supabase } from './supabase';

/**
 * Test if Supabase is properly configured and accessible
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  error?: string;
  details?: any;
}> {
  try {
    // Check if environment variables are set
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        error: 'Missing environment variables',
        details: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseKey,
        },
      };
    }

    if (supabaseUrl.includes('placeholder')) {
      return {
        success: false,
        error: 'Using placeholder Supabase URL',
      };
    }

    // Try to make a simple request to Supabase
    // We'll try to get the auth settings which doesn't require authentication
    const { data, error } = await supabase.auth.getSession();

    // Even if there's no session, if we don't get a connection error, it means Supabase is reachable
    if (error && error.message.includes('fetch')) {
      return {
        success: false,
        error: 'Cannot reach Supabase server',
        details: error.message,
      };
    }

    return {
      success: true,
      details: {
        url: supabaseUrl.substring(0, 30) + '...',
        hasSession: !!data?.session,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error,
    };
  }
}



