/**
 * Auto Follow-Up Draft Job
 * Generates prepared follow-up drafts for leads that need follow-ups
 * This is a semi-automatic system: drafts are prepared but require human review before sending
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { generateFollowUpDraft } from "../generateFollowUpDraft";
import { isAutoSequenceFollowUpsEnabled } from "../featureFlags";
import type { Lead, Contact } from "../crm";

/**
 * Run the auto follow-up draft job for a specific user
 * Finds leads that need follow-ups and generates prepared drafts
 */
export async function runAutoFollowUpDraftJob(userId: string): Promise<{
  processed: number;
  created: number;
  errors: number;
}> {
  if (!isAutoSequenceFollowUpsEnabled()) {
    console.log("[AutoFollowUpDraftJob] Feature disabled, skipping");
    return { processed: 0, created: 0, errors: 0 };
  }

  const supabase = getSupabaseServerClient();
  let processed = 0;
  let created = 0;
  let errors = 0;

  try {
    // Get user's follow-up threshold
    const { data: preferences } = await supabase
      .from("user_sync_preferences")
      .select("follow_up_threshold_days")
      .eq("user_id", userId)
      .single();

    const thresholdDays = preferences?.follow_up_threshold_days || 5; // Default 5 days

    // Calculate threshold date
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);
    const thresholdDateStr = thresholdDate.toISOString();

    // Find leads that need follow-ups:
    // 1. Stage in ('qualified', 'warm', 'negotiating', 'ready_to_close')
    // 2. last_activity_at is not NULL and < NOW() - threshold_days
    // 3. last_follow_up_generated_at is NULL or < last_activity_at
    // 4. No unconsumed prepared draft exists
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select(`
        id,
        contact_id,
        last_email_id,
        last_activity_at,
        lead_stage,
        lead_score,
        contacts!inner(
          id,
          email,
          name,
          company
        )
      `)
      .eq("user_id", userId)
      .in("lead_stage", ["qualified", "warm", "negotiating", "ready_to_close"])
      .not("last_activity_at", "is", null)
      .lt("last_activity_at", thresholdDateStr)
      .or(`last_follow_up_generated_at.is.null,last_follow_up_generated_at.lt.last_activity_at`);

    if (leadsError) {
      console.error("[AutoFollowUpDraftJob] Error fetching leads:", leadsError);
      throw leadsError;
    }

    if (!leads || leads.length === 0) {
      console.log("[AutoFollowUpDraftJob] No leads need follow-ups");
      return { processed: 0, created: 0, errors: 0 };
    }

    console.log(`[AutoFollowUpDraftJob] Found ${leads.length} leads that may need follow-ups`);

    // Process each lead
    for (const lead of leads) {
      processed++;

      try {
        // Check if unconsumed draft already exists
        const { data: existingDraft } = await supabase
          .from("prepared_follow_up_drafts")
          .select("id")
          .eq("user_id", userId)
          .eq("lead_id", lead.id)
          .eq("consumed", false)
          .maybeSingle();

        if (existingDraft) {
          console.log(`[AutoFollowUpDraftJob] Lead ${lead.id} already has an unconsumed draft, skipping`);
          continue;
        }

        // Need last_email_id to generate draft
        if (!lead.last_email_id) {
          console.log(`[AutoFollowUpDraftJob] Lead ${lead.id} has no last_email_id, skipping`);
          continue;
        }

        // Get email details
        const { data: email } = await supabase
          .from("email_queue")
          .select("id, gmail_thread_id")
          .eq("id", lead.last_email_id)
          .eq("user_id", userId)
          .single();

        if (!email) {
          console.log(`[AutoFollowUpDraftJob] Email ${lead.last_email_id} not found, skipping`);
          continue;
        }

        // Generate follow-up draft
        const draftBody = await generateFollowUpDraft({
          userId,
          emailId: email.id,
          threadId: email.gmail_thread_id || undefined,
          lead: {
            id: lead.id,
            user_id: userId,
            contact_id: lead.contact_id,
            lead_score: lead.lead_score,
            lead_stage: lead.lead_stage as Lead["lead_stage"],
            last_activity_at: lead.last_activity_at,
            last_email_id: lead.last_email_id,
            created_at: "",
            updated_at: "",
          },
          contact: {
            id: lead.contacts.id,
            user_id: userId,
            email: lead.contacts.email,
            name: lead.contacts.name || null,
            company: lead.contacts.company || null,
            first_seen_at: "",
            created_at: "",
            updated_at: "",
          },
          followUpReason: "no_reply",
        });

        // Insert prepared draft
        const { error: insertError } = await supabase
          .from("prepared_follow_up_drafts")
          .insert({
            user_id: userId,
            lead_id: lead.id,
            email_id: email.id,
            draft_body: draftBody,
            consumed: false,
          });

        if (insertError) {
          console.error(`[AutoFollowUpDraftJob] Error inserting draft for lead ${lead.id}:`, insertError);
          errors++;
          continue;
        }

        // Update lead's last_follow_up_generated_at
        const { error: updateError } = await supabase
          .from("leads")
          .update({
            last_follow_up_generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", lead.id)
          .eq("user_id", userId);

        if (updateError) {
          console.error(`[AutoFollowUpDraftJob] Error updating lead ${lead.id}:`, updateError);
          // Don't fail the whole job, just log
        }

        created++;
        console.log(`[AutoFollowUpDraftJob] Created draft for lead ${lead.id}`);
      } catch (error: any) {
        console.error(`[AutoFollowUpDraftJob] Error processing lead ${lead.id}:`, error);
        errors++;
      }
    }

    console.log(`[AutoFollowUpDraftJob] Completed: processed=${processed}, created=${created}, errors=${errors}`);
    return { processed, created, errors };
  } catch (error: any) {
    console.error("[AutoFollowUpDraftJob] Fatal error:", error);
    throw error;
  }
}
