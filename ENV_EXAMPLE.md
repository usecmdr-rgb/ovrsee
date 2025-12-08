# Environment Variables Configuration

Copy the contents below to `.env.local` and fill in your actual values.

```bash
# ============================================================================
# OVRSEE Environment Variables
# ============================================================================
# Copy this file to .env.local and fill in your actual values
# Never commit .env.local to version control

# ============================================================================
# Database (Supabase)
# ============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# ============================================================================
# Authentication & Security
# ============================================================================
# NextAuth secret (generate with: openssl rand -base64 32)
AUTH_SECRET=your_auth_secret_here
# JWT secret (if using custom JWT, generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here

# ============================================================================
# Application URLs
# ============================================================================
# Base URL for the application (used for OAuth redirects, webhooks, etc.)
# Development: http://localhost:3000
# Production: https://ovrsee.ai
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# ============================================================================
# Telephony Provider (Twilio)
# ============================================================================
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_API_KEY=your_twilio_api_key
TWILIO_API_SECRET=your_twilio_api_secret
# Optional: Twilio Auth Token (alternative to API Key/Secret)
TWILIO_AUTH_TOKEN=your_twilio_auth_token

# ============================================================================
# Google OAuth (Gmail & Calendar)
# ============================================================================
# Gmail OAuth credentials (from Google Cloud Console)
# See: https://console.cloud.google.com/apis/credentials
GMAIL_CLIENT_ID=your_gmail_client_id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your_gmail_client_secret
# Optional: Explicit redirect URI (if not set, uses NEXT_PUBLIC_APP_URL + /api/gmail/callback)
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# Google Calendar OAuth credentials (can be same as Gmail or separate)
GOOGLE_CALENDAR_CLIENT_ID=your_calendar_client_id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your_calendar_client_secret
# Optional: Explicit redirect URI for Calendar
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/calendar/callback

# ============================================================================
# AI Services
# ============================================================================
# OpenAI API key for AI features (Aloha, Studio, Insights)
OPENAI_API_KEY=sk-your_openai_api_key_here

# ============================================================================
# Storage & Media
# ============================================================================
# Supabase Storage bucket keys (if using Supabase Storage for recordings/assets)
# These are typically the same as your Supabase keys above
# For other storage providers (S3, etc.), add here:
# AWS_ACCESS_KEY_ID=your_aws_access_key
# AWS_SECRET_ACCESS_KEY=your_aws_secret_key
# AWS_S3_BUCKET_NAME=your_bucket_name
# AWS_REGION=us-east-1

# ============================================================================
# Payment & Billing (Stripe)
# ============================================================================
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
# Stripe webhook secret (get from Stripe Dashboard → Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Price IDs for subscription tiers (individual plans)
# Essentials: $39.99/month or $439/year (11 months = 1 month free)
STRIPE_PRICE_ID_ESSENTIALS_MONTHLY=price_your_essentials_monthly_price_id
STRIPE_PRICE_ID_ESSENTIALS_YEARLY=price_your_essentials_yearly_price_id

# Professional: $79.99/month or $879/year (11 months = 1 month free)
STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY=price_your_professional_monthly_price_id
STRIPE_PRICE_ID_PROFESSIONAL_YEARLY=price_your_professional_yearly_price_id

# Executive: $129.99/month or $1,429/year (11 months = 1 month free)
STRIPE_PRICE_ID_EXECUTIVE_MONTHLY=price_your_executive_monthly_price_id
STRIPE_PRICE_ID_EXECUTIVE_YEARLY=price_your_executive_yearly_price_id

# Legacy tier names (for backward compatibility, optional)
# STRIPE_PRICE_ID_BASIC=price_your_basic_tier_price_id
# STRIPE_PRICE_ID_ADVANCED=price_your_advanced_tier_price_id
# STRIPE_PRICE_ID_ELITE=price_your_elite_tier_price_id

# Add-ons (optional)
# STRIPE_PRICE_ID_ALOHA_ADDON=price_your_aloha_addon_price_id
# STRIPE_PRICE_ID_STUDIO_ADDON=price_your_studio_addon_price_id

# ============================================================================
# Social Media OAuth (Facebook / Instagram / TikTok)
# ============================================================================
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret

# ============================================================================
# Analytics & Monitoring (Optional)
# ============================================================================
# PostHog (product analytics)
# NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
# NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Sentry (error tracking)
# SENTRY_DSN=your_sentry_dsn
# SENTRY_AUTH_TOKEN=your_sentry_auth_token
# NEXT_PUBLIC_SENTRY_DSN=your_public_sentry_dsn

# Logtail (logging aggregation)
# LOGTAIL_SOURCE_TOKEN=your_logtail_token

# ============================================================================
# Feature Flags & Environment
# ============================================================================
# Node environment (development, production, test)
NODE_ENV=development

# Enable/disable features
# NEXT_PUBLIC_ENABLE_ANALYTICS=true
# NEXT_PUBLIC_ENABLE_ERROR_TRACKING=true

# ============================================================================
# Development & Testing
# ============================================================================
# Enable demo/mock mode for testing without real integrations
# DEMO_MODE=false

# Test user credentials (for development only)
# TEST_USER_EMAIL=test@example.com
# TEST_USER_PASSWORD=test_password
```



