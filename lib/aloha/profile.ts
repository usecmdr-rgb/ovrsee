/**
 * Aloha Profile Management
 * 
 * Handles loading and managing Aloha agent profiles (display name, voice settings)
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
// Legacy voice support - using voice profiles instead
import { getDefaultVoice, isValidVoiceId, type AlohaVoice } from "./voices";
import {
  DEFAULT_VOICE_KEY,
  getVoiceProfileByKey,
  isValidVoiceKey,
  type AlohaVoiceKey,
} from "./voice-profiles";

export interface AlohaProfile {
  id: string;
  user_id: string;
  display_name: string;
  voice_id: string; // Legacy field, kept for backward compatibility
  voice_key?: AlohaVoiceKey | null; // New field for voice profile selection
  voice_options?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get Aloha profile for a user
 * Creates a default profile if one doesn't exist
 */
export async function getAlohaProfile(userId: string): Promise<AlohaProfile | null> {
  const supabase = getSupabaseServerClient();

  // Fetch all profiles for the user so we can detect/clean duplicates
  const { data: profiles, error } = await supabase
    .from("aloha_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching Aloha profile:", error);
    return null;
  }

  if (profiles && profiles.length > 0) {
    const [primaryProfile, ...duplicates] = profiles;

    if (duplicates.length > 0) {
      const duplicateIds = duplicates.map((profile) => profile.id);
      const { error: cleanupError } = await supabase
        .from("aloha_profiles")
        .delete()
        .in("id", duplicateIds);

      if (cleanupError) {
        console.warn(
          `Failed to clean up duplicate Aloha profiles for user ${userId}:`,
          cleanupError
        );
      } else {
        console.info(
          `Cleaned up ${duplicateIds.length} duplicate Aloha profiles for user ${userId}`
        );
      }
    }

    // Validate voice_id, fallback to default if invalid
    if (!isValidVoiceId(primaryProfile.voice_id)) {
      console.warn(
        `Invalid voice_id ${primaryProfile.voice_id} for user ${userId}, using default`
      );
      const defaultVoice = getDefaultVoice();
      const { error: voiceFixError } = await supabase
        .from("aloha_profiles")
        .update({ voice_id: defaultVoice.id })
        .eq("id", primaryProfile.id);

      if (voiceFixError) {
        console.error(
          `Failed to auto-fix invalid voice_id for user ${userId}:`,
          voiceFixError
        );
        return primaryProfile;
      }

      return { ...primaryProfile, voice_id: defaultVoice.id };
    }

    return primaryProfile;
  }

  // No profile exists, create default one
  const defaultVoice = getDefaultVoice();
  const { data: newProfile, error: createError } = await supabase
    .from("aloha_profiles")
    .insert({
      user_id: userId,
      display_name: "Aloha",
      voice_id: defaultVoice.id, // Legacy field
      voice_key: DEFAULT_VOICE_KEY, // New voice profile system
    })
    .select()
    .single();

  if (createError) {
    console.error("Error creating default Aloha profile:", createError);
    return null;
  }

  return newProfile;
}

/**
 * Update Aloha profile
 */
export async function updateAlohaProfile(
  userId: string,
  updates: {
    display_name?: string;
    voice_id?: string; // Legacy field
    voice_key?: AlohaVoiceKey; // New voice profile system
    voice_options?: Record<string, any> | null;
  }
): Promise<AlohaProfile | null> {
  const supabase = getSupabaseServerClient();

  // Validate voice_id if provided (legacy)
  if (updates.voice_id && !isValidVoiceId(updates.voice_id)) {
    console.warn(`Invalid voice_id ${updates.voice_id}, using default`);
    updates.voice_id = getDefaultVoice().id;
  }

  // Validate voice_key if provided
  if (updates.voice_key) {
    if (!isValidVoiceKey(updates.voice_key)) {
      console.warn(`Invalid voice_key ${updates.voice_key}, using default`);
      updates.voice_key = DEFAULT_VOICE_KEY;
    }
  }

  // Ensure profile exists first
  const existingProfile = await getAlohaProfile(userId);
  if (!existingProfile) {
    // Create profile if it doesn't exist
    const defaultVoice = getDefaultVoice();
    const { data: newProfile, error: createError } = await supabase
      .from("aloha_profiles")
      .insert({
        user_id: userId,
        display_name: updates.display_name || "Aloha",
        voice_id: updates.voice_id || defaultVoice.id, // Legacy
        voice_key: updates.voice_key || DEFAULT_VOICE_KEY, // New system
        voice_options: updates.voice_options || null,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating Aloha profile:", createError);
      return null;
    }

    return newProfile;
  }

  // Update existing profile
  const { data, error } = await supabase
    .from("aloha_profiles")
    .update(updates)
    .eq("id", existingProfile.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating Aloha profile:", error);
    return null;
  }

  return data;
}

/**
 * Get display name for Aloha (with fallback)
 */
export async function getAlohaDisplayName(userId: string): Promise<string> {
  const profile = await getAlohaProfile(userId);
  return profile?.display_name || "Aloha";
}

/**
 * Get voice settings for Aloha (with fallback)
 * 
 * NOTE: This function is kept for backward compatibility.
 * New code should use getAlohaVoiceProfile() instead.
 */
export async function getAlohaVoice(userId: string): Promise<AlohaVoice> {
  const profile = await getAlohaProfile(userId);
  if (profile?.voice_id) {
    const { getVoiceById } = await import("./voices");
    const voice = getVoiceById(profile.voice_id);
    if (voice) return voice;
  }
  return getDefaultVoice();
}

/**
 * Get voice profile for Aloha (new voice profile system)
 */
export async function getAlohaVoiceProfile(
  userId: string
): Promise<ReturnType<typeof getVoiceProfileByKey>> {
  const profile = await getAlohaProfile(userId);
  const voiceKey = profile?.voice_key || DEFAULT_VOICE_KEY;
  return getVoiceProfileByKey(voiceKey);
}

