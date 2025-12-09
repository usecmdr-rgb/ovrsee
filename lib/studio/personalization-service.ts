/**
 * Studio Personalization Service
 * 
 * Service for inferring user preferences from feedback events and applying them.
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface WorkspacePreferences {
  prefers_short_captions: boolean;
  prefers_fewer_hashtags: boolean;
  prefers_more_hashtags: boolean;
  tone_shift?: "more_casual" | "more_formal" | "no_change";
  avg_caption_length_reduction?: number; // Percentage reduction
  avg_hashtag_reduction?: number; // Average hashtag count reduction
  edit_frequency?: "high" | "medium" | "low"; // How often user edits AI content
}

/**
 * Summarize workspace preferences from feedback events
 */
export async function summarizeWorkspacePreferences(
  workspaceId: string,
  supabaseClient?: SupabaseClient
): Promise<WorkspacePreferences> {
  const supabase = supabaseClient || getSupabaseServerClient();

  // Fetch recent feedback events (last 90 days)
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - 90);

  const { data: events, error } = await supabase
    .from("studio_ai_feedback_events")
    .select(`
      *,
      studio_social_posts (
        caption
      )
    `)
    .eq("workspace_id", workspaceId)
    .gte("created_at", thresholdDate.toISOString())
    .in("event_type", ["heavily_edited", "lightly_edited", "accepted"]);

  if (error || !events || events.length === 0) {
    // Return default preferences if no data
    return {
      prefers_short_captions: false,
      prefers_fewer_hashtags: false,
      prefers_more_hashtags: false,
      edit_frequency: "low",
    };
  }

  // Analyze edit events
  const editEvents = events.filter(
    (e) => e.event_type === "heavily_edited" || e.event_type === "lightly_edited"
  );

  let totalLengthReduction = 0;
  let totalLengthReductionCount = 0;
  let totalHashtagReduction = 0;
  let totalHashtagReductionCount = 0;

  for (const event of editEvents) {
    const details = event.details as any;
    if (details?.length_change_percent !== undefined) {
      totalLengthReduction += Math.abs(details.length_change_percent);
      totalLengthReductionCount++;
    }
    if (details?.hashtag_change !== undefined) {
      totalHashtagReduction += details.hashtag_change;
      totalHashtagReductionCount++;
    }
  }

  const avgLengthReduction =
    totalLengthReductionCount > 0 ? totalLengthReduction / totalLengthReductionCount : 0;
  const avgHashtagChange =
    totalHashtagReductionCount > 0 ? totalHashtagReduction / totalHashtagReductionCount : 0;

  // Determine preferences
  const prefersShortCaptions = avgLengthReduction > 20; // User reduces length by >20% on average
  const prefersFewerHashtags = avgHashtagChange < -1; // User removes more than 1 hashtag on average
  const prefersMoreHashtags = avgHashtagChange > 1; // User adds more than 1 hashtag on average

  // Calculate edit frequency
  const editRate = editEvents.length / events.length;
  let editFrequency: "high" | "medium" | "low";
  if (editRate > 0.7) {
    editFrequency = "high";
  } else if (editRate > 0.3) {
    editFrequency = "medium";
  } else {
    editFrequency = "low";
  }

  // Tone shift (simplified - would need more sophisticated analysis)
  // For v1, we'll leave this as optional
  const toneShift: "more_casual" | "more_formal" | "no_change" | undefined = undefined;

  return {
    prefers_short_captions: prefersShortCaptions,
    prefers_fewer_hashtags: prefersFewerHashtags,
    prefers_more_hashtags: prefersMoreHashtags,
    tone_shift: toneShift,
    avg_caption_length_reduction: avgLengthReduction > 0 ? Math.round(avgLengthReduction) : undefined,
    avg_hashtag_reduction: avgHashtagChange < 0 ? Math.round(Math.abs(avgHashtagChange)) : undefined,
    edit_frequency: editFrequency,
  };
}

/**
 * Format preferences for LLM prompt
 */
export function formatPreferencesForPrompt(
  preferences: WorkspacePreferences
): string {
  const parts: string[] = [];

  if (preferences.prefers_short_captions) {
    parts.push(
      `- User tends to shorten captions by ${preferences.avg_caption_length_reduction || 20}% on average`
    );
  }

  if (preferences.prefers_fewer_hashtags) {
    parts.push(
      `- User typically removes ${preferences.avg_hashtag_reduction || 2} hashtags from suggestions`
    );
  } else if (preferences.prefers_more_hashtags) {
    parts.push("- User tends to add more hashtags to suggestions");
  }

  if (preferences.edit_frequency === "high") {
    parts.push("- User frequently edits AI-generated content (high edit rate)");
  } else if (preferences.edit_frequency === "low") {
    parts.push("- User typically accepts AI-generated content with minimal edits");
  }

  if (preferences.tone_shift) {
    parts.push(`- User tends to make content ${preferences.tone_shift.replace("_", " ")}`);
  }

  if (parts.length === 0) {
    return "No strong preferences detected yet.";
  }

  return `Learned User Preferences:\n${parts.join("\n")}`;
}

