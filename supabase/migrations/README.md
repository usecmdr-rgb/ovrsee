# Supabase Migrations

This folder stores SQL migrations for the **entire project** – all agents and modules:

- Aloha (voice agent)
- Sync (email/calendar)
- Insights
- Studio
- Any future agents that share the same Supabase project

Migrations here are **project-wide**, not per-agent. Shared tables like
`profiles`, `user_phone_numbers`, `user_phone_number_changes`, etc. all live
in this single migration history.

## CLI Authentication

**Important:** The Supabase CLI authentication works differently than application code:

- **CLI Authentication:** The CLI uses the Supabase access token from `supabase login` for authentication. This token is stored locally after authentication.

- **CLI Database Operations:** When applying migrations via `supabase db push`, the CLI uses the `service_role_key` (not the `anon_key`) for privileged database operations. The `service_role_key` bypasses Row Level Security (RLS) and is required for schema changes.

- **Application Keys:**
  - `anon_key` (NEXT_PUBLIC_SUPABASE_ANON_KEY): Used by frontend clients and respects RLS policies
  - `service_role_key` (SUPABASE_SERVICE_ROLE_KEY): Used by backend code for admin operations

The CLI does not rely on `anon_key` for migrations. The `[api]` block in `config.toml` may contain both keys, but only the `service_role_key` is relevant for CLI migrations.

## Usage

Run these commands in your terminal from the project root (not inside the app):

- `supabase login`  
  Authenticate the Supabase CLI with your account. This stores an access token locally.

- `supabase link --project-ref YOUR_SUPABASE_PROJECT_ID`  
  Link this repo to your Supabase project.  
  (You can find the project ref in the Supabase dashboard under Project Settings → General.)

- `supabase db diff --schema public --file supabase/migrations/<timestamp>_diff.sql`  
  Generate a migration file based on schema differences between your local
  migration history and the linked remote database.

- `supabase db push`  
  Apply local migrations in `supabase/migrations/` to the linked database.
  This uses the `service_role_key` to apply migrations with the necessary privileges.

### Notes

- These migrations are **project-level**. Do not create per-agent projects or
  per-agent migration trees.
- New features for Aloha, Sync, Insights, Studio, etc. should extend the
  shared schema here.
- If your remote database already has tables that are not represented in these
  baseline migrations, you can:
  - Treat the baseline as documentation only, and rely on future `db diff`s, or
  - Run `supabase db diff` to generate a migration from the current remote
    schema and then reconcile as needed.

## Idempotent Migrations

Our baseline migrations are idempotent (using `CREATE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, etc.) to prevent errors when re-running them. This is useful for:

- Initial setup without errors if objects already exist
- Preventing duplicate creation errors
- Safe re-execution of baseline migrations

**Important Limitation:** Idempotent migrations only prevent errors—they do **not** update existing objects if their structure has changed. For example:

- `CREATE TABLE IF NOT EXISTS` will not alter an existing table if you've added new columns to the migration
- `CREATE POLICY IF NOT EXISTS` will not update an existing policy if its definition has changed
- `CREATE INDEX IF NOT EXISTS` will not modify an existing index

**For structural changes**, you must create new migrations using explicit statements:
- `ALTER TABLE` for adding/modifying columns
- `DROP` followed by `CREATE` for replacing objects
- Explicit `ALTER POLICY` for updating policies

Idempotent patterns are best suited for initial setup and preventing duplicate creation errors, not for evolving existing schema.


