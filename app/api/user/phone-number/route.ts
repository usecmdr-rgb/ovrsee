import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { getTwilioClient } from "@/lib/twilio";

function getPublicBaseUrl(): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * GET /api/user/phone-number
 *
 * Returns the current user's active Twilio number (if any).
 *
 * Response:
 * {
 *   phoneNumber: string | null;
 *   twilioSid: string | null;
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("user_phone_numbers")
      .select("phone_number, twilio_phone_sid")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user phone number:", error);
      return NextResponse.json(
        { error: "Failed to fetch phone number" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({
        phoneNumber: null,
        twilioSid: null,
      });
    }

    return NextResponse.json({
      phoneNumber: data.phone_number,
      twilioSid: data.twilio_phone_sid,
    });
  } catch (error: any) {
    console.error("Error in GET /api/user/phone-number:", error);
    if (error?.message?.startsWith("Unauthorized")) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/phone-number
 *
 * Claim a Twilio number for the current user when they do not yet have one.
 *
 * Body:
 * { phoneNumber: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();
    const body = await request.json();
    const { phoneNumber } = body as { phoneNumber?: string };

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json(
        { error: "phoneNumber is required" },
        { status: 400 }
      );
    }

    // Check if user already has an active number
    const { data: existing, error: fetchError } = await supabase
      .from("user_phone_numbers")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchError) {
      console.error("Error checking existing phone number:", fetchError);
      return NextResponse.json(
        { error: "Failed to check existing phone number" },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "User already has a phone number." },
        { status: 400 }
      );
    }

    // Get user's workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found. Please contact support." },
        { status: 500 }
      );
    }

    // Purchase number from Twilio with Aloha webhooks
    const baseUrl = getPublicBaseUrl();
    const voiceUrl = `${baseUrl}/api/aloha/webhooks/incoming-call`;
    const statusCallbackUrl = `${baseUrl}/api/aloha/webhooks/call-status`;

    const { purchasePhoneNumber } = await import("@/lib/twilioClient");
    const twilioResult = await purchasePhoneNumber(phoneNumber, voiceUrl, statusCallbackUrl);

    const { data: newRow, error: insertError } = await supabase
      .from("user_phone_numbers")
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        phone_number: twilioResult.phoneNumber,
        twilio_phone_sid: twilioResult.sid,
        is_active: true,
        voicemail_enabled: true,
        voicemail_mode: "receptionist",
      })
      .select("phone_number, twilio_phone_sid")
      .single();

    if (insertError) {
      console.error("Error inserting user_phone_numbers row:", insertError);
      // Best-effort cleanup: release the Twilio number we just purchased
      try {
        const { releasePhoneNumber } = await import("@/lib/twilioClient");
        await releasePhoneNumber(twilioResult.sid);
      } catch (cleanupError) {
        console.error("Error cleaning up Twilio number after DB failure:", cleanupError);
      }
      return NextResponse.json(
        { error: "Failed to save phone number" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        phoneNumber: newRow.phone_number,
        twilioSid: newRow.twilio_phone_sid,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/user/phone-number:", error);
    if (error?.message?.startsWith("Unauthorized")) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/phone-number
 *
 * Change the user's number: purchase a new number, release the old one,
 * and update the mapping.
 *
 * Body:
 * { phoneNumber: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();
    const body = await request.json();
    const { phoneNumber } = body as { phoneNumber?: string };

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json(
        { error: "phoneNumber is required" },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabase
      .from("user_phone_numbers")
      .select("id, phone_number, twilio_phone_sid")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "User does not have an existing phone number." },
        { status: 400 }
      );
    }

    // Enforce one change per calendar month (UTC)
    const now = new Date();
    const startOfMonthUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
    );

    const { count: changesThisMonth, error: changesError } = await supabase
      .from("user_phone_number_changes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("changed_at", startOfMonthUtc.toISOString());

    if (changesError) {
      console.error(
        "Error checking user_phone_number_changes:",
        changesError
      );
      return NextResponse.json(
        { error: "Failed to check monthly change limit." },
        { status: 500 }
      );
    }

    if ((changesThisMonth || 0) >= 1) {
      return NextResponse.json(
        {
          error:
            "You have already changed your Aloha number once this month. You can change it again next month.",
        },
        { status: 429 }
      );
    }

    // Get user's workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "Workspace not found. Please contact support." },
        { status: 500 }
      );
    }

    // Purchase the new number with Aloha webhooks
    const baseUrl = getPublicBaseUrl();
    const voiceUrl = `${baseUrl}/api/aloha/webhooks/incoming-call`;
    const statusCallbackUrl = `${baseUrl}/api/aloha/webhooks/call-status`;

    const { purchasePhoneNumber, releasePhoneNumber } = await import("@/lib/twilioClient");
    const newIncoming = await purchasePhoneNumber(phoneNumber, voiceUrl, statusCallbackUrl);

    // Release the old number
    try {
      await releasePhoneNumber(existing.twilio_phone_sid);
    } catch (releaseError) {
      console.error("Error releasing old Twilio number:", releaseError);
      // We continue, but log for follow-up.
    }

    const { data: updated, error: updateError } = await supabase
      .from("user_phone_numbers")
      .update({
        workspace_id: workspace.id,
        phone_number: newIncoming.phoneNumber,
        twilio_phone_sid: newIncoming.sid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("phone_number, twilio_phone_sid")
      .single();

    if (updateError) {
      console.error("Error updating user_phone_numbers row:", updateError);
      return NextResponse.json(
        { error: "Failed to update phone number" },
        { status: 500 }
      );
    }

    // Log this change event
    try {
      await supabase.from("user_phone_number_changes").insert({
        user_id: user.id,
        old_phone_number: existing.phone_number,
        new_phone_number: updated.phone_number,
      });
    } catch (logError) {
      console.error(
        "Error logging user_phone_number_changes event:",
        logError
      );
      // Don't fail the request solely due to logging issues
    }

    return NextResponse.json({
      phoneNumber: updated.phone_number,
      twilioSid: updated.twilio_phone_sid,
    });
  } catch (error: any) {
    console.error("Error in PUT /api/user/phone-number:", error);
    if (error?.message?.startsWith("Unauthorized")) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/phone-number
 *
 * Release the user's number: delete Twilio number and remove the row.
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();

    const { data: existing, error: fetchError } = await supabase
      .from("user_phone_numbers")
      .select("id, twilio_phone_sid")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching existing phone number:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch existing phone number" },
        { status: 500 }
      );
    }

    if (!existing) {
      // Nothing to delete
      return NextResponse.json({ success: true }, { status: 204 });
    }

    const { releasePhoneNumber } = await import("@/lib/twilioClient");

    try {
      await releasePhoneNumber(existing.twilio_phone_sid);
    } catch (releaseError) {
      console.error("Error releasing Twilio number during DELETE:", releaseError);
      // Continue with DB cleanup even if Twilio release fails.
    }

    const { error: deleteError } = await supabase
      .from("user_phone_numbers")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      console.error("Error deleting user_phone_numbers row:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete phone number" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/user/phone-number:", error);
    if (error?.message?.startsWith("Unauthorized")) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}


