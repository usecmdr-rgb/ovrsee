"use client";

import { useState, useEffect } from "react";
import type { AccountMode } from "@/lib/account-mode";

interface AccountModeState {
  mode: AccountMode;
  loading: boolean;
  error: string | null;
  activationTimestamp: string | null;
}

/**
 * Hook to get the current user's account mode.
 * 
 * Provides:
 * - mode: The account mode ('preview' | 'trial-active' | 'trial-expired' | 'subscribed')
 * - loading: Whether the account mode is being fetched
 * - error: Any error that occurred while fetching
 * - activationTimestamp: When the user first activated (trial start or subscription start)
 * 
 * This hook fetches account mode from the server API endpoint.
 */
export function useAccountMode(): AccountModeState {
  const [state, setState] = useState<AccountModeState>({
    mode: 'preview',
    loading: true,
    error: null,
    activationTimestamp: null,
  });

  useEffect(() => {
    async function fetchAccountMode() {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        
        const response = await fetch("/api/account-mode", {
          cache: "no-store",
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch account mode");
        }
        
        const data = await response.json();
        
        setState({
          mode: data.mode || 'preview',
          loading: false,
          error: null,
          activationTimestamp: data.activationTimestamp || null,
        });
      } catch (error: any) {
        console.error("Error fetching account mode:", error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error.message || "Failed to load account mode",
        }));
      }
    }

    fetchAccountMode();
  }, []);

  return state;
}



