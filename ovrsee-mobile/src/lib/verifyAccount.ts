/**
 * Utility to verify if an account exists in Supabase
 * This helps debug login issues
 */

import { supabase } from './supabase';

/**
 * Attempts to verify account existence by trying to sign in
 * Returns detailed information about why login might be failing
 */
export async function verifyAccount(email: string, password: string): Promise<{
  success: boolean;
  error?: string;
  details?: {
    accountExists?: boolean;
    emailConfirmed?: boolean;
    errorCode?: number;
    errorMessage?: string;
  };
}> {
  try {
    console.log('[VerifyAccount] Attempting to verify account for:', email);
    
    // Try to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[VerifyAccount] Login error:', error);
      
      // Parse error details
      const errorMessage = error.message || '';
      const errorStatus = error.status || 0;

      // Check if it's an invalid credentials error
      if (errorStatus === 400 || errorMessage.toLowerCase().includes('invalid login credentials')) {
        return {
          success: false,
          error: 'Invalid email or password',
          details: {
            accountExists: false, // Might not exist, or password is wrong
            errorCode: errorStatus,
            errorMessage: errorMessage,
          },
        };
      }

      // Check if email is not confirmed
      if (errorMessage.toLowerCase().includes('email not confirmed') || 
          errorMessage.toLowerCase().includes('email not verified')) {
        return {
          success: false,
          error: 'Email not confirmed',
          details: {
            accountExists: true,
            emailConfirmed: false,
            errorCode: errorStatus,
            errorMessage: errorMessage,
          },
        };
      }

      // Other errors
      return {
        success: false,
        error: errorMessage || 'Unknown error',
        details: {
          errorCode: errorStatus,
          errorMessage: errorMessage,
        },
      };
    }

    // Success - account exists and credentials are correct
    console.log('[VerifyAccount] Login successful');
    return {
      success: true,
      details: {
        accountExists: true,
        emailConfirmed: !!data.user?.email_confirmed_at,
      },
    };
  } catch (err) {
    console.error('[VerifyAccount] Exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
      details: {},
    };
  }
}




