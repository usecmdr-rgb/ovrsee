# OAuth Demo Video Workflow - How to Record Without Production Access

## The Solution: Record Video in Test Mode ✅

You **CAN** record the demo video while OAuth is in **Test Mode**. Google doesn't require production access - they just want to see how the scopes are used.

## Step-by-Step Workflow

### Step 1: Set Up Test Mode (Get OAuth Working)
1. Go to Google Cloud Console → OAuth consent screen
2. Set "Publishing status" to **"Testing"**
3. Add yourself as a test user (`usecmdr@gmail.com` or your email)
4. Add the 3 required scopes (gmail.readonly, gmail.send, calendar)
5. Save - OAuth now works for test users!

### Step 2: Test OAuth Connection
1. Go to your app's Sync page (`/sync`)
2. Click "Connect Google Services"
3. Complete OAuth flow - it should work now!
4. Verify you can:
   - See emails from Gmail
   - Send an email (if that feature is built)
   - See calendar events (if that feature is built)

### Step 3: Record Demo Video
Now that OAuth is working in Test Mode, record your video:

**What to Record:**
1. **Gmail Readonly Demo:**
   - Show connecting to Gmail
   - Show emails loading in your app
   - Show email categorization/prioritization
   - Show email summaries or insights

2. **Gmail Send Demo:**
   - Show composing an email reply
   - Show user approving the reply
   - Show sending the email
   - Verify it was sent (check Gmail)

3. **Calendar Demo:**
   - Show calendar events displaying
   - Show creating a new event
   - Show updating an event
   - Verify in Google Calendar

**Recording Tips:**
- Use screen recording software (QuickTime on Mac, OBS, or Loom)
- Keep it simple - 2-5 minutes
- Show real functionality, not mockups
- Narrate what you're doing

### Step 4: Upload to YouTube
1. Upload video to YouTube (public or unlisted)
2. Copy the YouTube URL
3. Keep the video - you'll need it for verification

### Step 5: Submit for Verification
1. Go back to Google Cloud Console → OAuth consent screen
2. Fill in all required fields:
   - App name, support email, etc.
   - Scope justifications (we already have these)
   - **YouTube video link** (paste from Step 4)
3. Submit for verification
4. Wait for Google approval (can take days/weeks)

### Step 6: Switch to Production (After Approval)
1. Once Google approves, you'll get an email
2. Go back to OAuth consent screen
3. Change "Publishing status" from "Testing" to **"In production"**
4. Now ANY user can connect!

## Key Point: Test Mode = Full Functionality

**Important:** Test Mode gives you FULL OAuth functionality - it's not limited. The only difference is:
- **Test Mode**: Only test users can connect (but OAuth works perfectly)
- **Production Mode**: Any user can connect (same functionality)

## What If Features Aren't Built Yet?

If you don't have all features built yet, you can:

### Option A: Build Minimum Features First
Build the minimum needed to demonstrate scopes:
- ✅ Connect to Gmail (read emails)
- ✅ Send one email (even if basic)
- ✅ Show calendar events (even if basic)

### Option B: Record What You Have
- Record what's working now
- Explain future features in the video
- Google mainly wants to see the scopes being used

### Option C: Use Test Mode Longer
- Keep developing in Test Mode
- Record video when more features are ready
- Submit for verification later

## Example Video Script (Test Mode)

```
[0:00-0:15] Introduction
"This is OVRSEE Sync, an AI email and calendar assistant.
I'm recording this in test mode to demonstrate OAuth scope usage."

[0:15-1:00] Gmail Readonly
"First, I'll connect my Gmail account..."
[Show OAuth flow]
"Now I can see my emails in the OVRSEE interface..."
[Show emails loading]
"Emails are being categorized and prioritized..."
[Show categorization]

[1:00-1:45] Gmail Send
"Now I'll compose and send an email reply..."
[Show composing]
"After user approval, the email is sent..."
[Show sending]
"Let me verify it was sent..."
[Check Gmail]

[1:45-2:30] Calendar
"I can see my calendar events..."
[Show events]
"Let me create a new event..."
[Create event]
"Now let me verify it in Google Calendar..."
[Show in Calendar]

[2:30-3:00] Conclusion
"All actions require user approval.
The app uses these scopes to help users manage email and calendar efficiently."
```

## Summary

1. ✅ Set up Test Mode → OAuth works immediately
2. ✅ Test the connection → Verify it works
3. ✅ Record video → Show scopes in action
4. ✅ Upload to YouTube → Get the link
5. ✅ Submit for verification → Include video link
6. ✅ Wait for approval → Then switch to Production

**You don't need production access to record the video - Test Mode works perfectly!**


