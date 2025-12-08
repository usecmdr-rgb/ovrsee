/**
 * POST /api/sync/email/send
 * 
 * Send an email via Gmail API
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { sendGmailMessage } from "@/lib/gmail/client";
import { handlePostSendIntelligence } from "@/lib/sync/handlePostSendIntelligence";

/**
 * Format email as RFC 2822
 */
function formatEmailAsRFC2822(
  to: string,
  subject: string,
  body: string,
  fromEmail?: string
): string {
  // Get user's email from Supabase
  // If not provided, Gmail API will use the authenticated user's email
  const from = fromEmail || "";
  
  // RFC 2822 format
  const lines: string[] = [];
  
  if (from) {
    lines.push(`From: ${from}`);
  }
  lines.push(`To: ${to}`);
  lines.push(`Subject: ${subject}`);
  lines.push(`Content-Type: text/plain; charset=utf-8`);
  lines.push(`Content-Transfer-Encoding: 7bit`);
  lines.push(``);
  lines.push(body);

  return lines.join("\r\n");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    
    // Get authenticated user
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
    const userEmail = userResult.user.email;

    // Parse request body
    const body = await request.json();
    const { emailId, to, subject, body: emailBody, threadId } = body;

    if (!emailId || !to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: emailId, to, subject, body" },
        { status: 400 }
      );
    }

    // Verify email exists and belongs to user
    const { data: email, error: fetchError } = await supabase
      .from("email_queue")
      .select("id, gmail_thread_id, from_address")
      .eq("id", emailId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Use thread ID from email if not provided
    const replyThreadId = threadId || email.gmail_thread_id || undefined;

    // Format email as RFC 2822
    const rawMessage = formatEmailAsRFC2822(
      to,
      subject,
      emailBody,
      userEmail || undefined
    );

    // Encode as base64url (Gmail requirement)
    const base64Message = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Send via Gmail API (sendGmailMessage expects base64url encoded string)
    const sendResult = await sendGmailMessage(userId, base64Message, replyThreadId);

    // Update email queue - mark as sent/replied
    try {
      await supabase
        .from("email_queue")
        .update({
          queue_status: "done",
          updated_at: new Date().toISOString(),
        })
        .eq("id", emailId)
        .eq("user_id", userId);
    } catch (updateError) {
      // Log but don't fail - email was sent successfully
      console.error("[Send Email] Error updating queue status:", updateError);
    }

    // Handle post-send intelligence (create calendar alerts, tasks, reminders)
    // Run asynchronously - don't block the response
    handlePostSendIntelligence(userId, emailId, replyThreadId).catch((error) => {
      console.error("[Send Email] Error in post-send intelligence:", error);
      // Don't fail the send operation if intelligence processing fails
    });

    return NextResponse.json({
      success: true,
      messageId: sendResult.id,
      threadId: sendResult.threadId,
    });
  } catch (error: any) {
    console.error("[Send Email] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}

