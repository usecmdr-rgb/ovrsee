import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import {
  modifyMessageLabels,
  trashGmailMessage,
  sendGmailMessage,
} from "@/lib/gmail/client";

/**
 * GET /api/email-queue
 * Get email queue items
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken || accessToken === "dev-token") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = userResult.user.id;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status"); // open, snoozed, done, archived
    const category = searchParams.get("category"); // Filter by category
    const filter = searchParams.get("filter"); // followups, etc.
    const sort = searchParams.get("sort") || "date"; // priority, date (default to date)
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const limit = parseInt(searchParams.get("limit") || "100"); // Increased default limit
    const offset = parseInt(searchParams.get("offset") || "0");
    const inboxOnly = searchParams.get("inboxOnly") === "true"; // Default to false - show all emails

    // Build query - use * to include all columns (including draft fields if migration has run)
    let query = supabase
      .from("email_queue")
      .select("*")
      .eq("user_id", userId)
      .order("internal_date", { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    // Filter by INBOX label by default (mirror Gmail inbox)
    // Use cs (contains) operator for array: check if gmail_labels array contains "INBOX"
    if (inboxOnly) {
      query = query.contains("gmail_labels", ["INBOX"]);
    }

    if (status) {
      query = query.eq("queue_status", status);
    }

    // Filter by category if provided (only if category column exists)
    // Note: This will fail gracefully if category column doesn't exist
    if (category) {
      try {
        query = query.eq("category", category);
      } catch (error: any) {
        // If category column doesn't exist, log warning but continue
        if (error?.code === "42703" || error?.message?.includes("category")) {
          console.warn("[Email Queue] category column not found, skipping category filter");
        } else {
          throw error;
        }
      }
    }

    // Calculate follow-ups count (for metadata) - do this before filtering
    let followupsCount = 0;
    if (filter === "followups" || searchParams.get("includeCounts") === "true") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get emails with pending follow-ups
      const { data: followUpEmails } = await supabase
        .from("lead_follow_up_suggestions")
        .select("email_id")
        .eq("user_id", userId)
        .eq("status", "pending")
        .lte("suggested_for", new Date().toISOString())
        .not("email_id", "is", null);

      // Get emails with tasks/reminders due today or overdue
      const { data: taskEmails } = await supabase
        .from("email_tasks")
        .select("email_id")
        .eq("user_id", userId)
        .in("status", ["pending", "open"])
        .lte("due_at", new Date().toISOString())
        .not("email_id", "is", null);

      const { data: reminderEmails } = await supabase
        .from("email_reminders")
        .select("email_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .lte("remind_at", new Date().toISOString())
        .not("email_id", "is", null);

      const followUpIds = new Set([
        ...(followUpEmails?.map((e) => e.email_id).filter(Boolean) || []),
        ...(taskEmails?.map((e) => e.email_id).filter(Boolean) || []),
        ...(reminderEmails?.map((e) => e.email_id).filter(Boolean) || []),
      ]);

      followupsCount = followUpIds.size;

      // Filter by followups if requested
      if (filter === "followups") {
        if (followUpIds.size > 0) {
          query = query.in("id", Array.from(followUpIds));
        } else {
          // No follow-ups, return empty result
          query = query.eq("id", "00000000-0000-0000-0000-000000000000"); // Impossible ID
        }
      }
    }

    if (!includeDeleted) {
      query = query.is("deleted_at", null);
    } else {
      query = query.not("deleted_at", "is", null);
    }

    // Filter out snoozed items that aren't ready yet
    if (status !== "snoozed") {
      query = query.or("snoozed_until.is.null,snoozed_until.lt." + new Date().toISOString());
    } else {
      query = query.gte("snoozed_until", new Date().toISOString());
    }

    // Sorting
    // Check if priority_score column exists before using it (to avoid error logs)
    let hasPriorityScore = false;
    if (sort === "priority") {
      // Check if column exists by attempting a simple query
      try {
        const { error: checkError } = await supabase
          .from("email_queue")
          .select("priority_score")
          .limit(0);
        
        hasPriorityScore = !checkError || (!checkError.message?.includes("does not exist") && checkError.code !== "42703");
      } catch (e) {
        // Column doesn't exist, will fall back below
        hasPriorityScore = false;
      }
      
      if (hasPriorityScore) {
        query = query.order("priority_score", { ascending: false });
        query = query.order("internal_date", { ascending: false }); // Secondary sort
      } else {
        // Column doesn't exist, fall back to date sort (only warn once per request)
        if (sort === "priority") {
          console.warn("[Email Queue] priority_score column not found, falling back to date sort. Run migration: 20250125000002_ensure_email_queue_columns.sql");
        }
        query = query.order("internal_date", { ascending: false });
      }
    } else {
      query = query.order("internal_date", { ascending: false });
    }

    const { data: emails, error } = await query;

    if (error) {
      // Handle other errors gracefully
      if (error.code === "42703" || error.message?.includes("does not exist")) {
        // Column doesn't exist - extract column name from error message
        let missingColumn = "unknown";
        // Try multiple patterns to extract column name
        const patterns = [
          /column\s+["']?email_queue\.(\w+)["']?\s+does not exist/i,
          /column\s+["']?(\w+)["']?\s+does not exist/i,
          /email_queue\.(\w+)/i,
        ];
        
        for (const pattern of patterns) {
          const match = error.message?.match(pattern);
          if (match && match[1]) {
            missingColumn = match[1];
            break;
          }
        }
        
        console.warn(`[Email Queue] Database column '${missingColumn}' missing. Falling back to date sort. Error: ${error.message}`);
        
        // Rebuild query without the problematic column
        let fallbackQuery = supabase
          .from("email_queue")
          .select("*")
          .eq("user_id", userId)
          .order("internal_date", { ascending: false })
          .limit(limit)
          .range(offset, offset + limit - 1);
          
          // Reapply all filters
          if (inboxOnly) {
            fallbackQuery = fallbackQuery.contains("gmail_labels", ["INBOX"]);
          }
          if (status) {
            fallbackQuery = fallbackQuery.eq("queue_status", status);
          }
          if (category) {
            // Try category filter, but it might also be missing
            fallbackQuery = fallbackQuery.eq("category", category);
          }
          if (!includeDeleted) {
            fallbackQuery = fallbackQuery.is("deleted_at", null);
          }
          if (status !== "snoozed") {
            fallbackQuery = fallbackQuery.or("snoozed_until.is.null,snoozed_until.lt." + new Date().toISOString());
          }
          
          const { data: fallbackEmails, error: fallbackError } = await fallbackQuery;
          
          if (fallbackError) {
            // If fallback also fails, return error
            return NextResponse.json(
              { 
                error: "Database schema is out of date. Please run migrations.",
                details: fallbackError.message,
                missingColumn: missingColumn,
                hint: "Run: supabase migration up or apply migration 20250125000002_ensure_email_queue_columns.sql"
              },
              { status: 500 }
            );
          }
          
          // Use fallback results and continue with enrichment (inline the enrichment logic)
          const enrichedEmails = await Promise.all(
            (fallbackEmails || []).map(async (email) => {
              const enriched: any = { ...email };

              // Get lead info for this email's sender
              const { data: contact } = await supabase
                .from("contacts")
                .select("id")
                .eq("user_id", userId)
                .eq("email", email.from_address?.toLowerCase() || "")
                .maybeSingle();

              if (contact) {
                const { data: lead } = await supabase
                  .from("leads")
                  .select("id, lead_score, lead_stage, primary_service_id, budget, timeline")
                  .eq("user_id", userId)
                  .eq("contact_id", contact.id)
                  .order("last_activity_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (lead) {
                  enriched.lead = {
                    id: lead.id,
                    score: lead.lead_score,
                    stage: lead.lead_stage,
                    primary_service_id: lead.primary_service_id,
                    budget: lead.budget,
                    timeline: lead.timeline,
                  };

                  // Check for pending follow-up suggestion
                  const { data: followUp } = await supabase
                    .from("lead_follow_up_suggestions")
                    .select("id, suggested_for")
                    .eq("user_id", userId)
                    .eq("lead_id", lead.id)
                    .eq("status", "pending")
                    .maybeSingle();

                  enriched.hasFollowUpSuggestion = !!followUp;
                  if (followUp) {
                    enriched.followUpSuggestion = {
                      id: followUp.id,
                      suggested_for: followUp.suggested_for,
                    };
                  }
                }
              }

              // Check for tasks/reminders due today or overdue
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const { data: tasks } = await supabase
                .from("email_tasks")
                .select("id, due_at")
                .eq("user_id", userId)
                .eq("email_id", email.id)
                .in("status", ["pending", "open"])
                .lte("due_at", new Date().toISOString());

              const { data: reminders } = await supabase
                .from("email_reminders")
                .select("id, remind_at")
                .eq("user_id", userId)
                .eq("email_id", email.id)
                .eq("status", "active")
                .lte("remind_at", new Date().toISOString());

              enriched.hasUrgentTasks = (tasks?.length || 0) > 0;
              enriched.hasUrgentReminders = (reminders?.length || 0) > 0;

              return enriched;
            })
          );
          
          return NextResponse.json({
            emails: enrichedEmails,
            count: enrichedEmails.length,
            warning: "priority_score column not found, using date sort"
          });
        }
      
      // For other errors (not missing columns)
      console.error(`[Email Queue] Error fetching emails for user_id ${userId}:`, error);
      throw error;
    }

    console.log(`[Email Queue] Fetched ${emails?.length || 0} emails for user_id: ${userId}`);

    // Enrich emails with CRM data (lead info, follow-up suggestions)
    const enrichedEmails = await Promise.all(
      (emails || []).map(async (email) => {
        const enriched: any = { ...email };

        // Get lead info for this email's sender
        const { data: contact } = await supabase
          .from("contacts")
          .select("id")
          .eq("user_id", userId)
          .eq("email", email.from_address?.toLowerCase() || "")
          .maybeSingle();

        if (contact) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id, lead_score, lead_stage, primary_service_id, budget, timeline")
            .eq("user_id", userId)
            .eq("contact_id", contact.id)
            .order("last_activity_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lead) {
            enriched.lead = {
              id: lead.id,
              score: lead.lead_score,
              stage: lead.lead_stage,
              primary_service_id: lead.primary_service_id,
              budget: lead.budget,
              timeline: lead.timeline,
            };

            // Check for pending follow-up suggestion
            const { data: followUp } = await supabase
              .from("lead_follow_up_suggestions")
              .select("id, suggested_for")
              .eq("user_id", userId)
              .eq("lead_id", lead.id)
              .eq("status", "pending")
              .maybeSingle();

            enriched.hasFollowUpSuggestion = !!followUp;
            if (followUp) {
              enriched.followUpSuggestion = {
                id: followUp.id,
                suggested_for: followUp.suggested_for,
              };
            }
          }
        }

        // Check for tasks/reminders due today or overdue
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: tasks } = await supabase
          .from("email_tasks")
          .select("id, due_at")
          .eq("user_id", userId)
          .eq("email_id", email.id)
          .in("status", ["pending", "open"])
          .lte("due_at", new Date().toISOString());

        const { data: reminders } = await supabase
          .from("email_reminders")
          .select("id, remind_at")
          .eq("user_id", userId)
          .eq("email_id", email.id)
          .eq("status", "active")
          .lte("remind_at", new Date().toISOString());

        enriched.hasUrgentTasks = (tasks?.length || 0) > 0;
        enriched.hasUrgentReminders = (reminders?.length || 0) > 0;

        // Check for prepared follow-up draft
        const { data: preparedDraft } = await supabase
          .from("prepared_follow_up_drafts")
          .select("id, draft_body")
          .eq("user_id", userId)
          .eq("email_id", email.id)
          .eq("consumed", false)
          .maybeSingle();

        if (preparedDraft) {
          enriched.hasPreparedDraft = true;
          enriched.preparedDraft = {
            id: preparedDraft.id,
            draftBody: preparedDraft.draft_body,
          };
        }

        return enriched;
      })
    );

    // Include metadata with follow-ups count if requested or if filtering by followups
    const response: any = {
      emails: enrichedEmails,
      count: enrichedEmails.length,
    };

    if (filter === "followups" || searchParams.get("includeCounts") === "true") {
      response.meta = {
        followupsCount,
      };
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error fetching email queue:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/email-queue
 * Update email queue item (mark done, snooze, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken || accessToken === "dev-token") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = userResult.user.id;

    const body = await request.json();
    const { emailId, action, value } = body;

    if (!emailId || !action) {
      return NextResponse.json(
        { error: "Missing emailId or action" },
        { status: 400 }
      );
    }

    // Get email to check Gmail connection
    const { data: email, error: emailError } = await supabase
      .from("email_queue")
      .select("gmail_message_id, gmail_labels, queue_status")
      .eq("id", emailId)
      .eq("user_id", userId)
      .single();

    if (emailError || !email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Handle different actions
    switch (action) {
      case "mark_done":
        updateData.queue_status = "done";
        // Archive in Gmail (remove INBOX label)
        if (email.gmail_message_id) {
          try {
            await modifyMessageLabels(userId, email.gmail_message_id, [], ["INBOX"]);
          } catch (error) {
            console.error("Failed to archive in Gmail:", error);
            // Continue anyway - update OVRSEE state
          }
        }
        break;

      case "mark_open":
        updateData.queue_status = "open";
        // Add back to INBOX if not already there
        if (email.gmail_message_id && !email.gmail_labels?.includes("INBOX")) {
          try {
            await modifyMessageLabels(userId, email.gmail_message_id, ["INBOX"], []);
          } catch (error) {
            console.error("Failed to unarchive in Gmail:", error);
          }
        }
        break;

      case "snooze":
        if (!value || typeof value !== "string") {
          return NextResponse.json(
            { error: "Snooze time required" },
            { status: 400 }
          );
        }
        updateData.queue_status = "snoozed";
        updateData.snoozed_until = new Date(value).toISOString();
        break;

      case "unsnooze":
        updateData.queue_status = "open";
        updateData.snoozed_until = null;
        break;

      case "mark_read":
        updateData.is_read = true;
        // Remove UNREAD label in Gmail
        if (email.gmail_message_id) {
          try {
            await modifyMessageLabels(userId, email.gmail_message_id, [], ["UNREAD"]);
          } catch (error) {
            console.error("Failed to mark read in Gmail:", error);
          }
        }
        break;

      case "mark_unread":
        updateData.is_read = false;
        // Add UNREAD label in Gmail
        if (email.gmail_message_id) {
          try {
            await modifyMessageLabels(userId, email.gmail_message_id, ["UNREAD"], []);
          } catch (error) {
            console.error("Failed to mark unread in Gmail:", error);
          }
        }
        break;

      case "star":
        updateData.is_starred = true;
        if (email.gmail_message_id) {
          try {
            await modifyMessageLabels(userId, email.gmail_message_id, ["STARRED"], []);
          } catch (error) {
            console.error("Failed to star in Gmail:", error);
          }
        }
        break;

      case "unstar":
        updateData.is_starred = false;
        if (email.gmail_message_id) {
          try {
            await modifyMessageLabels(userId, email.gmail_message_id, [], ["STARRED"]);
          } catch (error) {
            console.error("Failed to unstar in Gmail:", error);
          }
        }
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update in database
    const { data: updated, error: updateError } = await supabase
      .from("email_queue")
      .update(updateData)
      .eq("id", emailId)
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      email: updated,
    });
  } catch (error: any) {
    console.error("Error updating email:", error);
    return NextResponse.json(
      { error: "Failed to update email" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email-queue
 * Soft delete email
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken || accessToken === "dev-token") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = userResult.user.id;

    const searchParams = request.nextUrl.searchParams;
    const emailId = searchParams.get("emailId");
    const permanent = searchParams.get("permanent") === "true";

    if (!emailId) {
      return NextResponse.json(
        { error: "Missing emailId" },
        { status: 400 }
      );
    }

    // Get email
    const { data: email, error: emailError } = await supabase
      .from("email_queue")
      .select("gmail_message_id, deleted_at")
      .eq("id", emailId)
      .eq("user_id", userId)
      .single();

    if (emailError || !email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    if (permanent) {
      // Permanently delete
      if (email.gmail_message_id) {
        try {
          await trashGmailMessage(userId, email.gmail_message_id);
        } catch (error) {
          console.error("Failed to delete in Gmail:", error);
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from("email_queue")
        .delete()
        .eq("id", emailId)
        .eq("user_id", userId);

      if (deleteError) {
        throw deleteError;
      }
    } else {
      // Soft delete
      const { error: updateError } = await supabase
        .from("email_queue")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          deleted_source: email.deleted_at ? "both" : "ovrsee",
          updated_at: new Date().toISOString(),
        })
        .eq("id", emailId)
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Error deleting email:", error);
    return NextResponse.json(
      { error: "Failed to delete email" },
      { status: 500 }
    );
  }
}

