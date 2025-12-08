# Troubleshooting Supabase Connection Error

## Error: "Load failed (api.supabase.com)"

This error typically occurs when:

### 1. **Supabase Project is Paused** (Most Common)
Free tier Supabase projects automatically pause after 7 days of inactivity.

**Solution:**
- Go to [Supabase Dashboard](https://app.supabase.com)
- Find your project
- Click "Restore" or "Resume" to unpause it
- Wait a few minutes for the project to fully restart

### 2. **Incorrect Supabase URL**
The URL should be in the format: `https://[project-ref].supabase.co`

**Check your `.env.local`:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
```

**Common mistakes:**
- Using `api.supabase.com` (generic domain - incorrect)
- Using `https://supabase.com` (wrong format)
- Missing `https://` prefix
- Typo in project reference ID

### 3. **Missing or Incorrect API Keys**
Ensure you have both keys set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Where to find these:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

### 4. **Network/Firewall Issues**
- Check if you can access `https://app.supabase.com` in your browser
- Try accessing your project URL directly: `https://[project-ref].supabase.co`
- Check if corporate firewall is blocking Supabase

### 5. **Project Deleted or Suspended**
- Check Supabase dashboard to ensure project still exists
- Verify billing status if on paid plan
- Check email for any suspension notices

## Quick Fix Steps

1. **Verify Project Status:**
   ```bash
   # Check if project is accessible
   curl https://[your-project-ref].supabase.co/rest/v1/
   ```

2. **Check Environment Variables:**
   ```bash
   # In your project root
   cat .env.local | grep SUPABASE
   ```

3. **Restart Development Server:**
   ```bash
   # After updating .env.local
   npm run dev
   # or
   yarn dev
   ```

4. **Verify Supabase Client Initialization:**
   - Check browser console for specific error messages
   - Check server logs for connection errors

## Testing Connection

You can test your Supabase connection with:

```typescript
// Test script
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test connection
supabase.from('profiles').select('count').limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error('Connection failed:', error);
    } else {
      console.log('✓ Connection successful!');
    }
  });
```

## Still Having Issues?

1. **Check Supabase Status:** https://status.supabase.com
2. **Review Supabase Logs:** Dashboard → Logs → API Logs
3. **Verify RLS Policies:** Ensure tables have proper RLS policies
4. **Check Migration Status:** Ensure all migrations have been applied


