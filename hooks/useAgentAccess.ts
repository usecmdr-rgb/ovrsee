"use client";

import { useState, useEffect, useRef } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import type { AgentId } from "@/lib/config/agents";

interface AgentAccess {
  hasAccess: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  accessibleAgents: AgentId[];
}

// Global cache for access state (persists across page navigations within session)
const accessCache = {
  data: null as { accessibleAgents: AgentId[]; isAdmin: boolean; timestamp: number } | null,
  promise: null as Promise<{ accessibleAgents: AgentId[]; isAdmin: boolean }> | null,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

export function useAgentAccess(agentId?: AgentId): AgentAccess {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessibleAgents, setAccessibleAgents] = useState<AgentId[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function checkAccess() {
      try {
        // Check cache first - if fresh, use it immediately
        const now = Date.now();
        if (accessCache.data && (now - accessCache.data.timestamp) < CACHE_TTL) {
          if (!isMountedRef.current) return;
          
          const cached = accessCache.data;
          setAccessibleAgents(cached.accessibleAgents);
          setIsAdmin(cached.isAdmin);
          
          if (agentId) {
            setHasAccess(cached.isAdmin || cached.accessibleAgents.includes(agentId));
          } else {
            setHasAccess(true);
          }
          setIsLoading(false);
          
          // Revalidate in background without blocking
          validateInBackground();
          return;
        }

        // If there's already a check in progress, reuse it
        if (accessCache.promise) {
          try {
            const result = await accessCache.promise;
            if (!isMountedRef.current) return;
            
            updateState(result);
            return;
          } catch {
            // Continue with new check if cached promise failed
          }
        }

        // Perform new check
        const checkPromise = performAccessCheck();
        accessCache.promise = checkPromise;

        const result = await checkPromise;
        accessCache.promise = null;
        
        if (!isMountedRef.current) return;

        // Update cache
        accessCache.data = {
          ...result,
          timestamp: now,
        };

        updateState(result);
      } catch (error) {
        console.error("Error checking agent access:", error);
        if (!isMountedRef.current) return;
        setHasAccess(false);
        setIsLoading(false);
      }
    }

    function updateState(result: { accessibleAgents: AgentId[]; isAdmin: boolean }) {
      if (!isMountedRef.current) return;
      
      setAccessibleAgents(result.accessibleAgents);
      setIsAdmin(result.isAdmin);
      
      if (agentId) {
        setHasAccess(result.isAdmin || result.accessibleAgents.includes(agentId));
      } else {
        setHasAccess(true);
      }
      setIsLoading(false);
    }

    checkAccess();
  }, [agentId]);

  return { hasAccess, isLoading, isAdmin, accessibleAgents };
}

async function performAccessCheck(): Promise<{
  accessibleAgents: AgentId[];
  isAdmin: boolean;
}> {
  const { data: { session } } = await supabaseBrowserClient.auth.getSession();
  
  if (!session) {
    return { accessibleAgents: [], isAdmin: false };
  }

  const authToken = session.access_token;
  const response = await fetch("/api/user/agents", {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (response.ok) {
    const data = await response.json();
    return {
      accessibleAgents: data.agents || [],
      isAdmin: data.isAdmin || false,
    };
  }

  return { accessibleAgents: [], isAdmin: false };
}

async function validateInBackground() {
  try {
    const result = await performAccessCheck();
    accessCache.data = {
      ...result,
      timestamp: Date.now(),
    };
  } catch {
    // Silently fail background validation
  }
}

/**
 * Clear the access cache (useful when subscription changes)
 */
export function clearAccessCache() {
  accessCache.data = null;
  accessCache.promise = null;
}

