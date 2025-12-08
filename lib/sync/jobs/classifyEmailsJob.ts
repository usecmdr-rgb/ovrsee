/**
 * Email Classification Background Job
 * Automatically classifies emails that have classification_status = 'pending'
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { classifyEmail } from "@/lib/sync/classifyEmail";
import { isSyncIntelligenceEnabled, getSyncBatchSize, getSyncMaxRetries } from "@/lib/sync/featureFlags";

export interface ClassificationJobResult {
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Process a batch of emails for classification
 * Uses database-level locking to prevent duplicate processing
 */
export async function processClassificationBatch(): Promise<ClassificationJobResult> {
  if (!isSyncIntelligenceEnabled()) {
    console.log("[ClassifyEmailsJob] Sync Intelligence is disabled, skipping");
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const supabase = getSupabaseServerClient();
  const batchSize = getSyncBatchSize();
  const maxRetries = getSyncMaxRetries();

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    // Find emails that need classification
    // Use atomic update to claim emails for processing
    const { data: emailsToProcess, error: fetchError } = await supabase
      .from("email_queue")
      .select("id, user_id, from_address, subject, body_text, classification_status")
      .eq("classification_status", "pending")
      .is("deleted_at", null)
      .limit(batchSize);

    if (fetchError) {
      console.error("[ClassifyEmailsJob] Error fetching emails:", fetchError);
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    if (!emailsToProcess || emailsToProcess.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // Atomically claim emails for processing
    const emailIds = emailsToProcess.map((e) => e.id);
    const { error: claimError } = await supabase
      .from("email_queue")
      .update({
        classification_status: "processing",
        classification_attempted_at: new Date().toISOString(),
      })
      .in("id", emailIds)
      .eq("classification_status", "pending");

    if (claimError) {
      console.error("[ClassifyEmailsJob] Error claiming emails:", claimError);
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    // Process each email
    for (const email of emailsToProcess) {
      processed++;
      let retries = 0;
      let success = false;

      while (retries < maxRetries && !success) {
        try {
          // Classify the email
          const classification = await classifyEmail(
            email.from_address || "",
            email.subject || "(No subject)",
            email.body_text || null
          );

          // Update email with classification result
          const { error: updateError } = await supabase
            .from("email_queue")
            .update({
              category: classification.category,
              classification_raw: classification.rawResponse,
              classification_status: "completed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", email.id)
            .eq("user_id", email.user_id);

          if (updateError) {
            throw new Error(`Failed to update email: ${updateError.message}`);
          }

          success = true;
          succeeded++;
          console.log(
            `[ClassifyEmailsJob] Classified email ${email.id} as "${classification.category}"`
          );
        } catch (error: any) {
          retries++;
          console.error(
            `[ClassifyEmailsJob] Error classifying email ${email.id} (attempt ${retries}/${maxRetries}):`,
            error
          );

          if (retries >= maxRetries) {
            // Mark as failed after max retries
            await supabase
              .from("email_queue")
              .update({
                classification_status: "failed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", email.id);

            failed++;
          } else {
            // Exponential backoff: wait 2^retries minutes
            const backoffMs = Math.pow(2, retries) * 60 * 1000;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          }
        }
      }
    }

    return { processed, succeeded, failed };
  } catch (error: any) {
    console.error("[ClassifyEmailsJob] Fatal error:", error);
    return { processed, succeeded, failed };
  }
}


