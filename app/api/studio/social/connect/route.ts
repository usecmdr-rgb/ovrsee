/**
 * Studio Social Connect API
 * 
 * POST /api/studio/social/connect
 * 
 * Connect a social media platform (for now, simulates connected state)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { getWorkspaceIdForUser } from "@/lib/workspace-helpers";

export async function POST(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const workspaceId = await getWorkspaceIdForUser(user.id, supabaseClient);
    if (!workspaceId) {
      return NextResponse.json(
        { ok: false, error: "Workspace not found" },
        { status: 404, headers: responseHeaders }
      );
    }

    const body = await request.json();
    const { platform } = body;

    if (!platform || !["instagram", "tiktok", "facebook"].includes(platform)) {
      return NextResponse.json(
        { ok: false, error: "Invalid platform. Must be 'instagram', 'tiktok', or 'facebook'" },
        { status: 400, headers: responseHeaders }
      );
    }

    // This endpoint is deprecated - OAuth callbacks now handle account creation
    // Keeping for backwards compatibility but it should redirect to OAuth flow
    // TODO: Remove this endpoint or make it redirect to OAuth
    
    // For now, return error suggesting user use OAuth flow
    return NextResponse.json(
      {
        ok: false,
        error: "Please use OAuth flow to connect accounts. This endpoint is deprecated.",
        redirect_to_oauth: true,
      },
      { status: 400, headers: responseHeaders }
    );

    // Legacy code (commented out):
    // Upsert into studio_social_accounts with status = 'connected'
    // For now, we simulate connected state until real OAuth is implemented
    /*
    const { data: account, error: accountError } = await supabaseClient
      .from("studio_social_accounts")
      .upsert(
        {
          workspace_id: workspaceId,
          created_by: user.id,
          platform,
          status: "connected",
          connected_at: new Date().toISOString(),
          // Simulated data for now
          handle: `@${platform}_account`,
          metadata: {
            simulated: true,
            note: "This is a simulated connection. Real OAuth integration coming soon.",
          },
        },
        {
          onConflict: "workspace_id,platform",
        }
      )
      .select()
      .single();
    */

    if (accountError) {
      console.error("Error connecting social account:", accountError);
      return NextResponse.json(
        { ok: false, error: "Failed to connect social account", details: accountError.message },
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          account,
        },
      },
      { headers: responseHeaders }
    );
  } catch (error: any) {
    console.error("Error in studio social connect endpoint:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
