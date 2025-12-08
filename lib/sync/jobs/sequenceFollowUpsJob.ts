/**
 * Sequence Follow-Ups Job
 * Processes leads enrolled in multi-step follow-up sequences
 * Generates prepared drafts when sequence steps are due
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { generateFollowUpDraft } from "../generateFollowUpDraft";
import { isAutoSequenceFollowUpsEnabled } from "../featureFlags";
import type { Lead, Contact } from "../crm";

/**
 * Run the sequence follow-ups job for a specific user
 * Finds leads with sequences and generates prepared drafts when steps are due
 */
export async function runSequenceFollowUpsJob(userId: string): Promise<{
  processed: number;
  created: number;
  errors: number;
}> {
  if (!isAutoSequenceFollowUpsEnabled()) {
    console.log("[SequenceFollowUpsJob] Feature disabled, skipping");
    return { processed: 0, created: 0, errors: 0 };
  }

  const supabase = getSupabaseServerClient();
  let processed = 0;
  let created = 0;
  let errors = 0;

  try {
    // Find leads with sequences that need follow-ups:
    // 1. sequence_id NOT NULL
    // 2. lead_stage IN ('qualified', 'warm', 'negotiating', 'ready_to_close')
    // 3. last_activity_at exists
    // 4. next_sequence_step_order exists
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select(`
        id,
        contact_id,
        last_email_id,
        last_activity_at,
        lead_stage,
        lead_score,
        sequence_id,
        next_sequence_step_order,
        contacts!inner(
          id,
          email,
          name,
          company
        )
      `)
      .eq("user_id", userId)
      .not("sequence_id", "is", null)
      .in("lead_stage", ["qualified", "warm", "negotiating", "ready_to_close"])
      .not("last_activity_at", "is", null)
      .not("next_sequence_step_order", "is", null);

    if (leadsError) {
      console.error("[SequenceFollowUpsJob] Error fetching leads:", leadsError);
      throw leadsError;
    }

    if (!leads || leads.length === 0) {
      console.log("[SequenceFollowUpsJob] No leads with sequences need follow-ups");
      return { processed: 0, created: 0, errors: 0 };
    }

    console.log(`[SequenceFollowUpsJob] Found ${leads.length} leads with sequences`);

    // Process each lead
    for (const lead of leads) {
      processed++;

      try {
        // Get the current step
        const { data: currentStep, error: stepError } = await supabase
          .from("follow_up_sequence_steps")
          .select("*")
          .eq("sequence_id", lead.sequence_id)
          .eq("step_order", lead.next_sequence_step_order)
          .single();

        if (stepError || !currentStep) {
          console.log(`[SequenceFollowUpsJob] Step ${lead.next_sequence_step_order} not found for sequence ${lead.sequence_id}, clearing sequence`);
          // Clear sequence if step doesn't exist
          await supabase
            .from("leads")
            .update({
              sequence_id: null,
              next_sequence_step_order: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", lead.id)
            .eq("user_id", userId);
          continue;
        }

        // Check if step is due
        const thresholdDate = new Date(lead.last_activity_at);
        thresholdDate.setDate(thresholdDate.getDate() + currentStep.days_after_last_activity);
        const now = new Date();

        if (now < thresholdDate) {
          console.log(`[SequenceFollowUpsJob] Step ${lead.next_sequence_step_order} for lead ${lead.id} not due yet`);
          continue;
        }

        // Check if unconsumed draft already exists
        const { data: existingDraft } = await supabase
          .from("prepared_follow_up_drafts")
          .select("id")
          .eq("user_id", userId)
          .eq("lead_id", lead.id)
          .eq("consumed", false)
          .maybeSingle();

        if (existingDraft) {
          console.log(`[SequenceFollowUpsJob] Lead ${lead.id} already has an unconsumed draft, skipping`);
          continue;
        }

        // Need last_email_id to generate draft
        if (!lead.last_email_id) {
          console.log(`[SequenceFollowUpsJob] Lead ${lead.id} has no last_email_id, skipping`);
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
          console.log(`[SequenceFollowUpsJob] Email ${lead.last_email_id} not found, skipping`);
          continue;
        }

        // Generate follow-up draft with step context
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
          followUpReason: `sequence_step_${currentStep.step_order}_${currentStep.label}`,
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
          console.error(`[SequenceFollowUpsJob] Error inserting draft for lead ${lead.id}:`, insertError);
          errors++;
          continue;
        }

        // Get next step
        const { data: nextStep } = await supabase
          .from("follow_up_sequence_steps")
          .select("step_order")
          .eq("sequence_id", lead.sequence_id)
          .eq("step_order", lead.next_sequence_step_order + 1)
          .single();

        // Update lead
        const updateData: any = {
          last_follow_up_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (nextStep) {
          // Move to next step
          updateData.next_sequence_step_order = nextStep.step_order;
        } else {
          // No more steps, clear sequence
          updateData.next_sequence_step_order = null;
          updateData.sequence_id = null;
        }

        const { error: updateError } = await supabase
          .from("leads")
          .update(updateData)
          .eq("id", lead.id)
          .eq("user_id", userId);

        if (updateError) {
          console.error(`[SequenceFollowUpsJob] Error updating lead ${lead.id}:`, updateError);
          // Don't fail the whole job, just log
        }

        created++;
        console.log(`[SequenceFollowUpsJob] Created draft for lead ${lead.id}, step ${lead.next_sequence_step_order}`);
      } catch (error: any) {
        console.error(`[SequenceFollowUpsJob] Error processing lead ${lead.id}:`, error);
        errors++;
      }
    }

    console.log(`[SequenceFollowUpsJob] Completed: processed=${processed}, created=${created}, errors=${errors}`);
    return { processed, created, errors };
  } catch (error: any) {
    console.error("[SequenceFollowUpsJob] Fatal error:", error);
    throw error;
  }
}


