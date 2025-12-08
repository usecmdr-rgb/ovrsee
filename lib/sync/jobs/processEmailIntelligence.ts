/**
 * Email Intelligence Processing Orchestrator
 * Runs all intelligence jobs in sequence: classification → appointment detection → task extraction
 */

import { processClassificationBatch } from "./classifyEmailsJob";
import { processAppointmentDetectionBatch } from "./detectAppointmentsJob";
import { processTaskExtractionBatch } from "./extractTasksJob";
import { processCrmBatch } from "./processCrmJob";
import { isSyncIntelligenceEnabled } from "@/lib/sync/featureFlags";

export interface IntelligenceProcessingResult {
  classification: {
    processed: number;
    succeeded: number;
    failed: number;
  };
  appointments: {
    processed: number;
    detected: number;
    failed: number;
  };
  tasks: {
    processed: number;
    tasksCreated: number;
    remindersCreated: number;
    failed: number;
  };
  crm?: {
    processed: number;
    contactsCreated: number;
    contactsUpdated: number;
    leadsCreated: number;
    leadsUpdated: number;
    failed: number;
  };
}

/**
 * Process all intelligence jobs for emails
 * Runs in sequence: classification → appointments → tasks
 */
export async function processEmailIntelligence(): Promise<IntelligenceProcessingResult> {
  if (!isSyncIntelligenceEnabled()) {
    console.log("[ProcessEmailIntelligence] Sync Intelligence is disabled");
    return {
      classification: { processed: 0, succeeded: 0, failed: 0 },
      appointments: { processed: 0, detected: 0, failed: 0 },
      tasks: { processed: 0, tasksCreated: 0, remindersCreated: 0, failed: 0 },
    };
  }

  console.log("[ProcessEmailIntelligence] Starting intelligence processing...");

  // Step 1: Classification (must run first)
  const classificationResult = await processClassificationBatch();
  console.log(
    `[ProcessEmailIntelligence] Classification: ${classificationResult.succeeded}/${classificationResult.processed} succeeded`
  );

  // Step 2: Appointment detection (runs after classification)
  const appointmentResult = await processAppointmentDetectionBatch();
  console.log(
    `[ProcessEmailIntelligence] Appointments: ${appointmentResult.detected}/${appointmentResult.processed} detected`
  );

  // Step 3: Task extraction (runs after classification)
  const taskResult = await processTaskExtractionBatch();
  console.log(
    `[ProcessEmailIntelligence] Tasks: ${taskResult.tasksCreated} tasks, ${taskResult.remindersCreated} reminders from ${taskResult.processed} emails`
  );

  // Step 4: CRM processing (runs after classification and intent extraction)
  let crmResult;
  try {
    crmResult = await processCrmBatch();
    console.log(
      `[ProcessEmailIntelligence] CRM: ${crmResult.leadsCreated} leads created, ${crmResult.leadsUpdated} leads updated from ${crmResult.processed} emails`
    );
  } catch (error) {
    console.error("[ProcessEmailIntelligence] Error in CRM processing:", error);
    // Don't fail the entire pipeline if CRM processing fails
    crmResult = {
      processed: 0,
      contactsCreated: 0,
      contactsUpdated: 0,
      leadsCreated: 0,
      leadsUpdated: 0,
      failed: 0,
    };
  }

  return {
    classification: classificationResult,
    appointments: appointmentResult,
    tasks: taskResult,
    crm: crmResult,
  };
}

