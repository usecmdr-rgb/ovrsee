# Vercel Deployment Guide

This guide explains how to deploy OVRSEE to Vercel.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. Git repository with your code
3. All environment variables configured

## Deployment Steps

### 1. Connect Your Repository

1. Go to https://vercel.com/new
2. Import your Git repository (GitHub, GitLab, or Bitbucket)
3. Select your repository

### 2. Configure Project Settings

Vercel will auto-detect Next.js and configure:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (or `next build`)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install`

### 3. Environment Variables

Add the following environment variables in Vercel dashboard:

#### Required Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase Service Role (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Application
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# OAuth (if using Gmail integration)
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
```

#### How to Add Environment Variables

1. In Vercel dashboard, go to your project
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable for:
   - **Production**
   - **Preview** (optional, same as production)
   - **Development** (optional)

### 4. Deploy

After configuring:
1. Click **Deploy**
2. Vercel will automatically:
   - Install dependencies
   - Build your Next.js app
   - Deploy to production

### 5. Post-Deployment

#### Update OAuth Redirect URIs

After deployment, update your OAuth redirect URIs:

1. **Gmail OAuth** (Google Cloud Console):
   - Add: `https://your-domain.vercel.app/api/gmail/callback`

2. **Stripe Webhooks**:
   - Add webhook endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
   - Copy the webhook secret to `STRIPE_WEBHOOK_SECRET` in Vercel

3. **Supabase**:
   - Update allowed redirect URLs in Supabase dashboard
   - Add: `https://your-domain.vercel.app/**`

#### Update NEXT_PUBLIC_APP_URL

1. In Vercel dashboard → **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_APP_URL` to your production URL
3. Redeploy if needed

## Configuration Files

### vercel.json

The project includes a `vercel.json` configuration file:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

### .vercelignore

The `.vercelignore` file excludes unnecessary files from deployment:
- Development files
- Documentation (except README)
- Local environment files

## Build Settings

Vercel automatically detects Next.js and uses:
- **Node.js Version**: 20.x (configured in `package.json` engines or Vercel settings)
- **Build Command**: `next build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

## Custom Domain

To add a custom domain:

1. Go to **Settings** → **Domains**
2. Add your domain
3. Follow DNS configuration instructions
4. Update `NEXT_PUBLIC_APP_URL` environment variable
5. Update OAuth redirect URIs

## Database Migrations

Run Supabase migrations before or after deployment:

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase dashboard
# Navigate to SQL Editor and run migration files
```

Migration files are located in `supabase/migrations/`.

## Troubleshooting

### Build Fails

1. Check build logs in Vercel dashboard
2. Verify all environment variables are set
3. Check Node.js version compatibility
4. Review error messages in build output

### Runtime Errors

1. Check function logs in Vercel dashboard
2. Verify environment variables are correctly set
3. Check API routes are accessible
4. Review browser console for client-side errors

### Environment Variables Not Working

1. Ensure variables are set for the correct environment (Production/Preview/Development)
2. Redeploy after adding new variables
3. Check variable names match exactly (case-sensitive)
4. Verify no typos in variable values

### API Routes Not Working

1. Check function logs in Vercel dashboard
2. Verify authentication is working
3. Check CORS settings if needed
4. Verify database connections

## Continuous Deployment

Vercel automatically deploys:
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

## Monitoring

- **Logs**: View in Vercel dashboard → **Functions** tab
- **Analytics**: Available in Vercel dashboard (if enabled)
- **Performance**: Check **Speed Insights** in dashboard

## Quick Deploy Command

Using Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

## Support

For issues:
1. Check Vercel documentation: https://vercel.com/docs
2. Check Next.js documentation: https://nextjs.org/docs
3. Review build logs and function logs in Vercel dashboard

