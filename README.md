# OVRSEE

AI agents for modern business. Delegate calls, inbox, content, and insights to OVRSEE. Four focused AI agents handle communications, media polish, and reporting so you can stay on high-value work.

## Agents

- **OVRSEE Aloha**: Voice and call assistant. Answers calls, books appointments, and keeps calendars tidy.
- **OVRSEE Sync**: Email and calendar agent. Drafts replies, prioritizes inboxes, and syncs schedules.
- **OVRSEE Studio**: Media and branding agent. Edits images and videos, and provides social media performance insights.
- **OVRSEE Insight**: Business intelligence agent. Rolls up every signal into clean, actionable insight.

## Tech Stack

- **Framework**: Next.js 14.1.0
- **React**: 18.2.0
- **TypeScript**: 5.0.4
- **Database**: Supabase
- **AI**: OpenAI API
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key
- Google Cloud Console credentials (for Gmail/Calendar OAuth)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/usecmdr-rgb/ovrsee-site.git
cd ovrsee-site
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REDIRECT_URI`
- `NEXT_PUBLIC_APP_URL`

4. Run database migrations:
```bash
# Apply Supabase migrations
# See supabase/migrations/ for migration files
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3001`

## Project Structure

```
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── aloha/          # Aloha agent pages
│   ├── sync/           # Sync agent pages
│   ├── studio/         # Studio agent pages
│   └── insight/        # Insight agent pages
├── components/         # React components
├── lib/                # Utility libraries
├── hooks/              # Custom React hooks
├── context/            # React context providers
├── types/              # TypeScript type definitions
└── supabase/           # Database migrations
```

## Supabase CLI & Migrations (Project-wide)

This project uses the Supabase CLI **once for the entire app**, not per agent.  
All agents (Aloha, Sync, Studio, Insight) share a single Supabase project and a
single migration history under `supabase/`.

### Authentication & Keys

**Important:** The Supabase CLI uses different authentication than your application code:

- **CLI Authentication:** The CLI uses the Supabase access token from `supabase login` for authentication. This token is stored locally after you run `supabase login`.

- **CLI Database Operations:** When applying migrations, the CLI uses the `service_role_key` (not the `anon_key`) for privileged database operations. The `service_role_key` bypasses Row Level Security (RLS) and is required for schema changes.

- **Application Keys:**
  - `anon_key` (NEXT_PUBLIC_SUPABASE_ANON_KEY): Used by frontend clients and respects RLS policies
  - `service_role_key` (SUPABASE_SERVICE_ROLE_KEY): Used by backend code for admin operations and is never exposed to clients

**Note:** The `[api]` block in `config.toml` may contain both keys, but only the `service_role_key` is relevant for CLI migrations. The CLI does not rely on `anon_key`.

### Setup

1. Install the Supabase CLI:
   - `npm install -g supabase` **or**
   - `brew install supabase/tap/supabase`

2. Login (authenticates CLI with your Supabase account):
   ```bash
   supabase login
   ```
   This stores an access token locally for CLI authentication.

3. Link this repo to your Supabase project:
   ```bash
   supabase link --project-ref YOUR_SUPABASE_PROJECT_ID
   ```
   The project ref can be found in the Supabase dashboard. The default in
   `supabase/config.toml` is `nupxbdbychuqokubresi` and can be updated if needed.

### Migrations

- Generate a new migration from remote DB changes:
  ```bash
  supabase db diff --schema public --file supabase/migrations/<timestamp>_diff.sql
  ```

- Apply local migrations to the linked database:
  ```bash
  supabase db push
  ```
  This uses the `service_role_key` to apply migrations with the necessary privileges.

All shared tables (for example `profiles`, `user_phone_numbers`, call logs, etc.)
should be managed via these project-wide migrations.

### Idempotent Migrations

Our baseline migrations are idempotent (using `CREATE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, etc.) to prevent errors when re-running them. However, **idempotent migrations only prevent errors—they do not update existing objects if their structure has changed**.

For structural changes to existing tables, columns, or policies, you must create new migrations using explicit `ALTER TABLE`, `DROP`, and `CREATE` statements. Idempotent patterns are best suited for initial setup and preventing duplicate creation errors.

## Available Scripts

- `npm run dev` - Start development server on port 3001
- `npm run dev:3000` - Start development server on port 3000
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Environment Variables

See `.env.local.example` for all required environment variables.

## Contributing

1. Create a feature branch
2. Make your changes
3. Commit and push to your branch
4. Open a pull request

## License

Private - All rights reserved

## About OVRSEE

OVRSEE is an AI-powered platform that helps small and medium businesses delegate routine operations to specialized AI agents. Our four agents—Aloha, Sync, Studio, and Insight—handle communications, media enhancement, and business intelligence so you can focus on high-value work.

