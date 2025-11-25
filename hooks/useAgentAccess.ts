"use client";

import { useState, useEffect } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import type { AgentId } from "@/lib/config/agents";

interface AgentAccess {
  hasAccess: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  accessibleAgents: AgentId[];
}

export function useAgentAccess(agentId?: AgentId): AgentAccess {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessibleAgents, setAccessibleAgents] = useState<AgentId[]>([]);

  useEffect(() => {
    async function checkAccess() {
      try {
        const { data: { session } } = await supabaseBrowserClient.auth.getSession();
        
        if (!session) {
          setHasAccess(false);
          setIsLoading(false);
          return;
        }

        const authToken = session.access_token;
        const response = await fetch("/api/user/agents", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin || false);
          setAccessibleAgents(data.agents || []);
          
          if (agentId) {
            setHasAccess(data.isAdmin || data.agents.includes(agentId));
          } else {
            setHasAccess(true); // If no specific agent, assume access
          }
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error("Error checking agent access:", error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAccess();
  }, [agentId]);

  return { hasAccess, isLoading, isAdmin, accessibleAgents };
}

