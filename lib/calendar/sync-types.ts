/**
 * Google Calendar Sync Types
 * 
 * Type definitions for two-way calendar sync between OVRSEE and Google Calendar
 */

export interface CalendarEventMapping {
  id: string;
  user_id: string;
  ovrsee_event_id: string;
  google_event_id: string;
  calendar_id: string;
  etag?: string;
  updated_at: string;
  created_at: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  recurrence?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
  status?: string;
  etag?: string;
  updated?: string;
  created?: string;
}

export interface OVRSEEEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  attendees?: Array<{ email: string; displayName?: string }>;
  notes?: string;
  memo?: string;
  reminder?: string;
  createdByAloha?: boolean;
  alohaCallId?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_source?: 'ovrsee' | 'google' | 'system' | null;
}

export type SyncDirection = 'two-way' | 'ovrsee-to-google' | 'google-to-ovrsee';
export type DeletedSource = 'ovrsee' | 'google' | 'system';

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  errors: Array<{ eventId: string; error: string }>;
}



