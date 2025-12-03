/**
 * DELETE /api/aloha/contacts/:id
 * 
 * Delete a contact by ID
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const contactId = params.id;

    if (!contactId) {
      return NextResponse.json(
        { error: "Contact ID is required" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Delete contact (hard delete for now, can be changed to soft delete if needed)
    const { error } = await supabaseClient
      .from("contact_profiles")
      .delete()
      .eq("id", contactId)
      .eq("user_id", user.id);

    if (error) {
      console.error("[Delete Contact] Error:", error);
      return NextResponse.json(
        { error: "Failed to delete contact" },
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Contact deleted successfully",
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Delete Contact] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
