/**
 * POST /api/aloha/configure-webhooks
 * 
 * Configures Twilio webhook URLs for a phone number
 * This endpoint updates the Twilio phone number with the correct webhook URLs
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withLogging } from "@/lib/api/middleware";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { Errors } from "@/lib/api/errors";
import { updatePhoneNumberWebhooks } from "@/lib/twilioClient";
import { getBaseUrl } from "@/lib/auth/getBaseUrl";

async function handler(request: NextRequest, userId: string) {
  const supabase = getSupabaseServerClient();
  const body = await request.json();
  const { phoneNumberId } = body;

  if (!phoneNumberId) {
    throw Errors.BadRequest("phoneNumberId is required");
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

  // Get phone number
  const { data: phoneNumber, error: phoneError } = await supabase
    .from("user_phone_numbers")
    .select("*")
    .eq("id", phoneNumberId)
    .eq("workspace_id", workspace.id)
    .single();

  if (phoneError || !phoneNumber) {
    throw Errors.NotFound("Phone number");
  }

  if (!phoneNumber.twilio_phone_sid) {
    throw Errors.BadRequest("Phone number does not have a Twilio SID");
  }

  // Build webhook URLs
  const baseUrl = getBaseUrl();
  const voiceUrl = `${baseUrl}/api/aloha/webhooks/incoming-call`;
  const statusCallbackUrl = `${baseUrl}/api/aloha/webhooks/call-status`;

  // Update Twilio phone number webhooks
  try {
    await updatePhoneNumberWebhooks(
      phoneNumber.twilio_phone_sid,
      voiceUrl,
      statusCallbackUrl
    );
  } catch (error) {
    console.error("[Aloha] Error updating Twilio webhooks:", error);
    throw Errors.InternalServerError("Failed to update Twilio webhooks");
  }

  return NextResponse.json({
    success: true,
    webhooks: {
      voice_url: voiceUrl,
      status_callback_url: statusCallbackUrl,
    },
  });
}

export const POST = withLogging(requireAuth(handler));




