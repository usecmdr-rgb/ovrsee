"use client";

import { useMemo } from "react";
import { useAgentStats, emptyAgentStats } from "./useAgentStats";
import { useAgentAccess } from "./useAgentAccess";
import type { AgentId } from "@/lib/config/agents";

interface UseAgentStatsWithPreviewOptions {
  agentId: AgentId;
  previewStats: {
    [key: string]: number;
  };
  realStats?: {
    [key: string]: number;
  };
}

/**
 * Unified hook that handles agent stats with preview mode detection
 * Prevents number flashing by waiting for access check to complete
 * before showing any stats
 */
export function useAgentStatsWithPreview(
  agentId: AgentId,
  previewStats: UseAgentStatsWithPreviewOptions["previewStats"],
  realStatsFallback?: UseAgentStatsWithPreviewOptions["realStats"]
) {
  const { hasAccess, isLoading: accessLoading } = useAgentAccess(agentId);
  const { stats, loading: statsLoading, error } = useAgentStats();

  // Wait for access to be determined before showing stats to prevent flashing
  const isAccessReady = !accessLoading;
  
  // Use preview/mock data if user doesn't have access (only after access check is complete)
  const isPreview = isAccessReady && !hasAccess;
  
  // Determine if we're still loading (either access or stats)
  const isLoading = accessLoading || statsLoading;
  
  // Merge stats based on preview mode and availability
  const latestStats = useMemo(() => {
    // While access is loading, return empty stats to prevent flash
    if (!isAccessReady) {
      return emptyAgentStats;
    }
    
    // If we have real stats and user has access, use them
    if (stats && !isPreview) {
      return stats;
    }
    
    // If in preview mode or no stats available, use preview stats
    if (isPreview) {
      return {
        ...emptyAgentStats,
        ...previewStats,
      };
    }
    
    // If user has access but no stats yet, use real stats fallback or empty
    return {
      ...emptyAgentStats,
      ...(realStatsFallback || {}),
    };
  }, [isAccessReady, isPreview, stats, previewStats, realStatsFallback]);

  return {
    stats: latestStats,
    isLoading,
    error,
    isPreview,
    hasAccess: isAccessReady ? hasAccess : false, // Don't expose access until ready
  };
}









