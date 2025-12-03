import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withLogging } from "@/lib/api/middleware";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { Errors } from "@/lib/api/errors";
import { purchasePhoneNumber } from "@/lib/twilioClient";
import { getBaseUrl } from "@/lib/auth/getBaseUrl";

/**
 * POST /api/telephony/twilio/purchase-number
 * 
 * Purchase a Twilio phone number for the user's workspace
 * 
 * Body:
 * - phoneNumber: string (E.164 format, e.g., +15551234567)
 */
async function handler(request: NextRequest, userId: string) {
  const supabase = getSupabaseServerClient();
  const body = await request.json();
  const { phoneNumber } = body;

  if (!phoneNumber) {
    throw Errors.BadRequest("phoneNumber is required (E.164 format, e.g., +15551234567)");
  }

  // Get user's workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_user_id", userId)
    .single();

  if (workspaceError || !workspace) {
    throw Errors.NotFound("Workspace");
  }

  // Build webhook URLs
  const baseUrl = getBaseUrl();
  const voiceUrl = `${baseUrl}/api/aloha/webhooks/incoming-call`;
  const statusCallbackUrl = `${baseUrl}/api/aloha/webhooks/call-status`;

  // Purchase phone number from Twilio
  let twilioResult;
  try {
    twilioResult = await purchasePhoneNumber(phoneNumber, voiceUrl, statusCallbackUrl);
  } catch (error: any) {
    console.error("[Purchase Number] Twilio error:", error);
    throw Errors.InternalServerError(`Failed to purchase number: ${error.message}`);
  }

  // Deactivate any existing active numbers for this workspace
  await supabase
    .from("user_phone_numbers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspace.id)
    .eq("is_active", true);

  // Create new phone number record
  const { data: newNumber, error: insertError } = await supabase
    .from("user_phone_numbers")
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      phone_number: twilioResult.phoneNumber,
      twilio_phone_sid: twilioResult.sid,
      is_active: true,
      voicemail_enabled: true,
      voicemail_mode: "receptionist",
    })
    .select()
    .single();

  if (insertError) {
    console.error("[Purchase Number] Database error:", insertError);
    // Try to release the Twilio number if database insert fails
    try {
      // TODO: Call releasePhoneNumber if we have access to it here
    } catch (releaseError) {
      console.error("[Purchase Number] Failed to release Twilio number:", releaseError);
    }
    throw Errors.InternalServerError("Failed to save phone number to database");
  }

  return NextResponse.json({
    success: true,
    phoneNumber: newNumber,
    webhooks: {
      voice_url: voiceUrl,
      status_callback_url: statusCallbackUrl,
    },
  });
}

export const POST = withLogging(requireAuth(handler));
