import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { sendSupportEmail } from "@/lib/email";

/**
 * POST /api/auth/forgot-password
 * 
 * Sends password reset email to user if account exists
 * Only sends email if account is found (security: don't reveal if email exists)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Check if user exists by trying to get user by email
    // Use admin API to check without revealing if account exists
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      // Don't reveal error - return success message for security
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // Check if email exists (case-insensitive)
    const userExists = users?.users?.some(
      (user) => user.email?.toLowerCase() === email.toLowerCase()
    );

    if (!userExists) {
      // Don't reveal that account doesn't exist (security best practice)
      // Return success message anyway
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // Generate password reset link using Supabase admin API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectTo = `${baseUrl}/reset-password`;
    
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email.toLowerCase(),
      options: {
        redirectTo: redirectTo,
      },
    });

    if (resetError || !resetData?.properties?.action_link) {
      console.error("Error generating reset link:", resetError);
      // Still return success for security (don't reveal errors)
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // Use the action_link from Supabase (it contains the proper token)
    const resetUrl = resetData.properties.action_link;

    // Send password reset email via Microsoft 365
    const emailSubject = "Reset Your OVRSEE Password";
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #059669;">Reset Your Password</h1>
  <p>Hi there,</p>
  <p>We received a request to reset your password for your OVRSEE account.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
      Reset Password
    </a>
  </div>
  
  <p style="color: #6b7280; font-size: 14px;">
    This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
  </p>
  
  <p style="color: #6b7280; font-size: 14px;">
    If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="${resetUrl}" style="color: #059669; word-break: break-all;">${resetUrl}</a>
  </p>
  
  <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
    Best regards,<br>
    The OVRSEE Team
  </p>
</body>
</html>
    `.trim();

    const emailText = `
Reset Your Password

Hi there,

We received a request to reset your password for your OVRSEE account.

Click this link to reset your password:
${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

Best regards,
The OVRSEE Team
    `.trim();

    try {
      await sendSupportEmail({
        to: email.toLowerCase(),
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });
    } catch (emailError: any) {
      console.error("Failed to send password reset email:", emailError);
      // Still return success for security
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a password reset link has been sent.",
      });
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    // Always return success for security (don't reveal errors)
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a password reset link has been sent.",
    });
  }
}

