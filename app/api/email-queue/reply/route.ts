import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { sendGmailMessage } from "@/lib/gmail/client";

/**
 * POST /api/email-queue/reply
 * Send a reply to an email via Gmail
 */
export async function POST(request: NextRequest) {
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
    const { emailId, replyText, html } = body;

    if (!emailId || !replyText) {
      return NextResponse.json(
        { error: "Missing emailId or replyText" },
        { status: 400 }
      );
    }

    // Get email details
    const { data: email, error: emailError } = await supabase
      .from("email_queue")
      .select("gmail_message_id, gmail_thread_id, from_address, subject")
      .eq("id", emailId)
      .eq("user_id", userId)
      .single();

    if (emailError || !email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Get user's email address
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    const userEmail = profile?.email || userResult.user.email;
    if (!userEmail) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    // Build RFC 2822 email
    const messageId = `<${Date.now()}@ovrsee.app>`;
    const date = new Date().toUTCString();
    const subject = email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`;

    // Build email headers
    const headers = [
      `Message-ID: ${messageId}`,
      `Date: ${date}`,
      `From: ${userEmail}`,
      `To: ${email.from_address}`,
      `Subject: ${subject}`,
      `In-Reply-To: <${email.gmail_message_id}@gmail.com>`,
      `References: <${email.gmail_message_id}@gmail.com>`,
      `MIME-Version: 1.0`,
      `Content-Type: ${html ? "text/html" : "text/plain"}; charset=UTF-8`,
      ``,
      html || replyText,
    ].join("\r\n");

    // Encode as base64url
    const rawMessage = Buffer.from(headers)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Send via Gmail
    const sentMessage = await sendGmailMessage(
      userId,
      rawMessage,
      email.gmail_thread_id
    );

    // Update original email status to "done" (archived)
    await supabase
      .from("email_queue")
      .update({
        queue_status: "done",
        updated_at: new Date().toISOString(),
      })
      .eq("id", emailId)
      .eq("user_id", userId);

    // Optionally, add the sent message to the queue
    // (Gmail will sync it via history, but we could add it immediately)

    return NextResponse.json({
      success: true,
      messageId: sentMessage.id,
      threadId: sentMessage.threadId,
    });
  } catch (error: any) {
    console.error("Error sending reply:", error);
    return NextResponse.json(
      {
        error: "Failed to send reply",
        details: error.message,
      },
      { status: 500 }
    );
  }
}



