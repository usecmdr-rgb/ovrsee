import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { normalizePhoneNumber } from "@/lib/aloha/contact-memory";

interface IncomingContact {
  phoneNumber: string;
  name?: string | null;
  notes?: string | null;
  doNotCall?: boolean;
}

/**
 * Normalize and sanitize an incoming contact payload
 */
function sanitizeContacts(
  userId: string,
  contacts: IncomingContact[]
) {
  const cleaned = contacts
    .map((c) => {
      const normalizedPhone = normalizePhoneNumber(c.phoneNumber || "");
      if (!normalizedPhone || normalizedPhone.length < 8) {
        return null;
      }

      return {
        user_id: userId,
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

  // De-duplicate by phone number
  const byPhone = new Map<string, (typeof cleaned)[number]>();
  for (const contact of cleaned) {
    byPhone.set(contact.phone_number, contact);
  }

  return Array.from(byPhone.values());
}

/**
 * GET /api/aloha/contacts
 *
 * Returns the current user's contact memory profiles.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from("contact_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching contact profiles:", error);
      return NextResponse.json(
        { error: "Failed to load contacts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      contacts: data || [],
    });
  } catch (error: any) {
    console.error("Error in GET /api/aloha/contacts:", error);
    const message =
      error?.message?.includes("Unauthorized") || error?.status === 401
        ? "Authentication required"
        : "Internal server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/aloha/contacts
 *
 * Create or upsert one or more contact profiles.
 *
 * Accepts:
 * - { contact: { phoneNumber, name?, notes?, doNotCall? } }
 * - { contacts: IncomingContact[] }
 * - IncomingContact[] (raw array)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();
    const body = await request.json();

    let incoming: IncomingContact[] = [];

    if (Array.isArray(body)) {
      incoming = body;
    } else if (Array.isArray(body?.contacts)) {
      incoming = body.contacts;
    } else if (body?.contact) {
      incoming = [body.contact];
    }

    if (!incoming.length) {
      return NextResponse.json(
        { error: "No contacts provided" },
        { status: 400 }
      );
    }

    const sanitized = sanitizeContacts(user.id, incoming);

    if (!sanitized.length) {
      return NextResponse.json(
        { error: "No valid phone numbers found in contacts" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("contact_profiles")
      .upsert(sanitized, {
        onConflict: "user_id,phone_number",
      })
      .select();

    if (error) {
      console.error("Error upserting contact profiles:", error);
      return NextResponse.json(
        { error: "Failed to save contacts" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: data?.length || 0,
      contacts: data || [],
    });
  } catch (error: any) {
    console.error("Error in POST /api/aloha/contacts:", error);
    const message =
      error?.message?.includes("Unauthorized") || error?.status === 401
        ? "Authentication required"
        : "Internal server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/aloha/contacts
 *
 * Lightweight updates for a single contact profile (notes, do-not-call).
 *
 * Body:
 * - id: string (contact_profiles.id)
 * - notes?: string | null
 * - doNotCall?: boolean
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const supabase = getSupabaseServerClient();
    const body = await request.json();

    const { id, notes, doNotCall } = body || {};

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const update: Record<string, any> = {};

    if (notes !== undefined) {
      if (notes === null || notes === "") {
        update.notes = null;
      } else if (typeof notes === "string") {
        update.notes = notes.trim().slice(0, 200);
      }
    }

    if (doNotCall !== undefined) {
      update.do_not_call = !!doNotCall;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("contact_profiles")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating contact profile:", error);
      return NextResponse.json(
        { error: "Failed to update contact" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      contact: data,
    });
  } catch (error: any) {
    console.error("Error in PATCH /api/aloha/contacts:", error);
    const message =
      error?.message?.includes("Unauthorized") || error?.status === 401
        ? "Authentication required"
        : "Internal server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}











