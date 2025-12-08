import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { makeOutboundCall, isTwilioConfigured } from "@/lib/twilioClient";

/**
 * POST /api/twilio/voice/outbound
 * 
 * Initiate an outbound call via Twilio
 * 
 * Body:
 * - phoneNumber (string, required) - destination number
 * - campaignId (string, optional) - associated campaign ID
 * 
 * Behavior:
 * - Requires user to have an active Twilio number (caller ID)
 * - Creates outbound call via Twilio (or simulates in mock mode)
 */
export async function POST(request: NextRequest) {
  try {
    // Ensure user is authenticated
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    const body = await request.json();
    const { phoneNumber, campaignId } = body;

    if (!phoneNumber || typeof phoneNumber !== "string") {
      return NextResponse.json(
        { error: "phoneNumber is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Find user's active Twilio number (caller ID)
    const { data: activeNumber, error: fetchError } = await supabase
      .from("user_phone_numbers")
      .select("phone_number")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();

    if (fetchError || !activeNumber) {
      return NextResponse.json(
        { error: "no_caller_id_number", message: "You need an active Aloha number to make outbound calls." },
        { status: 400 }
      );
    }

    // Get base URL for webhook
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    // Build webhook URL with user context
    const webhookUrl = `${baseUrl}/api/twilio/voice/incoming?outbound=true&userId=${userId}${campaignId ? `&campaignId=${campaignId}` : ""}`;

    if (!isTwilioConfigured) {
      // Mock mode: log and return simulated call
      console.log(`[MOCK] Outbound call from ${activeNumber.phone_number} to ${phoneNumber}`);
      
      // TODO: Log mock call to database if needed
      
      return NextResponse.json({
        status: "mock_outbound",
        callSid: `SIMULATED_CALL_${Math.random().toString(36).substring(2, 15)}`,
        from: activeNumber.phone_number,
        to: phoneNumber,
      });
    }

    // Real Twilio implementation
    try {
      const result = await makeOutboundCall(
        activeNumber.phone_number,
        phoneNumber,
        webhookUrl
      );

      return NextResponse.json({
        status: "initiated",
        callSid: result.callSid,
        from: activeNumber.phone_number,
        to: phoneNumber,
      });
    } catch (error: any) {
      console.error("Error making Twilio call:", error);
      return NextResponse.json(
        { error: "Failed to initiate call", details: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in /api/twilio/voice/outbound:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}














