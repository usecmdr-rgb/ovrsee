/**
 * CRM & Lead Scoring Service
 * Manages contacts, leads, and lead scoring logic
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getBusinessContextForUser } from "./businessInfo";

export interface Contact {
  id: string;
  user_id: string;
  email: string;
  name?: string | null;
  company?: string | null;
  role?: string | null;
  phone?: string | null;
  first_seen_at: string;
  last_seen_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  contact_id: string;
  business_id?: string | null;
  lead_score: number;
  lead_stage: "new" | "cold" | "qualified" | "warm" | "negotiating" | "ready_to_close" | "won" | "lost";
  primary_service_id?: string | null;
  budget?: string | null;
  timeline?: string | null;
  last_email_id?: string | null;
  last_activity_at: string;
  next_follow_up_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CRMExtractionResult {
  inferredServiceId?: string | null;
  inferredServiceName?: string | null;
  budgetText?: string | null;
  budgetLevel?: "low" | "medium" | "high" | "unknown";
  urgencyLevel?: "low" | "medium" | "high" | "unknown";
  intentType?: "pricing" | "appointment" | "general_question" | "support" | "other";
  wantsAppointment?: boolean;
  isNewLead?: boolean;
}

export interface LeadScoreInput {
  currentScore: number;
  intentType?: string;
  hasAppointmentRequest: boolean;
  hasPricingRequest: boolean;
  numMessagesInThread: number;
  urgencyLevel?: "low" | "medium" | "high" | "unknown";
  budgetSignal?: "low" | "medium" | "high" | "unknown";
  serviceValueWeight?: number; // 0-1 multiplier
}

export interface LeadScoreResult {
  newScore: number;
  stage: Lead["lead_stage"];
}

/**
 * Upsert contact for an email
 * Creates or updates contact information based on email sender
 */
export async function upsertContactForEmail(params: {
  userId: string;
  email: string;
  name?: string | null;
  company?: string | null;
  role?: string | null;
  phone?: string | null;
}): Promise<Contact> {
  const supabase = getSupabaseServerClient();
  const { userId, email, name, company, role, phone } = params;

  // Check if contact exists
  const { data: existing } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .eq("email", email.toLowerCase())
    .single();

  const now = new Date().toISOString();

  if (existing) {
    // Update existing contact
    const updateData: Partial<Contact> = {
      last_seen_at: now,
      updated_at: now,
    };

    // Only update fields if new non-empty values are provided
    if (name && name.trim()) updateData.name = name.trim();
    if (company && company.trim()) updateData.company = company.trim();
    if (role && role.trim()) updateData.role = role.trim();
    if (phone && phone.trim()) updateData.phone = phone.trim();

    const { data: updated, error } = await supabase
      .from("contacts")
      .update(updateData)
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contact: ${error.message}`);
    }

    return updated!;
  } else {
    // Create new contact
    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        user_id: userId,
        email: email.toLowerCase(),
        name: name?.trim() || null,
        company: company?.trim() || null,
        role: role?.trim() || null,
        phone: phone?.trim() || null,
        first_seen_at: now,
        last_seen_at: now,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create contact: ${error.message}`);
    }

    return created!;
  }
}

/**
 * Get or create lead for a contact
 */
