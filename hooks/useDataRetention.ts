"use client";

import { useState, useEffect } from "react";
import { useAppState } from "@/context/AppStateContext";

/**
 * Hook to get data retention status for the current user
 * 
 * Returns:
 * - isTrialExpired: Whether user's trial has expired
 * - isInRetentionWindow: Whether user is in retention window (data not yet cleared)
 * - daysRemaining: Days remaining in retention window (null if not in window)
 * - isDataCleared: Whether user's data has been cleared
 * - retentionReason: Why retention window was set
 */
export function useDataRetention() {
  const { isAuthenticated } = useAppState();
  const [status, setStatus] = useState<{
    isTrialExpired: boolean;
    isInRetentionWindow: boolean;
    daysRemaining: number | null;
    isDataCleared: boolean;
    retentionReason: "trial_expired" | "paid_canceled" | "paid_paused" | null;
    loading: boolean;
  }>({
    isTrialExpired: false,
    isInRetentionWindow: false,
    daysRemaining: null,
    isDataCleared: false,
    retentionReason: null,
    loading: true,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setStatus((prev) => ({ ...prev, loading: false }));
      return;
    }

    async function fetchRetentionStatus() {
      try {
        const response = await fetch("/api/subscription/retention-status");
        if (!response.ok) {
          throw new Error("Failed to fetch retention status");
        }

        const data = await response.json();
        setStatus({
          isTrialExpired: data.isTrialExpired || false,
          isInRetentionWindow: data.isInRetentionWindow || false,
          daysRemaining: data.daysRemaining ?? null,
          isDataCleared: data.isDataCleared || false,
          retentionReason: data.retentionReason || null,
          loading: false,
        });
      } catch (error) {
        console.error("Error fetching retention status:", error);
        setStatus((prev) => ({ ...prev, loading: false }));
      }
    }

    fetchRetentionStatus();
  }, [isAuthenticated]);

  return status;
}










