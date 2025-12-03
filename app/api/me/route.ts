/**
 * Current User Endpoint
 * 
 * GET /api/me
 * Returns the currently authenticated user's profile and workspace information
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withLogging } from "@/lib/api/middleware";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { Errors } from "@/lib/api/errors";

async function handler(request: NextRequest, userId: string) {
  const supabase = getSupabaseServerClient();

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    throw Errors.NotFound("User profile");
  }

  // Get user's auth info
  const { data: { user }, error: authError } = await supabase.auth.getUser(userId);
  
  if (authError || !user) {
    throw Errors.NotFound("User");
  }

  // Get user's workspace (if multi-tenant)
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, stripe_customer_id")
    .eq("owner_user_id", userId)
    .single();

  // Get subscription info
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  // Get Aloha-related info (phone number, settings)
  let alohaInfo = null;
  if (workspace) {
    const { data: phoneNumber } = await supabase
      .from("user_phone_numbers")
      .select("phone_number, is_active, voicemail_enabled")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .single();

    const { data: alohaSettings } = await supabase
      .from("aloha_settings")
      .select("id, ai_enabled, greeting_message")
      .eq("workspace_id", workspace.id)
      .single();

    alohaInfo = {
      has_phone_number: !!phoneNumber,
      phone_number: phoneNumber?.phone_number || null,
      voicemail_enabled: phoneNumber?.voicemail_enabled || false,
      settings_configured: !!alohaSettings,
      ai_enabled: alohaSettings?.ai_enabled || false,
    };
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    profile: {
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      company_name: profile.company_name,
    },
    workspace: workspace ? {
      id: workspace.id,
      name: workspace.name,
    } : null,
    subscription: subscription ? {
      tier: subscription.tier,
      status: subscription.status,
      current_period_end: subscription.current_period_end,
    } : null,
    aloha: alohaInfo,
  });
}

export const GET = withLogging(requireAuth(handler));

