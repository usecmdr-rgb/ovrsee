/**
 * Google Calendar Sync Utilities
 * 
 * Helper functions for two-way sync between OVRSEE and Google Calendar
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import type { GoogleCalendarEvent, OVRSEEEvent, CalendarEventMapping, SyncResult } from "./sync-types";
import { getSyncDateRange } from "./date-utils";

/**
 * Refresh Google Calendar access token
 */
export async function refreshCalendarToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const CALENDAR_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || "";
  const CALENDAR_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || "";

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: CALENDAR_CLIENT_ID,
      client_secret: CALENDAR_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  return response.json();
}

/**
 * Get valid Google Calendar access token (refresh if needed)
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = getSupabaseServerClient();
  
  const { data: connection, error } = await supabase
    .from("calendar_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .single();

  if (error || !connection?.access_token) {
    throw new Error("Calendar not connected");
  }

  // Check if token is expired
  if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
    const refreshResponse = await refreshCalendarToken(connection.refresh_token);
    
    // Update token in database
    await supabase
      .from("calendar_connections")
      .update({
        access_token: refreshResponse.access_token,
        expires_at: new Date(Date.now() + (refreshResponse.expires_in * 1000)).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return refreshResponse.access_token;
  }

  return connection.access_token;
}

/**
 * Convert Google Calendar event to OVRSEE format
 */
export function googleEventToOVRSEE(googleEvent: GoogleCalendarEvent): OVRSEEEvent {
  return {
    id: googleEvent.id,
    summary: googleEvent.summary || "",
    description: googleEvent.description,
    start: {
      dateTime: googleEvent.start.dateTime,
      date: googleEvent.start.date,
    },
    end: {
      dateTime: googleEvent.end.dateTime,
      date: googleEvent.end.date,
    },
    location: googleEvent.location,
    attendees: googleEvent.attendees?.map(a => ({
      email: a.email,
      displayName: a.displayName,
    })),
  };
}

/**
 * Convert OVRSEE event to Google Calendar format
 */
export function ovrseeEventToGoogle(ovrseeEvent: OVRSEEEvent): Partial<GoogleCalendarEvent> {
  return {
    summary: ovrseeEvent.summary,
    description: ovrseeEvent.description,
    start: {
      dateTime: ovrseeEvent.start.dateTime,
      date: ovrseeEvent.start.date,
    },
    end: {
      dateTime: ovrseeEvent.end.dateTime,
      date: ovrseeEvent.end.date,
    },
    location: ovrseeEvent.location,
    attendees: ovrseeEvent.attendees?.map(a => ({
      email: a.email,
      displayName: a.displayName,
    })),
  };
}

/**
 * Get event mapping by Google event ID
 */
export async function getEventMappingByGoogleId(
  userId: string,
  googleEventId: string
): Promise<CalendarEventMapping | null> {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("calendar_event_mappings")
    .select("*")
    .eq("user_id", userId)
    .eq("google_event_id", googleEventId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get event mapping by OVRSEE event ID
 */
export async function getEventMappingByOVRSEEId(
  userId: string,
  ovrseeEventId: string
): Promise<CalendarEventMapping | null> {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("calendar_event_mappings")
    .select("*")
    .eq("user_id", userId)
    .eq("ovrsee_event_id", ovrseeEventId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Create or update event mapping
 */
export async function upsertEventMapping(
  userId: string,
  mapping: {
    ovrsee_event_id: string;
    google_event_id: string;
    calendar_id?: string;
    etag?: string;
  }
): Promise<CalendarEventMapping> {
  const supabase = getSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("calendar_event_mappings")
    .upsert({
      user_id: userId,
      ovrsee_event_id: mapping.ovrsee_event_id,
      google_event_id: mapping.google_event_id,
      calendar_id: mapping.calendar_id || 'primary',
      etag: mapping.etag,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,google_event_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete event mapping
 */
export async function deleteEventMapping(
  userId: string,
  googleEventId: string
): Promise<void> {
  const supabase = getSupabaseServerClient();
  
  const { error } = await supabase
    .from("calendar_event_mappings")
    .delete()
    .eq("user_id", userId)
    .eq("google_event_id", googleEventId);

  if (error) throw error;
}




