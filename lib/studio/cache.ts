/**
 * Studio LLM Cache Service
 * 
 * Caches LLM responses to reduce API costs.
 * Uses Supabase table as cache storage (can be upgraded to Redis later).
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export type CacheType = 
  | "experiment_summary"
  | "report_summary"
  | "scoring_explanation"
  | "competitor_insights";

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days default

/**
 * Generate cache key from prompt and context
 */
function generateCacheKey(prompt: string, context?: Record<string, any>): string {
  const content = JSON.stringify({ prompt, context });
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Get cached LLM response
 */
export async function getCachedLLMResponse(
  prompt: string,
  cacheType: CacheType,
  context?: Record<string, any>,
  workspaceId?: string,
  supabaseClient?: SupabaseClient
): Promise<string | null> {
  const supabase = supabaseClient || getSupabaseServerClient();
  const cacheKey = generateCacheKey(prompt, context);

  const { data, error } = await supabase
    .from("studio_llm_cache")
    .select("response_text, expires_at")
    .eq("cache_key", cacheKey)
    .single();

  if (error || !data) {
    return null;
  }

  // Check if expired
  const expiresAt = new Date(data.expires_at);
  if (expiresAt < new Date()) {
    // Delete expired entry
    await supabase
      .from("studio_llm_cache")
      .delete()
      .eq("cache_key", cacheKey);
    return null;
  }

  return data.response_text;
}

/**
 * Set cached LLM response
 */
export async function setCachedLLMResponse(
  prompt: string,
  response: string,
  cacheType: CacheType,
  context?: Record<string, any>,
  workspaceId?: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  supabaseClient?: SupabaseClient
): Promise<void> {
  const supabase = supabaseClient || getSupabaseServerClient();
  const cacheKey = generateCacheKey(prompt, context);
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);

  await supabase
    .from("studio_llm_cache")
    .upsert(
      {
        cache_key: cacheKey,
        workspace_id: workspaceId || null,
        cache_type: cacheType,
        response_text: response,
        expires_at: expiresAt.toISOString(),
      },
      {
        onConflict: "cache_key",
      }
    );
}

/**
 * Clear cache for a workspace
 */
export async function clearWorkspaceCache(
  workspaceId: string,
  cacheType?: CacheType,
  supabaseClient?: SupabaseClient
): Promise<void> {
  const supabase = supabaseClient || getSupabaseServerClient();

  let query = supabase
    .from("studio_llm_cache")
    .delete()
    .eq("workspace_id", workspaceId);

  if (cacheType) {
    query = query.eq("cache_type", cacheType);
  }

  await query;
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredCache(
  supabaseClient?: SupabaseClient
): Promise<number> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data, error } = await supabase
    .from("studio_llm_cache")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    return 0;
  }

  return data?.length || 0;
}

