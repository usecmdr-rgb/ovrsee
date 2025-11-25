# Security Hardening Guide

This document outlines the security measures implemented in CommanderX and configuration guidance for Cloudflare.

## Current Security Implementation

### 1. Authentication & Authorization

- **Supabase Auth**: User authentication is handled by Supabase Auth
- **Row Level Security (RLS)**: All user data tables have RLS policies enabled
- **API Route Authentication**: All protected API routes verify user authentication server-side
- **Session Management**: HTTP-only cookies with secure, same-site attributes

### 2. Data Storage

- **Database**: Supabase Postgres with RLS policies
- **Data Model**:
  - `auth.users` - Supabase auth table (managed by Supabase)
  - `profiles` - User profiles, linked 1:1 with `auth.users`
  - `subscriptions` - Normalized subscription data, linked to `auth.users`
  - `agents`, `agent_conversations`, `agent_messages` - AI agent data, all with RLS

### 3. Stripe Integration (PCI-Compliant)

- **Card Data**: Never touches our servers - handled directly by Stripe
- **Stripe Checkout**: All payment flows use Stripe Checkout for PCI compliance
- **Webhooks**: Verified with Stripe signature validation
- **Data Storage**: Only non-sensitive subscription metadata stored (customer ID, subscription ID, tier, status)

### 4. Environment Variables

All secrets stored in environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only, never exposed)
- `STRIPE_SECRET_KEY` - Stripe secret key (server-only)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret (server-only)
- `STRIPE_PRICE_ID_BASIC`, `STRIPE_PRICE_ID_ADVANCED`, `STRIPE_PRICE_ID_ELITE` - Stripe price IDs
- `NEXT_PUBLIC_APP_URL` - App URL for redirects

## Cloudflare Configuration

### Required Settings in Cloudflare Dashboard

#### 1. SSL/TLS Settings
- **Encryption mode**: Full (strict)
- **Always Use HTTPS**: ON
- **Minimum TLS Version**: 1.2
- **Opportunistic Encryption**: ON
- **TLS 1.3**: ON

#### 2. Security Headers
Configure Page Rules or Workers to add:
- **Strict-Transport-Security (HSTS)**: `max-age=31536000; includeSubDomains; preload`
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `DENY` (or `SAMEORIGIN` if you need iframes)
- **X-XSS-Protection**: `1; mode=block`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: Configure based on your needs

#### 3. Content Security Policy (CSP)
Create a CSP header with:
```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://hooks.stripe.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: blob:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://api.stripe.com https://hooks.stripe.com;
frame-src 'self' https://js.stripe.com https://hooks.stripe.com;
object-src 'none';
base-uri 'self';
form-action 'self' https://checkout.stripe.com;
frame-ancestors 'none';
upgrade-insecure-requests;
```

**Note**: Adjust `unsafe-eval` and `unsafe-inline` based on your Next.js build needs. Consider using nonces for inline scripts.

#### 4. WAF (Web Application Firewall)
- **OWASP Core Ruleset**: ENABLED
- **OWASP CRS Paranoia Level**: 1-2 (start with 1, increase if needed)
- **Rate Limiting**: Configure rules for:
  - API endpoints: `/api/*` - Max 100 requests per minute per IP
  - Auth endpoints: `/api/*/auth`, `/api/*/callback` - Max 10 requests per minute per IP
  - Stripe webhook: `/api/stripe/webhook` - Allowlist Stripe IPs only

#### 5. Bot Management (Optional, Recommended)
- Enable Cloudflare Bot Management for additional protection

#### 6. Rate Limiting Rules
Create custom rate limiting rules:

**Rule 1: General API Rate Limit**
- URL Pattern: `*/api/*`
- Match: All requests
- Action: Challenge/Block after 100 requests per minute per IP

**Rule 2: Auth Endpoints**
- URL Pattern: `*/api/*/auth` OR `*/api/*/callback`
- Match: All requests
- Action: Challenge/Block after 10 requests per minute per IP

