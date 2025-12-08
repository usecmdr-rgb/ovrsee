# OAuth Scopes Configuration Guide

## Required Scopes for OVRSEE

### For Sync Agent (Gmail + Calendar)

Your application requests these 3 scopes for the **Sync** agent:

1. **`https://www.googleapis.com/auth/gmail.readonly`**
   - Purpose: Read emails, metadata, labels, and threads
   - Used by: Sync agent to fetch and process emails
   - User-facing description: "View your email messages and settings"

2. **`https://www.googleapis.com/auth/gmail.send`**
   - Purpose: Send emails on behalf of user
   - Used by: Sync agent to send email replies and compose messages
   - User-facing description: "Send email on your behalf"

3. **`https://www.googleapis.com/auth/calendar`**
   - Purpose: Full calendar access (read/write events, attendees, freebusy)
   - Used by: Sync agent to read calendar events, create/update events, check availability
   - User-facing description: "See, edit, share, and permanently delete all the calendars you can access using Google Calendar"

### For Aloha Agent

**Aloha does NOT require Google OAuth scopes.** Aloha uses Twilio for phone calls, which is configured separately via Twilio credentials (not Google OAuth).

### Summary

- **Sync Agent**: Requires 3 Google OAuth scopes (Gmail + Calendar)
- **Aloha Agent**: No Google OAuth scopes needed (uses Twilio)

## Do You Need to Update Selected Scopes?

### ✅ YES - You Need to Add These 3 Scopes for Sync

In the "Update selected scopes" dialog:

1. **Scroll down or search for:**
   - **Gmail API** scopes
   - **Google Calendar API** scopes

2. **Check/Select these 3 scopes:**
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/calendar`

3. **OR use "Manually add scopes" section (EASIER):**
   - Paste these three scopes (one per line):
     ```
     https://www.googleapis.com/auth/gmail.readonly
     https://www.googleapis.com/auth/gmail.send
     https://www.googleapis.com/auth/calendar
     ```
   - Click **"Add to table"**
   - Then **check the boxes** for these 3 scopes in the table

4. **Click "Update"** at the bottom to save

## Why This Matters

If these scopes aren't added to the OAuth consent screen:
- Users won't be able to grant the required permissions
- OAuth flow will fail or show incomplete permissions
- **Sync agent won't be able to:**
  - Read emails from Gmail
  - Send emails on behalf of users
  - Access calendar events
  - Create or update calendar events
- You'll see errors like "OAuth client was not found" or "insufficient permissions"

## Quick Steps

1. In the "Update selected scopes" dialog
2. Scroll to find Gmail API and Calendar API scopes
3. OR use "Manually add scopes" and paste:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/calendar
   ```
4. Check the boxes for these 3 scopes
5. Click "Update"

## After Updating Scopes

1. **Save** the consent screen configuration
2. **If in Testing mode:** Add `usecmdr@gmail.com` as a test user
3. **Wait a few minutes** for changes to propagate
4. **Try connecting Gmail again**

