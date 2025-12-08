/**
 * Follow-Up Suggestions Job
 * Generates follow-up suggestions for leads that need attention
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { isFollowUpSuggestionsEnabled } from "../featureFlags";

export interface FollowUpGenerationResult {
  processed: number;
  suggestionsCreated: number;
  skipped: number;
  failed: number;
}

/**
 * Generate follow-up suggestions for leads
 */
export async function generateFollowUpsJob(
  userId?: string
): Promise<FollowUpGenerationResult> {
  if (!isFollowUpSuggestionsEnabled()) {
    console.log("[GenerateFollowUpsJob] Follow-up suggestions are disabled");
    return {
      processed: 0,
      suggestionsCreated: 0,
      skipped: 0,
      failed: 0,
    };
  }

  const supabase = getSupabaseServerClient();

  // Get user preferences for follow-up threshold
  const userQuery = supabase.from("user_sync_preferences").select("follow_up_threshold_days");
  if (userId) {
    userQuery.eq("user_id", userId);
  }

  const { data: preferences } = await userQuery.maybeSingle();
  const thresholdDays = preferences?.follow_up_threshold_days || 5;

  // Calculate threshold date
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

  // Find leads that need follow-ups
  const leadsQuery = supabase
    .from("leads")
    .select("id, user_id, last_email_id, last_activity_at, lead_stage")
    .in("lead_stage", ["qualified", "warm", "negotiating", "ready_to_close"])
    .lt("last_activity_at", thresholdDate.toISOString())
    .is("deleted_at", null);

  if (userId) {
    leadsQuery.eq("user_id", userId);
  }

  const { data: leads, error: leadsError } = await leadsQuery;

  if (leadsError || !leads || leads.length === 0) {
    console.log("[GenerateFollowUpsJob] No leads need follow-ups");
    return {
      processed: 0,
      suggestionsCreated: 0,
      skipped: 0,
      failed: 0,
    };
  }

  const result: FollowUpGenerationResult = {
    processed: leads.length,
    suggestionsCreated: 0,
    skipped: 0,
    failed: 0,
  };

  for (const lead of leads) {
    try {
      // Check if there's already a pending suggestion
      const { data: existingSuggestion } = await supabase
        .from("lead_follow_up_suggestions")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingSuggestion) {
        result.skipped++;
        continue;
      }

      // Check if there's an upcoming appointment (next 7 days)
      if (lead.last_email_id) {
        const { data: email } = await supabase
          .from("email_queue")
          .select("gmail_thread_id")
          .eq("id", lead.last_email_id)
          .single();

        if (email?.gmail_thread_id) {
          // Check for appointments in this thread
          const { data: appointments } = await supabase
            .from("email_appointments")
            .select("start_at")
            .eq("user_id", lead.user_id)
            .in(
              "email_id",
              supabase
                .from("email_queue")
                .select("id")
                .eq("gmail_thread_id", email.gmail_thread_id)
                .eq("user_id", lead.user_id)
            )
            .gte("start_at", new Date().toISOString())
            .lte("start_at", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

          if (appointments && appointments.length > 0) {
            // Has upcoming appointment, skip follow-up
            result.skipped++;
            continue;
          }
        }
      }

      // Create follow-up suggestion
      const suggestedFor = new Date();
      suggestedFor.setDate(suggestedFor.getDate() + 1); // Suggest for tomorrow
      suggestedFor.setHours(9, 0, 0, 0); // 9 AM

      const { error: insertError } = await supabase
        .from("lead_follow_up_suggestions")
        .insert({
          user_id: lead.user_id,
          lead_id: lead.id,
          email_id: lead.last_email_id,
          reason: "no_reply",
          suggested_for: suggestedFor.toISOString(),
          status: "pending",
        });

      if (insertError) {
        console.error(`[GenerateFollowUpsJob] Error creating suggestion for lead ${lead.id}:`, insertError);
        result.failed++;
      } else {
        result.suggestionsCreated++;
      }
    } catch (error: any) {
      console.error(`[GenerateFollowUpsJob] Error processing lead ${lead.id}:`, error);
      result.failed++;
    }
  }

  return result;
}


