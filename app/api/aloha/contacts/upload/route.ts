/**
 * POST /api/aloha/contacts/upload
 * 
 * Accepts CSV upload and upserts contacts
 * For now, assumes frontend sends parsed data as JSON array
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
import { normalizePhoneNumber } from "@/lib/aloha/contact-memory";

interface CSVContactRow {
  name?: string;
  phoneNumber: string;
  notes?: string;
  doNotCall?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const body = await request.json();

    // Accept either array of contacts or { contacts: [...] }
    let contacts: CSVContactRow[] = [];
    if (Array.isArray(body)) {
      contacts = body;
    } else if (Array.isArray(body.contacts)) {
      contacts = body.contacts;
    } else {
      return NextResponse.json(
        { error: "Expected array of contacts or { contacts: [...] }" },
        { status: 400, headers: responseHeaders }
      );
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: "No contacts provided" },
        { status: 400, headers: responseHeaders }
      );
    }

    // Normalize and sanitize contacts
    const sanitized = contacts
      .map((c) => {
        const normalizedPhone = normalizePhoneNumber(c.phoneNumber || "");
        if (!normalizedPhone || normalizedPhone.length < 8) {
          return null;
        }

        return {
          user_id: user.id,
          phone_number: normalizedPhone,
          name: c.name ? c.name.trim().slice(0, 100) : null,
          notes: c.notes ? c.notes.trim().slice(0, 200) : null,
          do_not_call: !!c.doNotCall,
        };
      })
      .filter(Boolean) as {
        user_id: string;
        phone_number: string;
        name: string | null;
        notes: string | null;
        do_not_call: boolean;
      }[];

    if (sanitized.length === 0) {
      return NextResponse.json(
        { error: "No valid phone numbers found in contacts" },
        { status: 400, headers: responseHeaders }
      );
    }

    // De-duplicate by phone number
    const byPhone = new Map<string, (typeof sanitized)[number]>();
    for (const contact of sanitized) {
      const existing = byPhone.get(contact.phone_number);
      // Keep the one with more data (name or notes)
      if (!existing || (contact.name && !existing.name) || (contact.notes && !existing.notes)) {
        byPhone.set(contact.phone_number, contact);
      }
    }

    const uniqueContacts = Array.from(byPhone.values());

    // Upsert contacts
    const { data, error } = await supabaseClient
      .from("contact_profiles")
      .upsert(uniqueContacts, {
        onConflict: "user_id,phone_number",
      })
      .select();

    if (error) {
      console.error("[Contacts Upload] Error upserting contacts:", error);
      return NextResponse.json(
        { error: "Failed to save contacts" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Count created vs updated (simplified: assume all are created if no existing)
    // In a real implementation, we'd check which ones existed before
    const created = data?.length || 0;
    const updated = 0; // TODO: Track which contacts were updated vs created

    return NextResponse.json({
      created,
      updated,
      total: created,
    }, { headers: responseHeaders });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.error("[Contacts Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to upload contacts" },
      { status: 500 }
    );
  }
}
