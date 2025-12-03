/**
 * POST /api/aloha/phone/health-check
 * 
 * Check phone number health (exists in DB, exists in Twilio, webhooks configured)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { twilioClient, isTwilioConfigured } from "@/lib/twilioClient";
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

    if (!phoneNumber) {
      return NextResponse.json({
        status: "error",
        message: "No phone number configured for this workspace",
      }, { headers: responseHeaders });
    }

    if (!phoneNumber.twilio_phone_sid) {
      return NextResponse.json({
        status: "error",
        message: "Phone number exists but Twilio SID is missing",
      }, { headers: responseHeaders });
    }

    // Check if number exists in Twilio (if configured)
    if (isTwilioConfigured && twilioClient) {
      try {
        const twilioNumber = await twilioClient.incomingPhoneNumbers(phoneNumber.twilio_phone_sid).fetch();
        
        // Check webhook URLs
        const baseUrl = getBaseUrl();
        const expectedVoiceUrl = `${baseUrl}/api/aloha/webhooks/incoming-call`;
        const expectedStatusUrl = `${baseUrl}/api/aloha/webhooks/call-status`;

        const voiceUrlMatch = twilioNumber.voiceUrl === expectedVoiceUrl;
        const statusUrlMatch = twilioNumber.statusCallback === expectedStatusUrl;

        if (!voiceUrlMatch || !statusUrlMatch) {
          return NextResponse.json({
            status: "warning",
            message: "Phone number exists but webhooks are not configured correctly",
            details: {
              voiceUrl: {
                expected: expectedVoiceUrl,
                actual: twilioNumber.voiceUrl,
                match: voiceUrlMatch,
              },
              statusCallback: {
                expected: expectedStatusUrl,
                actual: twilioNumber.statusCallback,
                match: statusUrlMatch,
              },
            },
          }, { headers: responseHeaders });
        }

        return NextResponse.json({
          status: "ok",
          message: "Phone number is healthy and webhooks are configured correctly",
        }, { headers: responseHeaders });
      } catch (twilioError: any) {
        console.error("[Phone Health Check] Twilio error:", twilioError);
        return NextResponse.json({
          status: "error",
          message: `Phone number not found in Twilio: ${twilioError.message}`,
        }, { headers: responseHeaders });
      }
    } else {
      // Twilio not configured - just check DB
      return NextResponse.json({
        status: "warning",
        message: "Phone number exists in database but Twilio is not configured",
      }, { headers: responseHeaders });
    }
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Phone Health Check] Error:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to check phone health" },
      { status: 500 }
    );
  }
}