**Rule 3: Stripe Webhook Protection**
- URL Pattern: `*/api/stripe/webhook`
- Match: All requests
- Action: Allowlist only Stripe webhook IPs (see Stripe docs for current IP ranges)

#### 7. Firewall Rules for Stripe Webhooks

**Allow Stripe Webhooks Only**:
```
(http.request.uri.path eq "/api/stripe/webhook")
AND
(cf.client.bot eq false)
AND
(ip.geoip.asnum in {15169, 394695, 55343})  # Stripe ASNs - verify current ones
```

**Block Non-Stripe to Webhook**:
```
(http.request.uri.path eq "/api/stripe/webhook")
AND
(not (http.request.headers["stripe-signature"][*] contains "t="))
```

### URLs that Need Special Handling

1. **Stripe Checkout Redirects**: 
   - `/pricing?success=true` - Allow normal access
   - `/pricing?canceled=true` - Allow normal access

2. **Stripe Billing Portal Redirects**:
   - `/pricing` - Allow normal access

3. **OAuth Callbacks**:
   - `/api/gmail/callback`
   - `/api/calendar/callback`
   - These should have rate limiting but not be blocked by WAF OWASP rules

4. **Stripe Webhook**:
   - `/api/stripe/webhook`
   - Should ONLY accept requests from Stripe IPs with valid signatures
   - Bypass rate limiting for legitimate Stripe requests

### Recommended Cloudflare Page Rules

1. **Strip Query String for Static Assets** (Performance)
2. **Cache Everything for `/api/ping`** (if safe to cache)
3. **Disable Security for Stripe Webhook** (Let our app handle verification) - OR use specific firewall rules

## Security Best Practices

### Server-Side
- ✅ All API routes verify authentication before processing
- ✅ Input validation using Zod schemas
- ✅ No raw SQL queries - using Supabase client
- ✅ Error messages don't leak sensitive information
- ✅ Secrets in environment variables only
- ✅ Stripe webhooks verified with signature validation

### Client-Side
- ✅ No secrets in client-side code
- ✅ Content Security Policy headers
- ✅ XSS protection via React's built-in escaping
- ✅ User-generated content sanitized before rendering

### Database
- ✅ Row Level Security (RLS) on all user tables
- ✅ Foreign key constraints with CASCADE delete
- ✅ Indexes on frequently queried columns
- ✅ No user can access other users' data

## Monitoring & Alerts

### Recommended Cloudflare Alerts
1. **DDoS Attack Detected**
2. **High Rate of 4xx/5xx Errors**
3. **Unusual Traffic Patterns**
4. **WAF Rule Triggers** (High volume)

### Recommended Application Alerts
1. **Failed Authentication Attempts** (multiple failures from same IP)
2. **Stripe Webhook Failures** (signature verification failures)
3. **Database Query Failures** (RLS policy violations)
4. **Rate Limit Exceeded** (API routes)

## Incident Response

1. **Security Breach**: Immediately rotate all secrets (Supabase keys, Stripe keys)
2. **DDoS Attack**: Enable Cloudflare "I'm Under Attack" mode
3. **Data Breach**: Notify affected users, audit logs, investigate root cause
4. **Stripe Webhook Compromise**: Disable webhook endpoint, investigate, rotate webhook secret

## Compliance Notes

- **PCI DSS**: Using Stripe Checkout means card data never touches our servers (PCI SAQ A)
- **GDPR**: User data stored in Supabase (EU region recommended), RLS ensures data isolation
- **SOC 2**: Application follows security best practices, but SOC 2 certification requires external audit

## Regular Security Tasks

1. **Monthly**: Review Cloudflare WAF logs
2. **Quarterly**: Rotate API keys and secrets
3. **Quarterly**: Review and update RLS policies
4. **Quarterly**: Audit environment variables for leaked secrets
5. **Annually**: Security penetration testing

