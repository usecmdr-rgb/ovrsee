import { NextRequest, NextResponse } from "next/server";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { getOrCreateWorkspace, getWorkspaceIntegration } from "@/lib/sync/integrations";
import { google } from "googleapis";
import { googleConfig } from "@/lib/config/env";
import { createErrorResponse } from "@/lib/validation";

/**
 * GET /api/sync/google/dev-test
 * 
 * Development-only endpoint to test Google OAuth tokens end-to-end
 * 
 * Tests:
 * - Gmail API: List first 5 messages (IDs and subjects)
 * - Calendar API: List next 5 upcoming events (summaries and start times)
 * 
 * SECURITY:
 * - Requires authentication
 * - Only available in non-production environments
 */
export async function GET(request: NextRequest) {
  // Only allow in non-production
  if (process.env.NODE_ENV === "production") {
    return createErrorResponse("This endpoint is only available in development", 403);
  }

  try {
    // Require authentication
    const user = await requireAuthFromRequest(request);
    const userId = user.id;

    // Get or create workspace
    const workspace = await getOrCreateWorkspace(userId);

    // Get Gmail integration
    const gmailIntegration = await getWorkspaceIntegration(workspace.id, "gmail");
    if (!gmailIntegration) {
      return NextResponse.json({
        ok: false,
        error: "Gmail integration not found",
        instructions: "Connect Gmail first by visiting /sync and clicking 'Connect Gmail'",
      }, { status: 404 });
    }

    // Get Calendar integration
    const calendarIntegration = await getWorkspaceIntegration(workspace.id, "google_calendar");
    if (!calendarIntegration) {
      return NextResponse.json({
        ok: false,
        error: "Calendar integration not found",
        instructions: "Connect Calendar first by visiting /sync and clicking 'Connect Calendar'",
      }, { status: 404 });
    }

    // Initialize OAuth2 clients
    const gmailOAuth2Client = new google.auth.OAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret,
      googleConfig.redirectUrl
    );
    gmailOAuth2Client.setCredentials({
      access_token: gmailIntegration.access_token as string,
      refresh_token: gmailIntegration.refresh_token as string | undefined,
    });

    const calendarOAuth2Client = new google.auth.OAuth2(
      googleConfig.clientId,
      googleConfig.clientSecret,
      googleConfig.redirectUrl
    );
    calendarOAuth2Client.setCredentials({
      access_token: calendarIntegration.access_token as string,
      refresh_token: calendarIntegration.refresh_token as string | undefined,
    });

    // Refresh tokens if needed (googleapis handles this automatically)
    try {
      await gmailOAuth2Client.refreshAccessToken();
      await calendarOAuth2Client.refreshAccessToken();
    } catch (refreshError: any) {
      console.warn("Token refresh warning:", refreshError);
      // Continue anyway - tokens might still be valid
    }

    // Test Gmail API
    const gmail = google.gmail({ version: "v1", auth: gmailOAuth2Client });
    let gmailMessages: any[] = [];
    let gmailError: string | null = null;

    try {
      const gmailResponse = await gmail.users.messages.list({
        userId: "me",
        maxResults: 5,
        q: "in:inbox",
      });

      const messageIds = gmailResponse.data.messages?.map(m => m.id) || [];
      
      // Fetch message details
      for (const messageId of messageIds.slice(0, 5)) {
        const messageDetail = await gmail.users.messages.get({
          userId: "me",
          id: messageId!,
          format: "metadata",
          metadataHeaders: ["Subject", "From"],
        });

        const headers = messageDetail.data.payload?.headers || [];
        const subject = headers.find(h => h.name === "Subject")?.value || "(No subject)";
        const from = headers.find(h => h.name === "From")?.value || "Unknown";

        gmailMessages.push({
          id: messageId,
          subject,
          from,
          snippet: messageDetail.data.snippet || "",
        });
      }
    } catch (error: any) {
      gmailError = error.message || "Failed to fetch Gmail messages";
      console.error("Gmail API error:", error);
    }

    // Test Calendar API
    const calendar = google.calendar({ version: "v3", auth: calendarOAuth2Client });
    let calendarEvents: any[] = [];
    let calendarError: string | null = null;

    try {
      const now = new Date();
      const calendarResponse = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        maxResults: 5,
        singleEvents: true,
        orderBy: "startTime",
      });

      calendarEvents = (calendarResponse.data.items || []).map(event => ({
        id: event.id,
        summary: event.summary || "(No title)",
        start: event.start?.dateTime || event.start?.date || null,
        end: event.end?.dateTime || event.end?.date || null,
        location: event.location || null,
      }));
    } catch (error: any) {
      calendarError = error.message || "Failed to fetch Calendar events";
      console.error("Calendar API error:", error);
    }

    // Return test results
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      workspace: {
        id: workspace.id,
        ownerUserId: workspace.owner_user_id,
      },
      integrations: {
        gmail: {
          found: !!gmailIntegration,
          hasAccessToken: !!gmailIntegration?.access_token,
          hasRefreshToken: !!gmailIntegration?.refresh_token,
          expiresAt: gmailIntegration?.token_expires_at,
          scopes: gmailIntegration?.scopes || [],
        },
        calendar: {
          found: !!calendarIntegration,
          hasAccessToken: !!calendarIntegration?.access_token,
          hasRefreshToken: !!calendarIntegration?.refresh_token,
          expiresAt: calendarIntegration?.token_expires_at,
          scopes: calendarIntegration?.scopes || [],
        },
      },
      testResults: {
        gmail: {
          success: !gmailError,
          error: gmailError,
          messagesCount: gmailMessages.length,
          messages: gmailMessages,
        },
        calendar: {
          success: !calendarError,
          error: calendarError,
          eventsCount: calendarEvents.length,
          events: calendarEvents,
        },
      },
    });
  } catch (error: any) {
    console.error("Dev test error:", error);
    return createErrorResponse(
      error.message || "Failed to run dev test",
      500
    );
  }
}


