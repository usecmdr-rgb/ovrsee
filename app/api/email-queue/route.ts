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
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const inboxOnly = searchParams.get("inboxOnly") !== "false"; // Default to true

    // Build query
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

    const { data: emails, error } = await query;

    if (error) {
      console.error(`[Email Queue] Error fetching emails for user_id ${userId}:`, error);
      throw error;
    }

    console.log(`[Email Queue] Fetched ${emails?.length || 0} emails for user_id: ${userId}`);

    return NextResponse.json({
      emails: emails || [],
      count: emails?.length || 0,
    });
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

