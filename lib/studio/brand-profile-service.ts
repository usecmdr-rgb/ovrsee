/**
 * Brand Profile Service
 * 
 * Service for managing workspace-scoped brand profiles.
 * Provides helper functions to fetch and format brand profiles for AI prompts.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface BrandProfile {
  id: string;
  workspace_id: string;
  brand_description: string | null;
  target_audience: string | null;
  voice_tone: {
    style?: "professional" | "casual" | "friendly" | "authoritative" | "playful";
    formality?: "formal" | "semi-formal" | "casual";
    personality?: string[];
    do_not_use?: string[];
    preferred_phrases?: string[];
  };
  brand_attributes: {
    keywords?: string[];
    colors?: string[];
    values?: string[];
    mission?: string;
    tagline?: string;
  };
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null | null;
}

/**
 * Get brand profile for a workspace
 */
export async function getBrandProfile(
  workspaceId: string,
  supabaseClient?: SupabaseClient
): Promise<BrandProfile | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !profile) {
    return null;
  }

  return {
    id: profile.id,
    workspace_id: profile.workspace_id,
    brand_description: profile.brand_description,
    target_audience: profile.target_audience,
    voice_tone: (profile.voice_tone || {}) as BrandProfile["voice_tone"],
    brand_attributes: (profile.brand_attributes || {}) as BrandProfile["brand_attributes"],
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    created_by: profile.created_by,
    updated_by: profile.updated_by,
  };
}

/**
 * Format brand profile for AI prompt context
 * Returns a structured string that can be inserted into prompts
 */
export function formatBrandProfileForPrompt(profile: BrandProfile | null): string {
  if (!profile) {
    return "No brand profile has been configured for this workspace.";
  }

  const sections: string[] = [];

  if (profile.brand_description) {
    sections.push(`Brand Description: ${profile.brand_description}`);
  }

  if (profile.target_audience) {
    sections.push(`Target Audience: ${profile.target_audience}`);
  }

  if (profile.voice_tone && Object.keys(profile.voice_tone).length > 0) {
    const toneParts: string[] = [];
    
    if (profile.voice_tone.style) {
      toneParts.push(`Style: ${profile.voice_tone.style}`);
    }
    
    if (profile.voice_tone.formality) {
      toneParts.push(`Formality: ${profile.voice_tone.formality}`);
    }
    
    if (profile.voice_tone.personality && profile.voice_tone.personality.length > 0) {
      toneParts.push(`Personality traits: ${profile.voice_tone.personality.join(", ")}`);
    }
    
    if (profile.voice_tone.do_not_use && profile.voice_tone.do_not_use.length > 0) {
      toneParts.push(`Avoid: ${profile.voice_tone.do_not_use.join(", ")}`);
    }
    
    if (profile.voice_tone.preferred_phrases && profile.voice_tone.preferred_phrases.length > 0) {
      toneParts.push(`Preferred phrases: ${profile.voice_tone.preferred_phrases.join(", ")}`);
    }

    if (toneParts.length > 0) {
      sections.push(`Voice & Tone:\n${toneParts.join("\n")}`);
    }
  }

  if (profile.brand_attributes && Object.keys(profile.brand_attributes).length > 0) {
    const attrParts: string[] = [];
    
    if (profile.brand_attributes.keywords && profile.brand_attributes.keywords.length > 0) {
      attrParts.push(`Keywords: ${profile.brand_attributes.keywords.join(", ")}`);
    }
    
    if (profile.brand_attributes.colors && profile.brand_attributes.colors.length > 0) {
      attrParts.push(`Brand colors: ${profile.brand_attributes.colors.join(", ")}`);
    }
    
    if (profile.brand_attributes.values && profile.brand_attributes.values.length > 0) {
      attrParts.push(`Core values: ${profile.brand_attributes.values.join(", ")}`);
    }
    
    if (profile.brand_attributes.mission) {
      attrParts.push(`Mission: ${profile.brand_attributes.mission}`);
    }
    
    if (profile.brand_attributes.tagline) {
      attrParts.push(`Tagline: ${profile.brand_attributes.tagline}`);
    }

    if (attrParts.length > 0) {
      sections.push(`Brand Attributes:\n${attrParts.join("\n")}`);
    }
  }

  if (sections.length === 0) {
    return "Brand profile exists but is not yet configured.";
  }

  return sections.join("\n\n");
}

/**
 * Create or update brand profile
 */
export async function upsertBrandProfile(
  workspaceId: string,
  data: {
    brand_description?: string | null;
    target_audience?: string | null;
    voice_tone?: BrandProfile["voice_tone"];
    brand_attributes?: BrandProfile["brand_attributes"];
    updated_by: string;
  },
  supabaseClient?: SupabaseClient
): Promise<BrandProfile | null> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("brand_profiles")
    .upsert(
      {
        workspace_id: workspaceId,
        brand_description: data.brand_description ?? null,
        target_audience: data.target_audience ?? null,
        voice_tone: data.voice_tone || {},
        brand_attributes: data.brand_attributes || {},
        updated_by: data.updated_by,
        created_by: data.updated_by, // Set on first create
      },
      {
        onConflict: "workspace_id",
      }
    )
    .select()
    .single();

  if (error || !profile) {
    console.error("Error upserting brand profile:", error);
    return null;
  }

  return {
    id: profile.id,
    workspace_id: profile.workspace_id,
    brand_description: profile.brand_description,
    target_audience: profile.target_audience,
    voice_tone: (profile.voice_tone || {}) as BrandProfile["voice_tone"],
    brand_attributes: (profile.brand_attributes || {}) as BrandProfile["brand_attributes"],
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    created_by: profile.created_by,
    updated_by: profile.updated_by,
  };
}

