import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseFromRequest } from "@/lib/auth-helpers";
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
 * Returns the current user's contact memory profiles with pagination and filtering.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const { searchParams } = new URL(request.url);

    // Query parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search"); // name or phone
    const filter = searchParams.get("filter"); // all | do-not-call | recent

    const offset = (page - 1) * pageSize;

    // Build query
    let query = supabaseClient
      .from("contact_profiles")
      .select("id, name, phone_number, notes, do_not_call, last_called_at, created_at, updated_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    // Search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    // Filter by type
    if (filter === "do-not-call") {
      query = query.eq("do_not_call", true);
    } else if (filter === "recent") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte("last_called_at", thirtyDaysAgo.toISOString());
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching contact profiles:", error);
      return NextResponse.json(
        { error: "Failed to load contacts" },
        { status: 500, headers: responseHeaders }
      );
    }

    // Map to response format
    const items = (data || []).map(contact => ({
      id: contact.id,
      name: contact.name,
      phoneNumber: contact.phone_number,
      notes: contact.notes,
      doNotCall: contact.do_not_call,
      lastCalledAt: contact.last_called_at,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    }));

    return NextResponse.json({
      items,
      page,
      pageSize,
      total: count || 0,
    }, { headers: responseHeaders });
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
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

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
        { status: 400, headers: responseHeaders }
      );
    }

    const sanitized = sanitizeContacts(user.id, incoming);

    if (!sanitized.length) {
      return NextResponse.json(
        { error: "No valid phone numbers found in contacts" },
        { status: 400, headers: responseHeaders }
      );
    }

    const { data, error } = await supabaseClient
      .from("contact_profiles")
      .upsert(sanitized, {
        onConflict: "user_id,phone_number",
      })
      .select();

    if (error) {
      console.error("Error upserting contact profiles:", error);
      return NextResponse.json(
        { error: "Failed to save contacts" },
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json({
      ok: true,
      count: data?.length || 0,
      contacts: data || [],
    }, { headers: responseHeaders });
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
    const { supabaseClient, user, responseHeaders } =
      await getAuthenticatedSupabaseFromRequest(request);

    const body = await request.json();

    const { id, notes, doNotCall } = body || {};

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400, headers: responseHeaders }
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
        { status: 400, headers: responseHeaders }
      );
    }

    const { data, error } = await supabaseClient
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
        { status: 500, headers: responseHeaders }
      );
    }

    return NextResponse.json({
      ok: true,
      contact: data,
    }, { headers: responseHeaders });
  } catch (error: any) {
    console.error("Error in PATCH /api/aloha/contacts:", error);
    const message =
      error?.message?.includes("Unauthorized") || error?.status === 401
        ? "Authentication required"
        : "Internal server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
