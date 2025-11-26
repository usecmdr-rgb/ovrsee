# Deployment Troubleshooting Checklist

## If you're not seeing the Aloha settings changes after deployment:

### 1. Verify the commit is on GitHub
- Check: https://github.com/usecmdr-rgb/commanderx-site/commits/main
- Look for commit `d3446db` - "Add missing conversation layers sections to Aloha settings page"
- The commit should be visible on GitHub

### 2. Check Vercel Deployment
- Go to your Vercel dashboard
- Check if the latest commit (`d3446db` or later) is being deployed
- Look for any build errors in the deployment logs
- Ensure the deployment completed successfully (not failed or in progress)

### 3. Browser Cache Issues
Try these in order:

**a) Hard Refresh:**
- **Chrome/Edge (Windows/Linux):** `Ctrl + Shift + R` or `Ctrl + F5`
- **Chrome/Edge (Mac):** `Cmd + Shift + R`
- **Firefox (Windows/Linux):** `Ctrl + F5` or `Ctrl + Shift + R`
- **Firefox (Mac):** `Cmd + Shift + R`
- **Safari (Mac):** `Cmd + Option + R`

**b) Clear Cache:**
- Open browser DevTools (F12)
- Right-click the refresh button
- Select "Empty Cache and Hard Reload"

**c) Incognito/Private Window:**
- Open a new incognito/private window
- Navigate to `/aloha/settings`
- This bypasses all cache

### 4. Verify You're on the Correct Page
- The changes are on: `/aloha/settings`
- Not on: `/app/aloha/settings` (this is different)
- Make sure you're logged in and have access to Aloha

### 5. Check Build Output
The file should be at: `app/aloha/settings/page.tsx`

Look for these sections after the "Voice Selection" section:
- Conversation Intelligence Section (starts around line 611)
- Natural Voice Dynamics Section
- Emotional Intelligence Section
- Communication Resilience Section
- Contact Memory Section
- End-of-Call Intelligence Section

### 6. Verify in Vercel
Check the Vercel deployment logs for:
- Any TypeScript errors
- Any build warnings related to `app/aloha/settings/page.tsx`
- Missing imports (Brain, MessageSquare, Heart, Shield, Users, Clock from lucide-react)

### 7. Force a New Deployment
If Vercel hasn't automatically deployed:
- Go to Vercel dashboard
- Click "Redeploy" on the latest deployment
- Or create a new commit (even a small change) to trigger deployment

### 8. Check the Deployed Version
- View the page source on your deployed site
- Search for "Conversation Intelligence" in the HTML
- If it's not there, the deployment didn't include the changes

## Quick Test

Run this locally to verify the file has the changes:

```bash
grep -A 5 "Conversation Intelligence Section" app/aloha/settings/page.tsx
```

You should see the section definition.

## What Should Be Visible

When you go to `/aloha/settings`, after scrolling past "Voice Selection", you should see:

1. **Conversation Intelligence** section (purple theme, Brain icon)
2. **Natural Voice Dynamics** section (green theme, MessageSquare icon)
3. **Emotional Intelligence** section (red theme, Heart icon)
4. **Communication Resilience** section (orange theme, Shield icon)
5. **Contact Memory** section (blue theme, Users icon)
6. **End-of-Call Intelligence** section (indigo theme, Clock icon)

Each section should have:
- An icon in the top-left
- A title and description
- A green "Always Enabled" indicator
- Detailed feature lists

