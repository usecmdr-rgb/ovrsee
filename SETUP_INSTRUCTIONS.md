# Multi-Seat Activation Setup Instructions

## ✅ What's Been Done

1. ✅ Email infrastructure created (`lib/email.ts`)
2. ✅ Database migration created (`supabase/migrations/20250120000000_workspace_seat_invites.sql`)
3. ✅ API routes created:
   - `POST /api/workspaces/[workspaceId]/invite`
   - `POST /api/workspaces/accept-invite`
4. ✅ Activation page created (`app/activate-seat/page.tsx`)
5. ✅ Environment variables added to `.env.local` (MS365 SMTP config)

## 🔧 What You Need to Do

### Step 1: Configure Microsoft 365 SMTP Password

1. Open `.env.local` in your project root
2. Find the line: `MS365_SMTP_PASS=YOUR_APP_PASSWORD_HERE`
3. Replace `YOUR_APP_PASSWORD_HERE` with your Microsoft 365 app password
   - To create an app password:
     - Go to https://account.microsoft.com/security
     - Enable 2FA if not already enabled
     - Go to "App passwords" section
     - Generate a new app password for "Mail"
     - Copy the password and paste it in `.env.local`

### Step 2: Apply Database Migration

You have two options:

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file: `supabase/migrations/20250120000000_workspace_seat_invites.sql`
4. Copy all the SQL content
5. Paste it into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)

#### Option B: Using Supabase CLI (if installed)

```bash
# If you have Supabase CLI installed
supabase db push

# Or run the migration script directly
./scripts/apply-migration.sh
```

#### Option C: Using psql (if you have direct database access)

```bash
psql -h <your-supabase-host> -U postgres -d postgres \
  -f supabase/migrations/20250120000000_workspace_seat_invites.sql
```

### Step 3: Verify Migration

After running the migration, verify it worked:

1. Go to Supabase Dashboard → **Table Editor**
2. You should see a new table: `workspace_seat_invites`
3. Check that it has these columns:
   - `id`, `workspace_id`, `invited_email`, `plan_code`, `tier`
   - `invite_token`, `status`, `invited_by`, `created_at`, `expires_at`, `accepted_at`

### Step 4: Test the Flow

1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Create an invitation:**
   - Sign in as a workspace owner
   - Make a POST request to `/api/workspaces/[workspaceId]/invite`:
     ```bash
     curl -X POST http://localhost:3000/api/workspaces/YOUR_WORKSPACE_ID/invite \
       -H "Content-Type: application/json" \
       -H "Cookie: your-auth-cookie" \
       -d '{"email": "test@example.com", "planCode": "essentials"}'
     ```

3. **Check email:**
   - The invitee should receive an email from `support@ovrsee.ai`
   - Email contains an activation link

4. **Activate seat:**
   - Click the activation link
   - Sign in/sign up with the invited email
   - Should see success message and redirect to dashboard

## 📋 Environment Variables Checklist

Make sure these are set in `.env.local`:

```bash
# Microsoft 365 SMTP (for activation emails)
MS365_SMTP_HOST=smtp.office365.com
MS365_SMTP_PORT=587
MS365_SMTP_USER=nematollah@ovrsee.onmicrosoft.com
MS365_SMTP_PASS=<your-app-password>  # ⚠️ UPDATE THIS!

# App URL (for activation links)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or https://ovrsee.ai for production
```

## 🐛 Troubleshooting

### Email not sending?
- Check that `MS365_SMTP_PASS` is set correctly (app password, not regular password)
- Verify Microsoft 365 account has 2FA enabled
- Check server logs for email errors

### Migration fails?
- Make sure you're running it as a database admin/service role
- Check that `workspaces` table exists (it should from previous migrations)
- Verify no syntax errors in the SQL

### Activation link not working?
- Check that `NEXT_PUBLIC_APP_URL` matches your actual app URL
- Verify the token is being passed correctly in the URL
- Check browser console for errors

## 📚 Documentation

See `MULTI_SEAT_ACTIVATION_IMPLEMENTATION.md` for:
- Complete API documentation
- Security features
- Manual test plan
- Future enhancements


