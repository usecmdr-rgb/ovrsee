"use client";

import { useEffect, useState } from "react";
import type { AgentStatsDaily } from "@/types";

export const emptyAgentStats: AgentStatsDaily = {
  id: "",
  date: "",
  alpha_calls_total: 0,
  alpha_calls_missed: 0,
  alpha_appointments: 0,
  xi_important_emails: 0,
  xi_missed_emails: 0,
  xi_payments_bills: 0,
  xi_invoices: 0,
  mu_media_edits: 0,
  beta_insights_count: 0,
};

const CACHE_TTL = 30 * 1000; // 30 seconds
let cachedStats: AgentStatsDaily | null = null;
let cachedAt = 0;
let inflightPromise: Promise<AgentStatsDaily | null> | null = null;

async function fetchAgentStats(): Promise<AgentStatsDaily | null> {
  const response = await fetch("/api/agent-stats", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Failed to load stats");
  }
  return Array.isArray(payload.data) ? payload.data[0] ?? null : null;
}

async function getFreshStats(): Promise<AgentStatsDaily | null> {
  if (!inflightPromise) {
    inflightPromise = fetchAgentStats()
      .then((data) => {
        cachedStats = data;
        cachedAt = Date.now();
        return data;
      })
      .finally(() => {
        inflightPromise = null;
      });
  }
  return inflightPromise;
}

export function useAgentStats() {
  const [stats, setStats] = useState<AgentStatsDaily | null>(cachedStats);
  const [loading, setLoading] = useState(!cachedStats);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const now = Date.now();
    const hasFreshCache = cachedStats && now - cachedAt < CACHE_TTL;

    if (hasFreshCache) {
      setStats(cachedStats);
      setLoading(false);
      // Revalidate in background but don't flip loading while refetching
      getFreshStats()
        .then((data) => {
          if (!isMounted) return;
          setStats(data);
          setError(null);
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(err instanceof Error ? err.message : "Failed to load stats");
        });
      return () => {
        isMounted = false;
      };
    }

    setLoading(true);
    getFreshStats()
      .then((data) => {
        if (!isMounted) return;
        setStats(data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load stats");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { stats, loading, error };
}

