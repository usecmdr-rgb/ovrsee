/**
 * POST /api/aloha/phone/fix
 * 
 * Attempts to reconfigure webhooks for the assigned phone number
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { twilioClient, isTwilioConfigured, updatePhoneNumberWebhooks } from "@/lib/twilioClient";
import { getBaseUrl } from "@/lib/auth/getBaseUrl";

export async function POST(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { status: "error", message: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Get phone number from DB
    const { data: phoneNumber } = await supabaseClient
      .from("user_phone_numbers")
      .select("id, phone_number, twilio_phone_sid, is_active")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();

    if (!phoneNumber || !phoneNumber.twilio_phone_sid) {
      return NextResponse.json(
        { status: "error", message: "No phone number configured" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (!isTwilioConfigured || !twilioClient) {
      return NextResponse.json(
        { status: "error", message: "Twilio is not configured" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Build webhook URLs
    const baseUrl = getBaseUrl();
    const voiceUrl = `${baseUrl}/api/aloha/webhooks/incoming-call`;
    const statusCallbackUrl = `${baseUrl}/api/aloha/webhooks/call-status`;

    // Update webhooks
    try {
      await updatePhoneNumberWebhooks(phoneNumber.twilio_phone_sid, voiceUrl, statusCallbackUrl);
    } catch (twilioError: any) {
      console.error("[Phone Fix] Twilio error:", twilioError);
      return NextResponse.json({
        status: "error",
        message: `Failed to update webhooks: ${twilioError.message}`,
      }, { headers: responseHeaders });
    }

    // Return new health status (same format as health-check)
    return NextResponse.json({
      status: "ok",
      message: "Webhooks reconfigured successfully",
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Phone Fix] Error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to fix phone configuration" },
      { status: 500 }
    );
  }
}
