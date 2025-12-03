import { supabase } from './supabase';

/**
 * Get the current authentication session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

/**
 * Get the current authenticated user
 */
export async function getCurrentAuthUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

/**
 * Get the current session's access token
 * Returns null if not authenticated
 */
export async function getAuthToken(): Promise<string | null> {
  const { session } = await getSession();
  return session?.access_token || null;
}

/**
 * Sign in with email and password
 */
export async function signInWithPassword(email: string, password: string) {
  return await supabase.auth.signInWithPassword({ email, password });
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, options?: { data?: Record<string, any> }) {
  return await supabase.auth.signUp({
    email,
    password,
    options,
  });
}

/**
 * Sign out the current user
 */
export async function signOut() {
  return await supabase.auth.signOut();
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}



