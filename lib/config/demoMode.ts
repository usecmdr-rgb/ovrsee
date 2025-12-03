import type { User } from "@supabase/supabase-js";
import type { AccountMode } from "@/lib/account-mode";

/**
 * Determines if the app should run in demo mode.
 * 
 * Demo mode logic:
 * - Show demo data for: unauthenticated users (preview mode)
 * - Show demo data for: authenticated users in 'preview' account mode (no trial, no subscription)
 * - Remove demo data for: authenticated users with 'trial-active', 'trial-expired', or 'subscribed' account mode
 * 
 * This ensures that only users who have created a profile AND have either a trial or subscription
 * will see real data (or zeros). All others see demo data.
 * 
 * For future use, demo mode could be enabled via:
 * - URL parameter: ?demo=1
 * - Dedicated demo account in development
 * - Environment variable for marketing demos
 * 
 * @param user - The authenticated user (if any)
 * @param accountMode - The user's account mode ('preview', 'trial-active', 'trial-expired', 'subscribed')
 * @param searchParams - URL search parameters (optional)
 * @returns true if demo mode should be enabled (show demo data), false otherwise (show real data)
 */
export function isDemoMode(
  user?: User | null, 
  accountMode?: AccountMode | null,
  searchParams?: URLSearchParams
): boolean {
  // If user is not authenticated, show demo data
  if (!user) {
    return true;
  }

  // If account mode is not provided, default to showing demo (safe fallback)
  if (!accountMode) {
    return true;
  }

  // Remove demo data only for users with trial or subscription
  // Show demo data for users in preview mode (no trial, no subscription)
  if (accountMode === 'preview') {
    return true; // Show demo data
  }

  // For trial-active, trial-expired, or subscribed: remove demo data
  return false; // Show real data (or zeros)

  // For future: check URL parameter for demo mode override
  // if (searchParams?.get("demo") === "1") {
  //   return true;
  // }

  // For future: check for dedicated demo account
  // if (user?.email === "demo@example.com") {
  //   return true;
  // }
}

