import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";

/**
 * DELETE /api/gmail/disconnect
 * Disconnect Gmail account
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();

    if (!accessToken || accessToken === "dev-token") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userResult?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = userResult.user.id;

    // Delete Gmail connection
    const { error: deleteError } = await supabase
      .from("gmail_connections")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      throw deleteError;
    }

    // Optionally: Soft delete all email queue items (or keep them for reference)
    // For now, we'll keep them but mark as disconnected
    // User can manually delete if needed

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Error disconnecting Gmail:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Gmail" },
      { status: 500 }
    );
  }
}



