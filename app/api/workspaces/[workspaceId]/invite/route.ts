import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { sendSupportEmail } from "@/lib/email";
import { mapPlanCodeToTier, mapTierToPlanCode, type CorePlanCode } from "@/lib/pricingConfig";
import { randomBytes } from "crypto";

/**
 * POST /api/workspaces/[workspaceId]/invite
 * 
 * Create a seat invitation and send activation email
 * 
 * Request body:
 * - email: string (required)
 * - planCode?: "essentials" | "professional" | "executive"
 * - tier?: "basic" | "advanced" | "elite" (for backward compatibility)
 * 
 * Security:
 * - Caller must be authenticated
 * - Caller must own/admin the workspace
 * - Workspace must have available seats at the requested tier/plan
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();

    // Verify workspace exists and user owns it
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name, owner_user_id")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    if (workspace.owner_user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You must be the workspace owner to invite members" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, planCode, tier } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      );
    }

    // Normalize plan/tier: prefer planCode, fallback to tier
    let finalPlanCode: CorePlanCode | null = null;
    let finalTier: "basic" | "advanced" | "elite" | null = null;

    if (planCode && ["essentials", "professional", "executive"].includes(planCode)) {
      finalPlanCode = planCode as CorePlanCode;
      finalTier = mapPlanCodeToTier(finalPlanCode);
    } else if (tier && ["basic", "advanced", "elite"].includes(tier)) {
      finalTier = tier as "basic" | "advanced" | "elite";
      finalPlanCode = mapTierToPlanCode(finalTier) as CorePlanCode;
    } else {
      // Default to essentials/basic
      finalPlanCode = "essentials";
      finalTier = "basic";
    }

    // Check if user already has a seat in this workspace
    // First check by email (for pending invites)
    const { data: existingSeatByEmail } = await supabase
      .from("workspace_seats")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", email.toLowerCase())
      .in("status", ["active", "pending"])
      .limit(1);

    // Also check if there's a user with this email who already has a seat
    // (we can't directly query auth.users, but we can check workspace_seats by user_id if we had it)
    // For now, we'll rely on the email check above and the invite check below

    if (existingSeatByEmail && existingSeatByEmail.length > 0) {
      return NextResponse.json(
        { error: "User already has a seat in this workspace" },
        { status: 400 }
      );
    }

    // Check if there's already a pending invite for this email
    const { data: existingInvite } = await supabase
      .from("workspace_seat_invites")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("invited_email", email.toLowerCase())
      .eq("status", "pending")
      .limit(1);

    if (existingInvite && existingInvite.length > 0) {
      return NextResponse.json(
        { error: "An invitation has already been sent to this email address" },
        { status: 400 }
      );
    }

    // TODO: Check if workspace has available seats at this tier/plan
    // This would require checking the workspace subscription and seat limits
    // For now, we'll allow the invite creation and handle limits at seat activation

    // Generate secure random invite token (32 bytes = 64 hex characters)
    const inviteToken = randomBytes(32).toString("hex");

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invite record
    const { data: invite, error: inviteError } = await supabase
      .from("workspace_seat_invites")
      .insert({
        workspace_id: workspaceId,
        invited_email: email.toLowerCase(),
        plan_code: finalPlanCode,
        tier: finalTier,
        invite_token: inviteToken,
        status: "pending",
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating invite:", inviteError);
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    // Build activation URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const activationUrl = `${baseUrl}/activate-seat?token=${inviteToken}`;

    // Send activation email
    const workspaceName = workspace.name || "this workspace";
    const planName = finalPlanCode === "essentials" ? "Essentials" : 
                     finalPlanCode === "professional" ? "Professional" : 
                     "Executive";

    const emailSubject = `${workspaceName} invited you to OVRSEE`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to OVRSEE</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #059669;">You've been invited to OVRSEE!</h1>
  <p>Hi there,</p>
  <p><strong>${workspaceName}</strong> has invited you to join their workspace on OVRSEE with the <strong>${planName}</strong> plan.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${activationUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
      Activate Your Seat
    </a>
  </div>
  
  <p style="color: #6b7280; font-size: 14px;">
    This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
  </p>
  
  <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
    Best regards,<br>
    The OVRSEE Team
  </p>
</body>
</html>
    `.trim();

    const emailText = `
You've been invited to OVRSEE!

${workspaceName} has invited you to join their workspace on OVRSEE with the ${planName} plan.

Activate your seat by clicking this link:
${activationUrl}

This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.

Best regards,
The OVRSEE Team
    `.trim();

    try {
      await sendSupportEmail({
        to: email,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
      });
    } catch (emailError: any) {
      console.error("Failed to send activation email:", emailError);
      // Don't fail the request if email fails - invite is still created
      // In production, you might want to queue the email for retry
    }

    return NextResponse.json({
      ok: true,
      data: {
        invite: {
          id: invite.id,
          email: invite.invited_email,
          planCode: invite.plan_code,
          tier: invite.tier,
          expiresAt: invite.expires_at,
        },
        activationUrl, // Include for testing/debugging
      },
    });
  } catch (error: any) {
    console.error("Error creating invitation:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

