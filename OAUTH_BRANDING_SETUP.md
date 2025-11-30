# OAuth Branding Setup - Change from Supabase to OVRSEE

This guide explains how to change the Google OAuth sign-in screen to show "OVRSEE" instead of the Supabase domain.

## The Problem

When users sign in with Google, they see:
- "You're signing back in to **nupxbdbychuqokubresi.supabase.co**"

This happens because Supabase Auth handles the OAuth redirect through their domain.

## Solutions

### Solution 1: Update Google Cloud Console OAuth Consent Screen (Immediate Fix)

This will change the **application name** that appears in the OAuth flow:

#### Step-by-Step Instructions:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Make sure you're signed in with the correct Google account

2. **Select Your Project**
   - Click the project dropdown at the top
   - Select the project that contains your OAuth credentials

3. **Navigate to OAuth Consent Screen**
   - In the left sidebar, click **"APIs & Services"**
   - Click **"OAuth consent screen"** (it's in the left menu under APIs & Services)

4. **Update the Branding Section** (you should see this page now)

   **a. App name** (already set to "OVRSEE" ✅)
   - This should already say "OVRSEE" - if not, type "OVRSEE" in this field

   **b. User support email** (already set ✅)
   - This should already have your email - leave it as is

   **c. Application home page** ⚠️ **UPDATE THIS**
   - Find the field labeled **"Application home page"**
   - Enter: `https://ovrsee.dev` (or `https://ovrsee.ai` if that's your domain)
   - This field is currently empty and needs to be filled

   **d. Application privacy policy link** ⚠️ **UPDATE THIS**
   - Find the field labeled **"Application privacy policy link"**
   - Currently shows: `https://ovrsee.ai/privacy`
   - Change it to: `https://ovrsee.dev/privacy` (or keep `.ai` if that's your domain)
   - Make sure the URL matches where your privacy page actually lives

   **e. Application terms of service link** ⚠️ **UPDATE THIS**
   - Find the field labeled **"Application terms of service link"**
   - Currently shows: `https://ovrsee.ai/terms`
   - Change it to: `https://ovrsee.dev/terms` (or keep `.ai` if that's your domain)
   - Make sure the URL matches where your terms page actually lives

   **f. App logo** (optional)
   - Click **"Browse"** button next to "Logo file to upload"
   - Upload your OVRSEE logo (must be square, 120x120px, JPG/PNG/BMP, max 1MB)
   - This is optional but recommended for better branding

5. **Save Your Changes**
   - Scroll to the bottom of the page
   - Click the **"SAVE AND CONTINUE"** button (blue button at the bottom)
   - If you see any warnings, read them but you can usually continue

6. **If Your App is in Testing Mode:**
   - On the next screen (Scopes), click **"SAVE AND CONTINUE"**
   - On the "Test users" screen, make sure your email is added
   - Click **"SAVE AND CONTINUE"** again

7. **Review Summary**
   - Review the summary page
   - Click **"BACK TO DASHBOARD"** when done

**Important Notes:**
- The domain will still show the Supabase domain (`nupxbdbychuqokubresi.supabase.co`) in the redirect message until you set up a custom domain (Solution 2)
- The app name "OVRSEE" will now appear in the OAuth consent screen
- Make sure the privacy and terms URLs you enter actually work (test them in a browser)

### Solution 2: Set Up Custom Domain in Supabase (Best Long-term Solution)

This will change the **actual domain** shown in the OAuth redirect:

1. **Prerequisites**: 
   - Supabase Pro plan or higher (custom domains are a paid feature)
   - A domain you own (e.g., `ovrsee.dev`)

2. **In Supabase Dashboard**:
   - Go to **Settings** → **Custom Domains**
   - Add your custom domain (e.g., `auth.ovrsee.dev`)
   - Follow the DNS configuration instructions
   - Wait for DNS verification (can take up to 48 hours)

3. **Update Google Cloud Console**:
   - Go to **APIs & Services** → **Credentials**
   - Find your OAuth 2.0 Client ID
   - Update the **Authorized redirect URIs**:
     - Remove: `https://nupxbdbychuqokubresi.supabase.co/auth/v1/callback`
     - Add: `https://auth.ovrsee.dev/auth/v1/callback` (or your custom domain)

4. **Update Supabase Settings**:
   - Go to **Authentication** → **URL Configuration**
   - Update **Site URL** to your custom domain
   - Update **Redirect URLs** to include your app URLs

5. **Update Environment Variables** (if needed):
   - Your `NEXT_PUBLIC_SUPABASE_URL` might need to be updated if Supabase provides a new URL for the custom domain

**Result**: Users will see "You're signing back in to **auth.ovrsee.dev**" instead of the Supabase domain.

### Solution 3: Custom OAuth Implementation (Advanced)

If you want complete control, you can implement Google OAuth directly without Supabase Auth:

1. Use Google OAuth library directly
2. Handle the OAuth flow in your own API routes
3. Create Supabase users manually after OAuth success
4. Manage sessions yourself

This requires significant code changes and is not recommended unless you have specific requirements.

## Recommended Approach

1. **Immediate**: Update Google Cloud Console OAuth consent screen (Solution 1) - takes 5 minutes
2. **Long-term**: Set up custom domain in Supabase (Solution 2) - requires paid plan but provides best branding

## Verification

After making changes:

1. Clear your browser cookies for Google
2. Try signing in with Google again
3. You should see "OVRSEE" in the OAuth consent screen
4. If you set up a custom domain, the redirect message should show your domain instead of Supabase

## Current Configuration

- **Supabase Project**: `nupxbdbychuqokubresi.supabase.co`
- **OAuth Redirect URI**: `https://nupxbdbychuqokubresi.supabase.co/auth/v1/callback`
- **App Name in Code**: OVRSEE (see `app/layout.tsx`)
- **Privacy Policy URL**: `https://ovrsee.dev/privacy` ✅ (Page created)
- **Terms of Service URL**: `https://ovrsee.dev/terms` ✅ (Page created)

## Additional Resources

- [Supabase Custom Domains Documentation](https://supabase.com/docs/guides/platform/custom-domains)
- [Google OAuth Consent Screen Setup](https://support.google.com/cloud/answer/10311615)
- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth)

