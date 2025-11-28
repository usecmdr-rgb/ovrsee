import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * PATCH /api/telephony/voicemail/settings
 * 
 * Update voicemail and call forwarding settings
 * 
 * Body (all optional):
 * - externalPhoneNumber (string)
 * - voicemailEnabled (boolean)
 * - voicemailMode ("none" | "voicemail_only" | "receptionist")
 * - forwardingEnabled (boolean)
 * - forwardingConfirmed (boolean)
 * 
 * Rules:
 * - Requires active Twilio number for voicemail/forwarding
 * - If voicemailEnabled = false, forwardingEnabled must be false
 */
export async function PATCH(request: NextRequest) {
  try {
    // Ensure user is authenticated
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const body = await request.json();
    const {
      externalPhoneNumber,
      voicemailEnabled,
      voicemailMode,
      forwardingEnabled,
      forwardingConfirmed,
    } = body;

    const supabase = getSupabaseServerClient();

    // Find active number for user
    const { data: activeNumber, error: fetchError } = await supabase
      .from("user_phone_numbers")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    // Check if voicemail/forwarding is being enabled without an active number
    if ((voicemailEnabled === true || forwardingEnabled === true) && (!activeNumber || fetchError)) {
      return NextResponse.json(
        {
          error: "no_twilio_number",
          message: "Select an Aloha number first.",
        },
        { status: 400 }
      );
    }

    // If no active number, we can't update voicemail settings
    if (!activeNumber || fetchError) {
      return NextResponse.json(
        { error: "no_twilio_number", message: "You need an active Aloha number to configure voicemail." },
        { status: 400 }
      );
    }

    // Build update object
    const updates: Record<string, any> = {};

    if (externalPhoneNumber !== undefined) {
      updates.external_phone_number = externalPhoneNumber || null;
    }

    if (voicemailEnabled !== undefined) {
      updates.voicemail_enabled = voicemailEnabled;
      
      // If disabling voicemail, also disable forwarding
      if (voicemailEnabled === false) {
        updates.forwarding_enabled = false;
      }
    }

    if (voicemailMode !== undefined) {
      if (!["none", "voicemail_only", "receptionist"].includes(voicemailMode)) {
        return NextResponse.json(
          { error: "invalid_voicemail_mode", message: "voicemailMode must be 'none', 'voicemail_only', or 'receptionist'" },
          { status: 400 }
        );
      }
      updates.voicemail_mode = voicemailMode;
    }

    if (forwardingEnabled !== undefined) {
      // Can't enable forwarding if voicemail is disabled
      if (forwardingEnabled === true && activeNumber.voicemail_enabled === false && voicemailEnabled !== true) {
        return NextResponse.json(
          { error: "voicemail_required", message: "Enable voicemail first to use call forwarding." },
          { status: 400 }
        );
      }
      updates.forwarding_enabled = forwardingEnabled;
    }

    if (forwardingConfirmed !== undefined) {
      updates.forwarding_confirmed = forwardingConfirmed;
    }

    // Update the record
    const { data: updatedNumber, error: updateError } = await supabase
      .from("user_phone_numbers")
      .update(updates)
      .eq("id", activeNumber.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating voicemail settings:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      settings: {
        externalPhoneNumber: updatedNumber.external_phone_number,
        voicemailEnabled: updatedNumber.voicemail_enabled,
        voicemailMode: updatedNumber.voicemail_mode,
        forwardingEnabled: updatedNumber.forwarding_enabled,
        forwardingConfirmed: updatedNumber.forwarding_confirmed,
      },
    });
  } catch (error: any) {
    console.error("Error in /api/telephony/voicemail/settings:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}