export async function getOrCreateLeadForContact(params: {
  userId: string;
  contactId: string;
  businessId?: string | null;
}): Promise<Lead> {
  const supabase = getSupabaseServerClient();
  const { userId, contactId, businessId } = params;

  // Find existing active lead
  const { data: existing } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .eq("business_id", businessId || null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // Create new lead
  const { data: created, error } = await supabase
    .from("leads")
    .insert({
      user_id: userId,
      contact_id: contactId,
      business_id: businessId || null,
      lead_score: 0,
      lead_stage: "new",
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create lead: ${error.message}`);
  }

  return created!;
}

/**
 * Compute lead score based on various signals
 * Deterministic scoring algorithm
 */
export function computeLeadScore(input: LeadScoreInput): LeadScoreResult {
  let score = input.currentScore;

  // Intent-based scoring
  if (input.hasPricingRequest) {
    score += 20;
  }
  if (input.hasAppointmentRequest) {
    score += 25;
  }
  if (input.intentType === "pricing") {
    score += 20;
  } else if (input.intentType === "appointment") {
    score += 25;
  }

  // Urgency scoring
  if (input.urgencyLevel === "high") {
    score += 15;
  } else if (input.urgencyLevel === "medium") {
    score += 8;
  }

  // Budget scoring
  if (input.budgetSignal === "high") {
    score += 15;
  } else if (input.budgetSignal === "medium") {
    score += 8;
  }

  // Engagement scoring (back-and-forth)
  if (input.numMessagesInThread > 5) {
    score += 10;
  } else if (input.numMessagesInThread > 2) {
    score += 5;
  }

  // Service value weighting (if available)
  if (input.serviceValueWeight && input.serviceValueWeight > 0) {
    score += Math.round(10 * input.serviceValueWeight);
  }

  // Cap at 100
  score = Math.min(100, Math.max(0, score));

  // Derive stage from score
  let stage: Lead["lead_stage"];
  if (score >= 80) {
    stage = "ready_to_close";
  } else if (score >= 60) {
    stage = "negotiating";
  } else if (score >= 40) {
    stage = "qualified";
  } else if (score >= 20) {
    stage = "warm";
  } else {
    stage = "new";
  }

  return { newScore: score, stage };
}

/**
 * Update lead from email context
 */
export async function updateLeadFromEmailContext(params: {
  userId: string;
  leadId: string;
  emailId: string;
  intentMetadata?: {
    appointments?: Array<{ id: string }>;
    tasks?: Array<{ id: string }>;
    reminders?: Array<{ id: string }>;
  };
  businessContext?: Awaited<ReturnType<typeof getBusinessContextForUser>>;
  aiCrmExtractionResult?: CRMExtractionResult;
}): Promise<Lead> {
  const supabase = getSupabaseServerClient();
  const { userId, leadId, emailId, intentMetadata, businessContext, aiCrmExtractionResult } = params;

  // Get current lead
  const { data: currentLead, error: fetchError } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !currentLead) {
    throw new Error(`Lead not found: ${fetchError?.message || "unknown"}`);
  }

  // Compute new score
  const hasAppointmentRequest = (intentMetadata?.appointments?.length || 0) > 0 || aiCrmExtractionResult?.wantsAppointment || false;
  const hasPricingRequest = aiCrmExtractionResult?.intentType === "pricing" || false;

  // Get thread message count (simplified - would need actual thread query)
  const numMessagesInThread = 1; // TODO: Get actual thread count

  const scoreResult = computeLeadScore({
    currentScore: currentLead.lead_score,
    intentType: aiCrmExtractionResult?.intentType,
    hasAppointmentRequest,
    hasPricingRequest,
    numMessagesInThread,
    urgencyLevel: aiCrmExtractionResult?.urgencyLevel,
    budgetSignal: aiCrmExtractionResult?.budgetLevel,
    serviceValueWeight: aiCrmExtractionResult?.inferredServiceId ? 0.5 : undefined,
  });

  // Build update data
  const updateData: Partial<Lead> = {
    last_email_id: emailId,
    last_activity_at: new Date().toISOString(),
    lead_score: scoreResult.newScore,
    lead_stage: scoreResult.stage,
    updated_at: new Date().toISOString(),
  };

  // Update fields from AI extraction if available
  if (aiCrmExtractionResult) {
    if (aiCrmExtractionResult.inferredServiceId) {
      updateData.primary_service_id = aiCrmExtractionResult.inferredServiceId;
    }
    if (aiCrmExtractionResult.budgetText) {
      updateData.budget = aiCrmExtractionResult.budgetText;
    }
    if (aiCrmExtractionResult.timeline) {
      updateData.timeline = aiCrmExtractionResult.timeline;
    }
  }

  // Update lead
  const { data: updated, error: updateError } = await supabase
    .from("leads")
    .update(updateData)
    .eq("id", leadId)
    .eq("user_id", userId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update lead: ${updateError.message}`);
  }

  return updated!;
}

/**
 * Get lead by contact email
 */
export async function getLeadByContactEmail(
  userId: string,
  email: string
): Promise<Lead | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("leads")
    .select("*, contacts!inner(email)")
    .eq("user_id", userId)
    .eq("contacts.email", email.toLowerCase())
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Lead;
}

/**
 * Get lead by contact ID
 */
export async function getLeadForContact(
  userId: string,
  contactId: string
): Promise<Lead | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Lead;
}


