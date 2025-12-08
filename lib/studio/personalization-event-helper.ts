/**
 * Studio Personalization Event Helper
 * 
 * Helper functions to capture user behavior events for personalization.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FeedbackSource = "planner" | "agent" | "repurpose" | "manual" | "unknown";
export type FeedbackEventType = "accepted" | "deleted" | "heavily_edited" | "lightly_edited";

/**
 * Calculate edit distance between two strings (simple Levenshtein-like)
 */
function calculateEditDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate edit distance percentage
 */
function calculateEditDistancePercentage(str1: string, str2: string): number {
  if (str1.length === 0 && str2.length === 0) return 0;
  if (str1.length === 0) return 100;
  if (str2.length === 0) return 100;

  const distance = calculateEditDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return (distance / maxLength) * 100;
}

/**
 * Extract hashtags from text
 */
function extractHashtags(text: string): string[] {
  const hashtagRegex = /#\w+/g;
  return text.match(hashtagRegex) || [];
}

/**
 * Capture a feedback event
 */
export async function captureFeedbackEvent(
  workspaceId: string,
  postId: string,
  eventType: FeedbackEventType,
  options: {
    source?: FeedbackSource;
    userId?: string;
    details?: Record<string, any>;
    supabaseClient?: SupabaseClient;
  } = {}
): Promise<void> {
  const supabase = options.supabaseClient || getSupabaseServerClient();

  // Determine source if not provided
  let source: FeedbackSource = options.source || "unknown";
  if (!options.source) {
    // Try to infer from post metadata
    const { data: post } = await supabase
      .from("studio_social_posts")
      .select("metadata")
      .eq("id", postId)
      .single();

    if (post?.metadata) {
      const generatedBy = post.metadata.generated_by;
      if (generatedBy === "weekly_planner") {
        source = "planner";
      } else if (generatedBy === "agent") {
        source = "agent";
      } else if (post.metadata.repurposed_from) {
        source = "repurpose";
      }
    }
  }

  // Insert feedback event
  await supabase.from("studio_ai_feedback_events").insert({
    workspace_id: workspaceId,
    post_id: postId,
    source,
    event_type: eventType,
    details: options.details || {},
    created_by: options.userId || null,
  });
}

/**
 * Capture edit event when caption is updated
 */
export async function captureEditEvent(
  workspaceId: string,
  postId: string,
  oldCaption: string | null,
  newCaption: string | null,
  options: {
    userId?: string;
    supabaseClient?: SupabaseClient;
  } = {}
): Promise<void> {
  const supabase = options.supabaseClient || getSupabaseServerClient();

  const oldCaptionText = oldCaption || "";
  const newCaptionText = newCaption || "";

  // If captions are the same, skip
  if (oldCaptionText === newCaptionText) {
    return;
  }

  // Calculate edit distance
  const editDistance = calculateEditDistance(oldCaptionText, newCaptionText);
  const editDistancePercent = calculateEditDistancePercentage(oldCaptionText, newCaptionText);

  // Calculate length change
  const lengthChange = newCaptionText.length - oldCaptionText.length;
  const lengthChangePercent =
    oldCaptionText.length > 0
      ? (lengthChange / oldCaptionText.length) * 100
      : newCaptionText.length > 0
      ? 100
      : 0;

  // Calculate hashtag changes
  const oldHashtags = extractHashtags(oldCaptionText);
  const newHashtags = extractHashtags(newCaptionText);
  const hashtagChange = newHashtags.length - oldHashtags.length;

  // Determine event type
  let eventType: FeedbackEventType;
  if (editDistancePercent > 50) {
    eventType = "heavily_edited";
  } else if (editDistancePercent > 10) {
    eventType = "lightly_edited";
  } else {
    // Minor changes might be considered "accepted"
    eventType = "lightly_edited";
  }

  // Capture event
  await captureFeedbackEvent(workspaceId, postId, eventType, {
    userId: options.userId,
    details: {
      edit_distance: editDistance,
      edit_distance_percent: editDistancePercent,
      length_change: lengthChange,
      length_change_percent: lengthChangePercent,
      hashtag_change: hashtagChange,
      old_length: oldCaptionText.length,
      new_length: newCaptionText.length,
      old_hashtag_count: oldHashtags.length,
      new_hashtag_count: newHashtags.length,
    },
    supabaseClient: supabase,
  });
}

/**
 * Capture delete event when post is deleted
 */
export async function captureDeleteEvent(
  workspaceId: string,
  postId: string,
  options: {
    userId?: string;
    supabaseClient?: SupabaseClient;
  } = {}
): Promise<void> {
  await captureFeedbackEvent(workspaceId, postId, "deleted", {
    userId: options.userId,
    supabaseClient: options.supabaseClient,
  });
}

/**
 * Capture acceptance event (when post is published with minimal edits)
 */
export async function captureAcceptanceEvent(
  workspaceId: string,
  postId: string,
  options: {
    userId?: string;
    supabaseClient?: SupabaseClient;
  } = {}
): Promise<void> {
  await captureFeedbackEvent(workspaceId, postId, "accepted", {
    userId: options.userId,
    supabaseClient: options.supabaseClient,
  });
}

