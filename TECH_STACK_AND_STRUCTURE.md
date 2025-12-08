# OVRSEE Tech Stack & Repository Structure

## Confirmed Tech Stack

### Frontend
- **Framework**: Next.js 15.1.3 (App Router)
- **React**: 18.2.0
- **TypeScript**: 5.0.4
- **Styling**: Tailwind CSS 3.4.13
- **Icons**: Lucide React
- **Animations**: Framer Motion

### Backend
- **API**: Next.js API Routes (App Router)
- **Database**: Supabase (PostgreSQL)
- **ORM/Client**: Supabase JS Client (@supabase/supabase-js, @supabase/ssr)
- **Authentication**: Supabase Auth

### External Services
- **Telephony**: Twilio
- **AI**: OpenAI API
- **Email/Calendar**: Google OAuth (Gmail API, Calendar API)
- **Payments**: Stripe
- **Storage**: Supabase Storage (for recordings/assets)

### Development Tools
- **Validation**: Zod
- **Package Manager**: npm
- **Linting**: ESLint with Next.js config

### Deployment
- **Platform**: Vercel (recommended) or Render/Fly.io
- **Database Host**: Supabase Cloud
- **CI/CD**: GitHub Actions (to be configured)

## Repository Structure

```
COMMANDX/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── aloha/           # Aloha agent endpoints
│   │   ├── sync/            # Sync agent endpoints
│   │   ├── insight/         # Insights endpoints
│   │   ├── studio/          # Studio endpoints
│   │   ├── auth/            # Authentication endpoints
│   │   ├── health/          # Health check
│   │   └── ...
│   ├── aloha/               # Aloha pages
│   ├── sync/                # Sync pages
│   ├── insight/             # Insights pages
│   ├── studio/              # Studio pages
│   ├── settings/            # Settings pages
│   └── ...
├── components/              # React components
│   ├── ui/                  # UI primitives
│   ├── modals/             # Modal components
│   └── app/                # App-specific components
├── lib/                     # Utility libraries
│   ├── api/                # API utilities (errors, logging, rate limiting)
│   ├── config/             # Configuration (env, agents, etc.)
│   ├── aloha/              # Aloha-specific logic
│   ├── gmail/              # Gmail integration
│   ├── calendar/           # Calendar integration
│   ├── insight/             # Insights logic
│   └── ...
├── hooks/                   # Custom React hooks
├── context/                 # React context providers
├── types/                   # TypeScript type definitions
├── supabase/                # Database migrations
│   └── migrations/         # SQL migration files
├── public/                  # Static assets
└── scripts/                 # Utility scripts
```

## Database Schema Overview

### Core Tables
- `profiles` - User profiles (linked to auth.users)
- `workspaces` - Organizations/workspaces (multi-tenant)
- `workspace_members` - Workspace membership and roles
- `subscriptions` - Subscription management

### Aloha (Telephony)
- `user_phone_numbers` - Twilio phone numbers
- `call_logs` - Call history and metadata
- `voicemail_messages` - Voicemail recordings and transcriptions

### Sync (Email/Calendar)
- `gmail_connections` - Gmail OAuth tokens
- `calendar_connections` - Calendar OAuth tokens
- `sync_jobs` - Sync job tracking
- `sync_events` - Synced calendar events

### Insights
- `metrics_cache` - Aggregated metrics
- `insight_dashboards` - Dashboard configurations
- `insight_queries` - Saved queries

### Studio
- `assets` - Generated content assets
- `asset_versions` - Asset versioning
- `prompt_presets` - Saved prompt templates

### Agents
- `agents` - Agent configurations
- `agent_conversations` - Conversation threads
- `agent_messages` - Messages in conversations

## Environment Configuration

All environment variables are validated through `lib/config/env.ts` using Zod.

See `ENV_EXAMPLE.md` for complete list of required variables.

## API Structure

### Authentication
- Uses Supabase Auth with JWT tokens
- Bearer token in Authorization header
- Middleware: `lib/api/middleware.ts`

### Error Handling
- Standardized error responses via `lib/api/errors.ts`
- All routes wrapped with `withErrorHandler`

### Logging
- Structured logging via `lib/api/logger.ts`
- Request/response logging middleware

### Rate Limiting
- In-memory rate limiter (production: use Redis)
- Configurable presets per endpoint type

### Health Check
- `GET /api/health` - System health status

## Deployment

### Recommended: Vercel
- Automatic deployments from main branch
- Environment variables via Vercel dashboard
- Edge functions for API routes

### Database: Supabase Cloud
- Managed PostgreSQL
- Automatic backups
- Row Level Security (RLS) enabled

## Next Steps

1. ✅ Environment configuration
2. ✅ Centralized config loader
3. ✅ Global backend infrastructure
4. ⏳ Complete database schema migrations
5. ⏳ Implement missing API endpoints
6. ⏳ Complete frontend pages
7. ⏳ Add testing
8. ⏳ Configure CI/CD




