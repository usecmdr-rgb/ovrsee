import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { syncWorkspaceSubscriptionFromSeats } from "@/lib/stripeWorkspace";
import { mapPlanCodeToTier } from "@/lib/pricingConfig";

/**
 * POST /api/workspaces/accept-invite
 * 
 * Accept a seat invitation and activate the seat
 * 
 * Request body:
 * - token: string (invite token from URL)
 * 
 * Security:
 * - User must be authenticated
 * - User's email must match invited_email
 * - Invite must be pending and not expired
 * - Token is single-use (status changes to 'accepted')
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();

    if (!user.email) {
      return NextResponse.json(
        { error: "User email is required to accept invitation" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invite token is required" },
        { status: 400 }
      );
    }

    // Look up invite by token
    const { data: invite, error: inviteError } = await supabase
      .from("workspace_seat_invites")
      .select("*")
      .eq("invite_token", token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 404 }
      );
    }

    // Verify invite is pending
    if (invite.status !== "pending") {
      return NextResponse.json(
        {
          error: "This invitation has already been used or revoked",
          code: invite.status === "accepted" ? "ALREADY_ACCEPTED" : "INVALID_STATUS",
        },
        { status: 400 }
      );
    }

    // Verify invite is not expired
    if (new Date(invite.expires_at) < new Date()) {
      // Update status to expired
      await supabase
        .from("workspace_seat_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);

      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // SECURITY: Enforce email match - only the user whose email matches can claim the invite
    if (invite.invited_email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        {
          error: "This invitation was sent to a different email address",
          code: "EMAIL_MISMATCH",
        },
        { status: 403 }
      );
    }

    // Check if user already has a seat in this workspace
    const { data: existingSeat } = await supabase
      .from("workspace_seats")
      .select("id, status")
      .eq("workspace_id", invite.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (existingSeat) {
      if (existingSeat.status === "active") {
        // User already has an active seat - mark invite as accepted anyway
        await supabase
          .from("workspace_seat_invites")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
          })
          .eq("id", invite.id);

        return NextResponse.json({
          ok: true,
          message: "You already have access to this workspace",
          alreadyMember: true,
        });
      }
      // If seat exists but is not active, we'll update it below
    }

    // Determine tier from plan_code or tier field
    const tier = invite.tier || (invite.plan_code ? mapPlanCodeToTier(invite.plan_code) : "basic");

    // Create or update workspace seat
    if (existingSeat) {
      // Update existing seat
      const { error: seatUpdateError } = await supabase
        .from("workspace_seats")
        .update({
          user_id: user.id,
          email: user.email,
          tier: tier as "basic" | "advanced" | "elite",
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSeat.id);

      if (seatUpdateError) {
        console.error("Error updating seat:", seatUpdateError);
        throw seatUpdateError;
      }
    } else {
      // Create new seat
      const { error: seatCreateError } = await supabase
        .from("workspace_seats")
        .insert({
          workspace_id: invite.workspace_id,
          user_id: user.id,
          email: user.email,
          tier: tier as "basic" | "advanced" | "elite",
          status: "active",
          is_owner: false,
        });

      if (seatCreateError) {
        console.error("Error creating seat:", seatCreateError);
        throw seatCreateError;
      }
    }

    // Mark invite as accepted (single-use token enforcement)
    const { error: inviteUpdateError } = await supabase
      .from("workspace_seat_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (inviteUpdateError) {
      console.error("Error updating invite:", inviteUpdateError);
      // Don't fail - seat is already created
    }

    // Get workspace name for response
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", invite.workspace_id)
      .single();

    const workspaceName = workspace?.name || "the workspace";
    const planName = invite.plan_code === "essentials" ? "Essentials" :
                     invite.plan_code === "professional" ? "Professional" :
                     invite.plan_code === "executive" ? "Executive" :
                     tier === "basic" ? "Essentials" :
                     tier === "advanced" ? "Professional" : "Executive";

    // Sync Stripe subscription (async, don't block response)
    syncWorkspaceSubscriptionFromSeats(invite.workspace_id).catch((error) => {
      console.error("Failed to sync Stripe subscription after invite acceptance:", error);
    });

    return NextResponse.json({
      ok: true,
      message: `You're now part of ${workspaceName} on the ${planName} plan`,
      data: {
        workspaceId: invite.workspace_id,
        workspaceName,
        planCode: invite.plan_code,
        tier,
      },
    });
  } catch (error: any) {
    console.error("Error accepting invite:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


