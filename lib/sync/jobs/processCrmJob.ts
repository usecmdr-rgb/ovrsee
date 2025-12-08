/**
 * CRM Processing Job
 * Processes emails for CRM extraction and lead scoring
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { isLeadScoringEnabled } from "../featureFlags";
import { upsertContactForEmail, getOrCreateLeadForContact, updateLeadFromEmailContext } from "../crm";
import { extractCrmFields } from "../extractCrmFields";
import { getBusinessContextForUser } from "../businessInfo";
import { getThreadContext } from "../getThreadContext";
import { detectOpportunitySignals } from "../detectOpportunitySignals";
import { isOpportunityDetectionEnabled } from "../featureFlags";

export interface CrmProcessingResult {
  processed: number;
  contactsCreated: number;
  contactsUpdated: number;
  leadsCreated: number;
  leadsUpdated: number;
  failed: number;
}

/**
 * Process CRM for a batch of emails
 */
export async function processCrmBatch(
  limit: number = 50
): Promise<CrmProcessingResult> {
  if (!isLeadScoringEnabled()) {
    console.log("[ProcessCrmBatch] Lead scoring is disabled");
    return {
      processed: 0,
      contactsCreated: 0,
      contactsUpdated: 0,
      leadsCreated: 0,
      leadsUpdated: 0,
      failed: 0,
    };
  }

  const supabase = getSupabaseServerClient();

  // Fetch emails that need CRM processing
  // Process emails that have been classified but not yet processed for CRM
  const { data: emails, error: fetchError } = await supabase
    .from("email_queue")
    .select("id, user_id, from_address, from_name, subject, body_text, body_html, gmail_thread_id, category")
    .eq("classification_status", "completed")
    .is("deleted_at", null)
    .limit(limit);

  if (fetchError || !emails || emails.length === 0) {
    console.log("[ProcessCrmBatch] No emails to process");
    return {
      processed: 0,
      contactsCreated: 0,
      contactsUpdated: 0,
      leadsCreated: 0,
      leadsUpdated: 0,
      failed: 0,
    };
  }

  const result: CrmProcessingResult = {
    processed: emails.length,
    contactsCreated: 0,
    contactsUpdated: 0,
    leadsCreated: 0,
    leadsUpdated: 0,
    failed: 0,
  };

  for (const email of emails) {
    try {
      // Step 1: Upsert contact
      const contact = await upsertContactForEmail({
        userId: email.user_id,
        email: email.from_address,
        name: email.from_name || null,
        company: null, // Would need to extract from email
        role: null,
        phone: null,
      });

      const isNewContact = contact.first_seen_at === contact.last_seen_at;
      if (isNewContact) {
        result.contactsCreated++;
      } else {
        result.contactsUpdated++;
      }

      // Step 2: Get or create lead
      // Get business_id if available
      const businessContext = await getBusinessContextForUser(email.user_id);
      const businessId = businessContext?.profile?.id || null;

      const lead = await getOrCreateLeadForContact({
        userId: email.user_id,
        contactId: contact.id,
        businessId,
      });

      const isNewLead = lead.created_at === lead.updated_at;
      if (isNewLead) {
        result.leadsCreated++;
      } else {
        result.leadsUpdated++;
      }

      // Step 3: Extract CRM fields using AI
      const emailBody = email.body_text || email.body_html?.replace(/<[^>]*>/g, " ") || "";
      
      // Get thread context if available
      let threadContext: string | undefined;
      if (email.gmail_thread_id) {
        const thread = await getThreadContext(email.user_id, email.gmail_thread_id, email.id);
        if (thread?.threadSummary) {
          threadContext = thread.threadSummary;
        }
      }

      // Get available services for matching
      const availableServices = businessContext?.services || [];

      const crmExtraction = await extractCrmFields({
        emailBody,
        emailSubject: email.subject || "",
        fromAddress: email.from_address,
        threadContext,
        availableServices: availableServices.map((s) => ({ id: s.id, name: s.name })),
      });

      // Step 4: Get intent metadata (appointments, tasks, reminders)
      const { data: appointments } = await supabase
        .from("email_appointments")
        .select("id")
        .eq("email_id", email.id)
        .eq("user_id", email.user_id);

      const { data: tasks } = await supabase
        .from("email_tasks")
        .select("id")
        .eq("email_id", email.id)
        .eq("user_id", email.user_id);

      const { data: reminders } = await supabase
        .from("email_reminders")
        .select("id")
        .eq("email_id", email.id)
        .eq("user_id", email.user_id);

      // Step 5: Update lead with context
      const updatedLead = await updateLeadFromEmailContext({
        userId: email.user_id,
        leadId: lead.id,
        emailId: email.id,
        intentMetadata: {
          appointments: appointments || [],
          tasks: tasks || [],
          reminders: reminders || [],
        },
        businessContext,
        aiCrmExtractionResult: crmExtraction,
      });

      // Step 6: Detect opportunity signals (if enabled)
      if (isOpportunityDetectionEnabled()) {
        try {
          const emailBody = email.body_text || email.body_html?.replace(/<[^>]*>/g, " ") || "";
          const opportunities = await detectOpportunitySignals({
            userId: email.user_id,
            emailId: email.id,
            threadId: email.gmail_thread_id || undefined,
            emailContent: emailBody,
            emailSubject: email.subject || "",
            lead: updatedLead,
            contactName: contact.name || undefined,
          });

          if (opportunities.length > 0) {
            // Insert opportunities
            const opportunityRows = opportunities.map((opp) => ({
              user_id: email.user_id,
              lead_id: lead.id,
              email_id: email.id,
              type: opp.type,
              strength: opp.strength,
              summary: opp.summary,
            }));

            const { error: oppError } = await supabase
              .from("lead_opportunities")
              .upsert(opportunityRows, {
                onConflict: "user_id,lead_id,email_id,type",
                ignoreDuplicates: false,
              });

            if (oppError) {
              console.error(`[ProcessCrmBatch] Error inserting opportunities for email ${email.id}:`, oppError);
            } else {
              // Update lead with primary opportunity (highest strength)
              const highestStrengthOpp = opportunities.reduce((highest, current) => {
                const strengthOrder = { low: 1, medium: 2, high: 3 };
                return strengthOrder[current.strength] > strengthOrder[highest.strength] ? current : highest;
              }, opportunities[0]);

              await supabase
                .from("leads")
                .update({
                  primary_opportunity_type: highestStrengthOpp.type,
                  primary_opportunity_strength: highestStrengthOpp.strength,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", lead.id)
                .eq("user_id", email.user_id);
            }
          }
        } catch (error: any) {
          console.error(`[ProcessCrmBatch] Error detecting opportunities for email ${email.id}:`, error);
          // Don't fail the entire pipeline if opportunity detection fails
        }
      }

      // Mark email as processed (we could add a crm_status field, but for now we'll just log)
      console.log(`[ProcessCrmBatch] Processed email ${email.id} for lead ${lead.id}`);
    } catch (error: any) {
      console.error(`[ProcessCrmBatch] Error processing email ${email.id}:`, error);
      result.failed++;
    }
  }

  return result;
}

