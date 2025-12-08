/**
 * GET /api/sync/email/[id]/intent
 * 
 * Internal API for fetching intent metadata for an email
 * Returns classification, appointment, and task information
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const emailId = context.params.id;

    if (!emailId) {
      return NextResponse.json(
        { error: "Email ID is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Fetch email with classification info
    const { data: email, error: emailError } = await supabase
      .from("email_queue")
      .select("id, category, classification_status, has_appointment, has_tasks")
      .eq("id", emailId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (emailError || !email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Fetch appointment if exists
    let appointment = null;
    if (email.has_appointment) {
      const { data: appointmentData } = await supabase
        .from("email_appointments")
        .select("*")
        .eq("email_id", emailId)
        .eq("user_id", userId)
        .single();

      appointment = appointmentData;
    }

    // Fetch tasks if exist
    let tasks = null;
    if (email.has_tasks) {
      const { data: tasksData } = await supabase
        .from("email_tasks")
        .select("*")
        .eq("email_id", emailId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      tasks = tasksData || [];
    }

    // Fetch reminders if exist
    let reminders = null;
    if (email.has_tasks) {
      const { data: remindersData } = await supabase
        .from("email_reminders")
        .select("*")
        .eq("email_id", emailId)
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("remind_at", { ascending: true });

      reminders = remindersData || [];
    }

    return NextResponse.json({
      email: {
        id: email.id,
        category: email.category,
        classification_status: email.classification_status,
        has_appointment: email.has_appointment,
        has_tasks: email.has_tasks,
      },
      appointment,
      tasks,
      reminders,
    });
  } catch (error: any) {
    console.error("[GetEmailIntent] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch intent metadata" },
      { status: 500 }
    );
  }
}


