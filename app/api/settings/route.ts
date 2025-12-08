import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * GET /api/settings
 * 
 * Fetches user settings and connected accounts.
 * Aggregates both user_settings and user_connected_accounts tables.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();

    // Get user settings (create defaults if not found)
    let { data: userSettings, error: settingsError } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (settingsError && settingsError.code === "PGRST116") {
      // No settings found, create defaults
      const { data: newSettings, error: createError } = await supabase
        .from("user_settings")
        .insert({
          user_id: user.id,
          theme: "system",
          notif_daily_summary: true,
          notif_payment_alerts: true,
          notif_weekly_digest: true,
          notif_missed_calls: true,
          notif_subscription_alerts: true,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating user settings:", createError);
        return NextResponse.json(
          { error: "Failed to create user settings" },
          { status: 500 }
        );
      }

      userSettings = newSettings;
    } else if (settingsError) {
      console.error("Error loading user settings:", settingsError);
      return NextResponse.json(
        { error: "Failed to load user settings" },
        { status: 500 }
      );
    }

    // Get connected accounts
    const { data: connectedAccounts, error: accountsError } = await supabase
      .from("user_connected_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (accountsError) {
      console.error("Error loading connected accounts:", accountsError);
      // Don't fail the request if accounts fail to load
    }

    return NextResponse.json({
      settings: userSettings,
      connectedAccounts: connectedAccounts || [],
    });
  } catch (error: any) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

