/**
 * Studio Hashtag Service
 * 
 * Service for parsing, storing, and managing hashtags from post captions.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Parse hashtags from a caption text
 * Extracts all #hashtag patterns (case-insensitive, normalized to lowercase)
 */
export function parseHashtags(caption: string | null | undefined): string[] {
  if (!caption) return [];

  // Match # followed by alphanumeric characters and underscores
  // Exclude # at end of string or followed by non-word characters
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
  const matches = caption.match(hashtagRegex);

  if (!matches) return [];

  // Extract hashtag names (without #), normalize to lowercase, remove duplicates
  const hashtags = matches
    .map((match) => match.substring(1).toLowerCase())
    .filter((tag, index, self) => self.indexOf(tag) === index); // Remove duplicates

  return hashtags;
}

/**
 * Upsert hashtags for a workspace and link them to a post
 */
export async function upsertPostHashtags(
  workspaceId: string,
  postId: string,
  caption: string | null | undefined,
  supabaseClient?: SupabaseClient
): Promise<string[]> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Parse hashtags from caption
  const hashtagNames = parseHashtags(caption);

  if (hashtagNames.length === 0) {
    // Remove all existing hashtag links for this post
    await supabase
      .from("studio_post_hashtags")
      .delete()
      .eq("post_id", postId);

    return [];
  }

  // Upsert hashtags (create if not exists, update last_used_at if exists)
  const hashtagIds: string[] = [];

  for (const hashtagName of hashtagNames) {
    // Try to find existing hashtag
    const { data: existing } = await supabase
      .from("studio_hashtags")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("name", hashtagName)
      .single();

    let hashtagId: string;

    if (existing) {
      hashtagId = existing.id;
      // Update last_used_at
      await supabase
        .from("studio_hashtags")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", hashtagId);
    } else {
      // Create new hashtag
      const { data: newHashtag, error } = await supabase
        .from("studio_hashtags")
        .insert({
          workspace_id: workspaceId,
          name: hashtagName,
          first_used_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !newHashtag) {
        console.error(`Failed to create hashtag ${hashtagName}:`, error);
        continue;
      }

      hashtagId = newHashtag.id;
    }

    hashtagIds.push(hashtagId);
  }

  // Remove old hashtag links for this post
  await supabase
    .from("studio_post_hashtags")
    .delete()
    .eq("post_id", postId);

  // Create new hashtag links
  if (hashtagIds.length > 0) {
    const links = hashtagIds.map((hashtagId) => ({
      post_id: postId,
      hashtag_id: hashtagId,
    }));

    const { error: linkError } = await supabase
      .from("studio_post_hashtags")
      .insert(links);

    if (linkError) {
      console.error("Failed to link hashtags to post:", linkError);
    }
  }

  return hashtagNames;
}

/**
 * Get hashtags for a post
 */
export async function getPostHashtags(
  postId: string,
  supabaseClient?: SupabaseClient
): Promise<string[]> {
  const supabase = supabaseClient || getSupabaseServerClient();

  const { data: links, error } = await supabase
    .from("studio_post_hashtags")
    .select(`
      hashtag_id,
      studio_hashtags (
        name
      )
    `)
    .eq("post_id", postId);

  if (error || !links) {
    return [];
  }

  return links
    .map((link: any) => link.studio_hashtags?.name)
    .filter((name: string | undefined): name is string => !!name);
}

/**
 * Backfill hashtags from existing posts
 * Useful for migrating existing data
 */
export async function backfillHashtagsFromPosts(
  workspaceId: string,
  limit: number = 1000,
  supabaseClient?: SupabaseClient
): Promise<{ processed: number; hashtagsFound: number }> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Fetch posts with captions
  const { data: posts, error } = await supabase
    .from("studio_social_posts")
    .select("id, caption")
    .eq("workspace_id", workspaceId)
    .not("caption", "is", null)
    .limit(limit);

  if (error || !posts) {
    console.error("Failed to fetch posts for backfill:", error);
    return { processed: 0, hashtagsFound: 0 };
  }

  let hashtagsFound = 0;

  // Process each post
  for (const post of posts) {
    const hashtags = await upsertPostHashtags(
      workspaceId,
      post.id,
      post.caption,
      supabase
    );
    hashtagsFound += hashtags.length;
  }

  return {
    processed: posts.length,
    hashtagsFound,
  };
}

