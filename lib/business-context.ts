/**
 * Business Context Helper
 * 
 * This is the SHARED helper that all AI agents MUST use to access business information.
 * Agents should NOT implement their own business-info fetching logic.
 * 
 * Usage:
 * ```ts
 * const context = await getBusinessContext(userId);
 * // Use context.profile and context.knowledgeChunks
 * ```
 * 
 * All business-related data is stored in:
 * - business_profiles: Main business information and preferences
 * - business_knowledge_chunks: Structured knowledge from forms and websites
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

export type BusinessContext = {
  profile: {
    fullName?: string | null;
    businessName: string | null;
    website: string | null;
    industry?: string | null;
    description?: string | null;
    services?: string[] | string | null;
    hours?: string | null;
    location?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    serviceArea?: string | null;
    serviceName?: string | null;
    watermarkSettings?: {
      enabled: boolean;
      text?: string | null;
      logoUrl?: string | null;
      position?: string | null;
    };
    preferences?: Record<string, any>;
    language?: string | null;
    timezone?: string | null;
    notes?: string | null;
  };
  knowledgeChunks: Array<{
    id: string;
    source: "form" | "website" | "manual";
    sourceUrl?: string | null;
    title?: string | null;
    content: string;
    metadata?: Record<string, any>;
  }>;
};

/**
 * Get business context for a user or business profile
 * 
 * This is the PRIMARY function all agents should use to access business information.
 * 
 * @param userId - User ID (will look up business_profile by user_id)
 * @param businessProfileId - Optional: Direct business profile ID (alternative to userId)
 * @param query - Optional: Filter/summarize knowledge for specific tasks (e.g., "pricing", "services")
 * @returns BusinessContext object with profile and knowledge chunks
 * 
 * @example
 * ```ts
 * // Basic usage
 * const context = await getBusinessContext(userId);
 * 
 * // Filter for pricing-related knowledge
 * const context = await getBusinessContext(userId, undefined, "pricing");
 * ```
 */
export async function getBusinessContext(
  userId?: string,
  businessProfileId?: string,
  query?: string
): Promise<BusinessContext | null> {
  const supabase = getSupabaseServerClient();

  let profileId = businessProfileId;

  // If no profileId provided, look up by userId
  if (!profileId && userId) {
    const { data: profile, error } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (error || !profile) {
      // No business profile exists yet
      return null;
    }

    profileId = profile.id;
  }

  if (!profileId) {
    return null;
  }

  // Fetch business profile
  const { data: profile, error: profileError } = await supabase
    .from("business_profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching business profile:", profileError);
    return null;
  }

  // Fetch knowledge chunks
  let knowledgeQuery = supabase
    .from("business_knowledge_chunks")
    .select("id, source, source_url, title, content, metadata")
    .eq("business_profile_id", profileId)
    .order("created_at", { ascending: false });

  // If query provided, filter chunks (basic text search for now)
  // In the future, this could use semantic search with embeddings
  if (query) {
    knowledgeQuery = knowledgeQuery.ilike("content", `%${query}%`);
  }

  const { data: chunks, error: chunksError } = await knowledgeQuery;

  if (chunksError) {
    console.error("Error fetching knowledge chunks:", chunksError);
  }

  // Parse services_offered (can be JSONB array or string)
  let services: string[] | string | null = null;
  if (profile.services_offered) {
    if (typeof profile.services_offered === "string") {
      services = profile.services_offered;
    } else if (Array.isArray(profile.services_offered)) {
      services = profile.services_offered;
    } else if (typeof profile.services_offered === "object") {
      // If it's an object, try to extract array or convert to string
      services = profile.services_offered;
    }
  }

  // Build watermark settings
  const watermarkSettings = {
    enabled: profile.image_watermark_enabled || false,
    text: profile.image_watermark_text || null,
    logoUrl: profile.image_watermark_logo_url || null,
    position: profile.image_watermark_position || null,
  };

  return {
    profile: {
      fullName: profile.full_name,
      businessName: profile.business_name,
      website: profile.primary_website_url,
      industry: profile.business_type,
      description: profile.description,
      services,
      hours: profile.hours_of_operation,
      location: profile.location,
      contactEmail: profile.contact_email,
      contactPhone: profile.contact_phone,
      serviceArea: profile.service_area,
      serviceName: profile.service_name,
      watermarkSettings,
      preferences: profile.preferences || {},
      language: profile.language,
      timezone: profile.timezone,
      notes: profile.notes,
    },
    knowledgeChunks: (chunks || []).map((chunk) => ({
      id: chunk.id,
      source: chunk.source as "form" | "website" | "manual",
      sourceUrl: chunk.source_url || null,
      title: chunk.title || null,
      content: chunk.content,
      metadata: chunk.metadata || {},
    })),
  };
}

/**
 * Get business context by user ID (convenience wrapper)
 * 
 * @param userId - User ID
 * @param query - Optional: Filter knowledge chunks
 */
export async function getBusinessContextByUserId(
  userId: string,
  query?: string
): Promise<BusinessContext | null> {
  return getBusinessContext(userId, undefined, query);
}

/**
 * Get business context by business profile ID (convenience wrapper)
 * 
 * @param businessProfileId - Business profile ID
 * @param query - Optional: Filter knowledge chunks
 */
export async function getBusinessContextByProfileId(
  businessProfileId: string,
  query?: string
): Promise<BusinessContext | null> {
  return getBusinessContext(undefined, businessProfileId, query);
}

/**
 * Check if a user has a business profile
 * 
 * @param userId - User ID
 * @returns true if business profile exists
 */
export async function hasBusinessProfile(userId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  return !error && !!data;
}













