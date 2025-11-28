import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Creates a Supabase server client with service role key.
 * WARNING: This client bypasses RLS - use only in server-side code that needs admin privileges.
 * For user-scoped operations, use getAuthenticatedSupabaseClient instead.
 *
 * In development, we avoid throwing at module load time so that builds don't fail
 * if env vars are temporarily misconfigured. Instead, we log a clear error when
 * the client is requested.
 */
export const getSupabaseServerClient = () => {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error(
      "Supabase server client requested but required env vars are missing. " +
        "Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment."
    );
    throw new Error(
      "Supabase configuration is missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
};


