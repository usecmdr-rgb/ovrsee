/**
 * GET /api/aloha/contact-memory/summary
 * 
 * Returns lightweight stats for the Contact Memory card
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);
    
    // Query contact_profiles table (scoped by user_id)
    const { data: contacts, error: contactsError } = await supabaseClient
      .from("contact_profiles")
      .select("id, do_not_call, last_called_at")
      .eq("user_id", user.id);
    
    if (contactsError) {
      console.error("[Contact Memory Summary] Error fetching contacts:", contactsError);
      return NextResponse.json(
        { error: "Failed to fetch contact statistics" },
        { status: 500, headers: responseHeaders }
      );
    }
    
    const totalContacts = contacts?.length || 0;
    const doNotCallCount = contacts?.filter(c => c.do_not_call).length || 0;
    
    // Recently contacted = called within last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentlyContactedCount = contacts?.filter(c => {
      if (!c.last_called_at) return false;
      return new Date(c.last_called_at) >= thirtyDaysAgo;
    }).length || 0;
    
    return NextResponse.json({
      totalContacts,
      doNotCallCount,
      recentlyContactedCount,
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    console.error("[Contact Memory Summary] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch contact memory summary" },
      { status: 500 }
    );
  }
}

