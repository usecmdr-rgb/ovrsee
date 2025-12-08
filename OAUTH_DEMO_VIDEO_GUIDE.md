# OAuth Demo Video Guide for Google Cloud Console

## ✅ Yes, You Need a Demo Video

Google requires a YouTube video demonstrating how your app uses the OAuth scopes when you request **sensitive** or **restricted** scopes. This is mandatory for verification.

## What the Video Must Show

Your demo video must demonstrate all three scopes in action:

### 1. Gmail Readonly Scope
- **Show:** Reading emails from Gmail inbox
- **Demonstrate:**
  - Opening the OVRSEE Sync interface
  - Displaying emails from Gmail
  - Showing email categorization (important, invoices, payments, etc.)
  - Displaying email summaries or insights
  - Showing email search/filtering functionality

### 2. Gmail Send Scope
- **Show:** Sending emails through your app
- **Demonstrate:**
  - Composing an email reply in OVRSEE
  - User approving/sending the email
  - Email being sent successfully
  - Confirmation that email was sent

### 3. Calendar Scope
- **Show:** Reading and creating calendar events
- **Demonstrate:**
  - Displaying calendar events from Google Calendar
  - Creating a new calendar event from your app
  - Updating an existing calendar event
  - Showing calendar integration with email (e.g., scheduling from email)

## Video Requirements

### Technical Requirements
- **Platform:** Must be uploaded to YouTube (public or unlisted)
- **Duration:** 2-5 minutes recommended (not too short, not too long)
- **Quality:** Clear enough to see what's happening on screen
- **Audio:** Optional but helpful - you can narrate what's happening

### Content Requirements
- **Must show:** All OAuth clients assigned to your project (if you have multiple)
- **Must demonstrate:** Actual usage of all three scopes
- **Should show:** User consent/permission flow
- **Should show:** User control (approving actions before they happen)

## Quick Video Script Template

```
[0:00-0:30] Introduction
- "This video demonstrates how OVRSEE Sync uses Google OAuth scopes"
- Show the OVRSEE app interface

[0:30-1:30] Gmail Readonly Demo
- Navigate to Sync/Inbox section
- Show emails being loaded from Gmail
- Show email categorization (important, invoices, etc.)
- Show email summaries or insights
- Explain: "We use gmail.readonly to read and analyze emails"

[1:30-2:30] Gmail Send Demo
- Select an email that needs a reply
- Show AI-generated draft reply
- Show user approving the reply
- Send the email
- Verify it was sent successfully
- Explain: "We use gmail.send to send emails on behalf of users"

[2:30-3:30] Calendar Demo
- Show calendar events being displayed
- Create a new event from the app
- Show event appearing in Google Calendar
- Update an existing event
- Explain: "We use calendar scope to read and manage calendar events"

[3:30-4:00] Conclusion
- Show user controls/permissions
- Emphasize that all actions require user approval
- End with app logo or branding
```

## Alternative: Use Test Mode First

If you can't make a video right now, you can:

1. **Use Test Mode** (for development/testing):
   - Add test users (like `usecmdr@gmail.com`)
   - Test users can use the app without verification
   - You can develop and test without the demo video
   - **Limitation:** Only test users can use the app

2. **Make the video later** when you're ready for production:
   - You can submit verification later
   - For now, test mode allows you to continue development

## Video Checklist

Before uploading, make sure your video includes:

- [ ] Clear demonstration of reading Gmail emails
- [ ] Clear demonstration of sending emails through your app
- [ ] Clear demonstration of reading calendar events
- [ ] Clear demonstration of creating/updating calendar events
- [ ] Shows user approval/permission flow
- [ ] Shows the OVRSEE app interface clearly
- [ ] Video is uploaded to YouTube (public or unlisted)
- [ ] Video is at least 1-2 minutes long
- [ ] Video quality is clear enough to see what's happening

## Tips for Recording

1. **Use screen recording software:**
   - Mac: QuickTime Player (built-in) or ScreenFlow
   - Windows: OBS Studio or Windows Game Bar
   - Chrome: Loom extension

2. **Prepare your demo:**
   - Have test emails ready in Gmail
   - Have test calendar events ready
   - Practice the flow before recording

3. **Keep it simple:**
   - Don't overcomplicate the demo
   - Focus on showing the scopes in action
   - Clear, simple demonstrations work best

## What NOT to Include

- ❌ Don't show sensitive user data (use test data)
- ❌ Don't make it too long (keep it under 5 minutes)
- ❌ Don't skip any of the three scopes
- ❌ Don't use placeholder/mock data (use real Gmail/Calendar)

## Next Steps

1. **Option A: Make video now**
   - Record the demo following the script above
   - Upload to YouTube (public or unlisted)
   - Copy the YouTube URL
   - Paste it into Google Cloud Console

2. **Option B: Use test mode**
   - Add test users to your OAuth consent screen
   - Continue development without verification
   - Make video later when ready for production

## Example YouTube Video Structure

```
Title: "OVRSEE Sync - Google OAuth Scope Demonstration"
Description: "This video demonstrates how OVRSEE Sync uses Google OAuth scopes (Gmail readonly, Gmail send, and Calendar) to provide intelligent email and calendar management features."

Video should show:
1. Gmail readonly - reading and categorizing emails
2. Gmail send - sending email replies
3. Calendar - reading and creating events
```


