/**
 * Google Calendar sync worker
 * Fetches events from Calendar API and stores in sync_calendar_events table
 */

import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { google } from "googleapis";
import { googleConfig } from "@/lib/config/env";

interface SyncJobRow {
  id: string;
  workspace_id: string;
  integration_id: string | null;
  job_type: string;
  status: string;
  from_cursor: string | null;
  to_cursor: string | null;
}

/**
 * Run initial Calendar sync
 * Fetches upcoming events and stores them
 */
export async function runCalendarInitialSync(job: SyncJobRow): Promise<void> {
  const supabase = getSupabaseServerClient();

  // Get integration with access token
  if (!job.integration_id) {
    throw new Error("Integration ID is required for sync job");
  }

  const { data: integration, error: integrationError } = await supabase
    .from("integrations")
    .select("access_token, refresh_token, metadata")
    .eq("id", job.integration_id)
    .single();

  if (integrationError || !integration) {
    throw new Error(
      `Integration not found: ${integrationError?.message || "Unknown error"}`
    );
  }

  if (!integration.access_token) {
    throw new Error("Integration missing access token");
  }

  // Initialize Calendar API client with credentials for token refresh
  const oauth2Client = new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret,
    googleConfig.redirectUrl
  );
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token || undefined,
  });

  // Refresh token if needed (googleapis handles this automatically, but we'll update DB)
  try {
    await oauth2Client.refreshAccessToken();
    const credentials = oauth2Client.credentials;
    
    // Update tokens in DB if they changed
    if (credentials.access_token && credentials.access_token !== integration.access_token) {
      await supabase
        .from("integrations")
        .update({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || integration.refresh_token,
          token_expires_at: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
        })
        .eq("id", job.integration_id);
    }
  } catch (refreshError) {
    // If refresh fails, continue with existing token (might still be valid)
    console.warn("Token refresh failed, using existing token:", refreshError);
  }

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  // Fetch events from primary calendar (next 30 days)
  const timeMin = new Date().toISOString();
  const timeMax = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: eventsResponse, error: eventsError } =
    await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      maxResults: 250, // Google Calendar API limit
      singleEvents: true,
      orderBy: "startTime",
    });

  if (eventsError) {
    throw new Error(`Calendar API error: ${eventsError.message}`);
  }

  const events = eventsResponse.data.items || [];

  // Upsert events
  for (const event of events) {
    try {
      if (!event.id) {
        continue; // Skip events without ID
      }

      const startDate = event.start?.dateTime || event.start?.date;
      const endDate = event.end?.dateTime || event.end?.date;

      // Upsert event
      const { error: upsertError } = await supabase
        .from("sync_calendar_events")
        .upsert(
          {
            workspace_id: job.workspace_id,
            integration_id: job.integration_id,
            external_id: event.id,
            calendar_id: "primary",
            summary: event.summary || null,
            description: event.description || null,
            location: event.location || null,
            start_at: startDate ? new Date(startDate).toISOString() : null,
            end_at: endDate ? new Date(endDate).toISOString() : null,
            status:
              (event.status as "confirmed" | "tentative" | "cancelled") ||
              "confirmed",
            attendees: (event.attendees || []).map((a) => ({
              email: a.email,
              displayName: a.displayName,
              responseStatus: a.responseStatus,
            })),
            hangout_link: event.hangoutLink || null,
            metadata: {},
          },
          {
            onConflict: "integration_id,external_id",
            ignoreDuplicates: false,
          }
        );

      if (upsertError) {
        console.error(`Failed to upsert event ${event.id}:`, upsertError.message);
        // Continue with other events
      }
    } catch (error: any) {
      console.error(`Error processing event ${event.id}:`, error.message);
      // Continue with other events
    }
  }

  // Update job with cursor (using timeMax as cursor)
  await supabase
    .from("sync_jobs")
    .update({
      to_cursor: timeMax,
    })
    .eq("id", job.id);

  // Update integration last_synced_at
  await supabase
    .from("integrations")
    .update({
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", job.integration_id);
}

