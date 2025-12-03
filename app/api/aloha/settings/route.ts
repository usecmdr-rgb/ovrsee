/**
 * GET /api/aloha/settings
 * PUT /api/aloha/settings
 * 
 * Get and update Aloha settings for the workspace
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";
import { getAlohaProfile } from "@/lib/aloha/profile";

export async function GET(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    // Get phone number from user_phone_numbers
    const { data: phoneNumber } = await supabaseClient
      .from("user_phone_numbers")
      .select("id, phone_number, twilio_phone_sid, is_active")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();

    // Get aloha_settings
    const { data: settings } = await supabaseClient
      .from("aloha_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single();

    // Get profile for displayName and voiceId
    const profile = await getAlohaProfile(user.id);

    // Parse phone number if available
    let phoneNumberData = {
      id: null as string | null,
      e164: null as string | null,
      country: null as string | null,
      areaCode: null as string | null,
    };

    if (phoneNumber?.phone_number) {
      phoneNumberData.id = phoneNumber.id;
      phoneNumberData.e164 = phoneNumber.phone_number;
      // Simple parsing (can be enhanced)
      if (phoneNumber.phone_number.startsWith("+1")) {
        phoneNumberData.country = "US";
        const digits = phoneNumber.phone_number.replace("+1", "");
        if (digits.length >= 10) {
          phoneNumberData.areaCode = digits.substring(0, 3);
        }
      }
    }

    // Health check (simplified - can be enhanced)
    const health = {
      status: phoneNumber ? "ok" : "warning" as "ok" | "warning" | "error",
      message: phoneNumber ? "Phone number configured" : "No phone number configured",
    };

    // Agent settings
    const agent = {
      displayName: profile?.display_name || "Aloha",
      voiceId: profile?.voice_key || "friendly_female_us",
    };

    // Features from aloha_settings metadata or defaults
    const features = {
      conversationIntelligence: { enabled: settings?.metadata?.features?.conversationIntelligence?.enabled ?? true },
      naturalVoiceDynamics: { enabled: settings?.metadata?.features?.naturalVoiceDynamics?.enabled ?? true },
      emotionalIntelligence: { enabled: settings?.metadata?.features?.emotionalIntelligence?.enabled ?? true },
      communicationResilience: { enabled: settings?.metadata?.features?.communicationResilience?.enabled ?? true },
      contactMemory: { enabled: settings?.metadata?.features?.contactMemory?.enabled ?? true },
      endOfCallIntelligence: { enabled: settings?.metadata?.features?.endOfCallIntelligence?.enabled ?? true },
    };

    return NextResponse.json({
      phoneNumber: phoneNumberData,
      health,
      agent,
      features,
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Aloha Settings GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const body = await request.json();

    // Get or create aloha_settings
    let { data: settings } = await supabaseClient
      .from("aloha_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single();

    if (!settings) {
      // Create default settings
      const { data: newSettings, error: createError } = await supabaseClient
        .from("aloha_settings")
        .insert({
          workspace_id: workspaceId,
          metadata: {},
        })
        .select()
        .single();

      if (createError || !newSettings) {
        return NextResponse.json(
          { error: "Failed to create settings" },
          { status: 500, headers: responseHeaders }
        );
      }
      settings = newSettings;
    }

    // Update profile if displayName or voiceId provided
    if (body.displayName || body.voiceId) {
      const { updateAlohaProfile } = await import("@/lib/aloha/profile");
      const updates: {
        display_name?: string;
        voice_key?: string;
      } = {};
      if (body.displayName) updates.display_name = body.displayName;
      if (body.voiceId) updates.voice_key = body.voiceId;
      await updateAlohaProfile(user.id, updates);
    }

    // Update features in metadata
    const currentMetadata = settings.metadata || {};
    const currentFeatures = currentMetadata.features || {};

    if (body.features) {
      Object.keys(body.features).forEach((key) => {
        if (body.features[key]?.enabled !== undefined) {
          currentFeatures[key] = { enabled: body.features[key].enabled };
        }
      });
    }

    // Update aloha_settings
    const { data: updatedSettings, error: updateError } = await supabaseClient
      .from("aloha_settings")
      .update({
        metadata: {
          ...currentMetadata,
          features: currentFeatures,
        },
      })
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (updateError) {
      console.error("[Aloha Settings PUT] Error:", updateError);
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Return updated settings (same format as GET)
    const profile = await getAlohaProfile(user.id);
    const { data: phoneNumber } = await supabaseClient
      .from("user_phone_numbers")
      .select("id, phone_number")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();

    let phoneNumberData = {
      id: phoneNumber?.id || null,
      e164: phoneNumber?.phone_number || null,
      country: null as string | null,
      areaCode: null as string | null,
    };

    if (phoneNumber?.phone_number?.startsWith("+1")) {
      phoneNumberData.country = "US";
      const digits = phoneNumber.phone_number.replace("+1", "");
      if (digits.length >= 10) {
        phoneNumberData.areaCode = digits.substring(0, 3);
      }
    }

    const health = {
      status: phoneNumber ? "ok" : "warning" as "ok" | "warning" | "error",
      message: phoneNumber ? "Phone number configured" : "No phone number configured",
    };

    const agent = {
      displayName: profile?.display_name || "Aloha",
      voiceId: profile?.voice_key || "friendly_female_us",
    };

    const features = {
      conversationIntelligence: { enabled: currentFeatures.conversationIntelligence?.enabled ?? true },
      naturalVoiceDynamics: { enabled: currentFeatures.naturalVoiceDynamics?.enabled ?? true },
      emotionalIntelligence: { enabled: currentFeatures.emotionalIntelligence?.enabled ?? true },
      communicationResilience: { enabled: currentFeatures.communicationResilience?.enabled ?? true },
      contactMemory: { enabled: currentFeatures.contactMemory?.enabled ?? true },
      endOfCallIntelligence: { enabled: currentFeatures.endOfCallIntelligence?.enabled ?? true },
    };

    return NextResponse.json({
      phoneNumber: phoneNumberData,
      health,
      agent,
      features,
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Aloha Settings PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
