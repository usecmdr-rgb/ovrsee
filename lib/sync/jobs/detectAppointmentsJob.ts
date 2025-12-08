/**
 * Appointment Detection Background Job
 * Automatically detects appointments in emails that have been classified
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { detectAppointment } from "@/lib/sync/detectAppointment";
import { isSyncIntelligenceEnabled, getSyncBatchSize, getSyncMaxRetries } from "@/lib/sync/featureFlags";

export interface AppointmentDetectionJobResult {
  processed: number;
  detected: number;
  failed: number;
}

const MIN_CONFIDENCE_THRESHOLD = 0.7; // Only store appointments with confidence >= 0.7

/**
 * Process a batch of emails for appointment detection
 * Only processes emails that have been classified and don't already have appointments
 */
export async function processAppointmentDetectionBatch(): Promise<AppointmentDetectionJobResult> {
  if (!isSyncIntelligenceEnabled()) {
    console.log("[DetectAppointmentsJob] Sync Intelligence is disabled, skipping");
    return { processed: 0, detected: 0, failed: 0 };
  }

  const supabase = getSupabaseServerClient();
  const batchSize = getSyncBatchSize();
  const maxRetries = getSyncMaxRetries();

  let processed = 0;
  let detected = 0;
  let failed = 0;

  try {
    // Find emails that need appointment detection
    // Only process emails that have been classified and don't have appointments yet
    const { data: emailsToProcess, error: fetchError } = await supabase
      .from("email_queue")
      .select("id, user_id, from_address, subject, body_text, to_addresses, internal_date, category, has_appointment")
      .eq("has_appointment", false)
      .not("category", "is", null) // Only process classified emails
      .is("deleted_at", null)
      .order("internal_date", { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      console.error("[DetectAppointmentsJob] Error fetching emails:", fetchError);
      return { processed: 0, detected: 0, failed: 0 };
    }

    if (!emailsToProcess || emailsToProcess.length === 0) {
      return { processed: 0, detected: 0, failed: 0 };
    }

    // Process each email
    for (const email of emailsToProcess) {
      processed++;
      let retries = 0;
      let success = false;

      while (retries < maxRetries && !success) {
        try {
          // Check if appointment already exists (idempotency)
          const { data: existingAppointment } = await supabase
            .from("email_appointments")
            .select("id")
            .eq("email_id", email.id)
            .single();

          if (existingAppointment) {
            // Already processed, skip
            success = true;
            continue;
          }

          // Detect appointment
          const detection = await detectAppointment(
            email.from_address || "",
            email.subject || "(No subject)",
            email.body_text || null,
            email.to_addresses || [],
            email.internal_date
          );

          // Only store if appointment detected and confidence is high enough
          if (detection.hasAppointment && detection.appointment && (detection.confidence || 0) >= MIN_CONFIDENCE_THRESHOLD) {
            const { appointment } = detection;

            // Insert appointment into database
            const { error: insertError } = await supabase
              .from("email_appointments")
              .insert({
                email_id: email.id,
                user_id: email.user_id,
                appointment_type: detection.appointmentType || "proposal",
                title: appointment.title,
                description: appointment.description || null,
                appointment_date: appointment.date,
                appointment_time: appointment.time,
                timezone: appointment.timezone || "America/New_York",
                location: appointment.location || null,
                duration_minutes: appointment.duration_minutes || 60,
                attendees: appointment.attendees || [],
                status: "detected",
                confidence: detection.confidence || null,
                extraction_raw: detection.rawResponse,
              });

            if (insertError) {
              throw new Error(`Failed to insert appointment: ${insertError.message}`);
            }

            // Update email to mark as having appointment
            const { error: updateError } = await supabase
              .from("email_queue")
              .update({
                has_appointment: true,
                appointment_detected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", email.id);

            if (updateError) {
              throw new Error(`Failed to update email: ${updateError.message}`);
            }

            detected++;
            console.log(
              `[DetectAppointmentsJob] Detected appointment in email ${email.id}: ${appointment.title} on ${appointment.date}`
            );
          }

          success = true;
        } catch (error: any) {
          retries++;
          console.error(
            `[DetectAppointmentsJob] Error detecting appointment for email ${email.id} (attempt ${retries}/${maxRetries}):`,
            error
          );

          if (retries >= maxRetries) {
            failed++;
          } else {
            // Exponential backoff
            const backoffMs = Math.pow(2, retries) * 60 * 1000;
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
          }
        }
      }
    }

    return { processed, detected, failed };
  } catch (error: any) {
    console.error("[DetectAppointmentsJob] Fatal error:", error);
    return { processed, detected, failed };
  }
}


