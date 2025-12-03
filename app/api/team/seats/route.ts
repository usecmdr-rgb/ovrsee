import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { calculateTeamPricing } from "@/lib/pricing";
import type { SeatSelection, PricingBreakdown } from "@/lib/pricing";
import { syncWorkspaceSubscriptionFromSeats } from "@/lib/stripeWorkspace";
// Generate a short unique ID for invite codes
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * GET /api/team/seats
 * 
 * Get all seats for the current user's workspace
 * Returns seats list + pricing breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's workspace (create if doesn't exist)
    let { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("owner_user_id", user.id)
      .single();

    if (workspaceError || !workspace) {
      // If workspace doesn't exist, create one
      const { data: newWorkspace, error: createError } = await supabase
        .from("workspaces")
        .insert({
          owner_user_id: user.id,
          name: "My Workspace",
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      workspace = newWorkspace;

      // Create owner seat if it doesn't exist
      const { data: existingSeat } = await supabase
        .from("workspace_seats")
        .select("*")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .single();

      if (!existingSeat) {
        await supabase
          .from("workspace_seats")
          .insert({
            workspace_id: workspace.id,
            user_id: user.id,
            tier: "basic",
            status: "active",
            is_owner: true,
          });
      }
    }

    const currentWorkspace = workspace;

    if (!currentWorkspace) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get all seats for this workspace
    const { data: seats, error: seatsError } = await supabase
      .from("workspace_seats")
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .in("status", ["active", "pending"]);

    if (seatsError) {
      throw seatsError;
    }

    // Transform seats data
    // Note: For seats with user_id, we'll need to fetch user email separately if needed
    // For now, we use the email field stored in the seat
    const seatsList = (seats || []).map((seat: any) => {
      const userEmail = seat.email || (seat.user_id ? "User" : "Pending invite");
      return {
        id: seat.id,
        email: userEmail,
        tier: seat.tier,
        status: seat.status,
        userName: userEmail !== "Pending invite" && userEmail !== "User" 
          ? userEmail.split("@")[0] 
          : null,
        isOwner: seat.is_owner,
        userId: seat.user_id,
      };
    });

    // Calculate pricing breakdown
    const seatSelections: SeatSelection[] = seatsList
      .filter((s: any) => s.status === "active" || s.status === "pending")
      .reduce((acc: SeatSelection[], seat: any) => {
        const existing = acc.find((s) => s.tier === seat.tier);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ tier: seat.tier, count: 1 });
        }
        return acc;
      }, []);

    // TODO: when we enable yearly team billing in the UI, pass the selected
    // billing interval into this handler (e.g. via query param) and forward it
    // into calculateTeamPricing(seatSelections, billingInterval).
    const pricingBreakdown = calculateTeamPricing(seatSelections);

    return NextResponse.json({
      ok: true,
      data: {
        seats: seatsList,
        pricing: pricingBreakdown,
      },
    });
  } catch (error: any) {
    console.error("Error fetching seats:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team/seats
 * 
 * Create a new seat + invite
 * 
 * Request body: { email?: string; tier: TierId; method: 'email' | 'link' }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, tier, method = "link" } = body;

    if (!tier || !["basic", "advanced", "elite"].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid tier. Must be 'basic', 'advanced', or 'elite'" },
        { status: 400 }
      );
    }

    // Get user's workspace (create if doesn't exist)
    let { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("owner_user_id", user.id)
      .single();

    if (workspaceError || !workspace) {
      // Create workspace if it doesn't exist
      const { data: newWorkspace, error: createError } = await supabase
        .from("workspaces")
        .insert({
          owner_user_id: user.id,
          name: "My Workspace",
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: "Failed to create workspace" },
          { status: 500 }
        );
      }

      workspace = newWorkspace;
    }

    // Check if user already has a seat (if email provided)
    if (email) {
      const { data: existingUser } = await supabase
        .from("auth.users")
        .select("id")
        .eq("email", email)
        .single();

      if (existingUser) {
        const { data: existingSeat } = await supabase
          .from("workspace_seats")
          .select("*")
          .eq("workspace_id", workspace.id)
          .eq("user_id", existingUser.id)
          .single();

        if (existingSeat) {
          return NextResponse.json(
            { error: "User already has a seat in this workspace" },
            { status: 400 }
          );
        }
      }
    }

    // Create seat
    const { data: seat, error: seatError } = await supabase
      .from("workspace_seats")
      .insert({
        workspace_id: workspace.id,
        user_id: email ? null : null, // Will be set when invite is accepted
        email: email || null,
        tier,
        status: "pending",
        is_owner: false,
      })
      .select()
      .single();

    if (seatError) {
      throw seatError;
    }

    // Create invite
    const inviteCode = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    const { data: invite, error: inviteError } = await supabase
      .from("workspace_invites")
      .insert({
        workspace_id: workspace.id,
        seat_id: seat.id,
        email: email || null,
        tier,
        invite_code: inviteCode,
        expires_at: expiresAt.toISOString(),
        created_by_user_id: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      throw inviteError;
    }

    // Generate invite URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/${inviteCode}`;

    // If method is email, send email (stub for now)
    if (method === "email" && email) {
      // TODO: Send invite email
      console.log("Would send invite email to:", email, "with link:", inviteUrl);
    }

    // Sync Stripe subscription (async, don't block response)
    // TODO: when yearly team billing is enabled, thread a billingInterval
    // argument through to syncWorkspaceSubscriptionFromSeats so workspace
    // subscriptions can use the correct Stripe price IDs.
    syncWorkspaceSubscriptionFromSeats(workspace.id).catch((error) => {
      console.error("Failed to sync Stripe subscription after seat creation:", error);
      // Don't throw - allow seat creation to succeed even if Stripe sync fails
    });

    return NextResponse.json({
      ok: true,
      data: {
        seat,
        invite: {
          ...invite,
          inviteUrl,
        },
      },
    });
  } catch (error: any) {
    console.error("Error creating seat:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

