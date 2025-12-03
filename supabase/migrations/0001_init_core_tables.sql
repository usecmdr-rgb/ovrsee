-- 0001_init_core_tables.sql
--
-- Baseline migration for core tables used across agents (project-level).
-- This file is written to be idempotent using CREATE TABLE IF NOT EXISTS so
-- it can be safely applied even if some tables already exist in the remote DB.
--
-- If your production database already has these tables with slightly different
-- definitions, you can either:
--   - Treat this file as documentation only, and rely on future
--     `supabase db diff` migrations, OR
--   - Generate a migration from the existing schema with:
--       supabase db diff --schema public --file supabase/migrations/<timestamp>_from_prod.sql
--     and then reconcile the differences.

-- User phone numbers (single active number per user)

create table if not exists public.user_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  phone_number text not null,
  twilio_phone_sid text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_phone_numbers_user_id
  on public.user_phone_numbers (user_id);

create index if not exists idx_user_phone_numbers_is_active
  on public.user_phone_numbers (is_active);

-- Number change logs (for 1-change-per-month rule)

create table if not exists public.user_phone_number_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  old_phone_number text,
  new_phone_number text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_user_phone_number_changes_user_id_changed_at
  on public.user_phone_number_changes (user_id, changed_at);

-- Business / agent profile (for Aloha name, business name, voice, etc.)

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  business_name text,
  assistant_name text,
  voice_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_profiles_user_id
  on public.business_profiles (user_id);

-- Optional: Call logs for Aloha (AI receptionist)

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  twilio_call_sid text not null,
  from_number text,
  to_number text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  summary text,
  transcript text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_call_logs_user_id_started_at
  on public.call_logs (user_id, started_at);

-- 0001_init_core_tables.sql
--
-- Baseline migration for core tables used across agents (project-level).
-- This file is **idempotent**: it uses CREATE TABLE IF NOT EXISTS / CREATE
-- INDEX IF NOT EXISTS so it is safe to run even if the tables already exist.
--
-- If your remote Supabase project already has a more complete schema, you can:
-- - Treat this file as documentation of the expected core tables, and/or
-- - Run `supabase db diff --schema public --file supabase/migrations/<timestamp>_diff.sql`
--   to generate a migration from the live database and reconcile differences.

-- User phone numbers (single active number per user)

create table if not exists public.user_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  phone_number text not null,
  twilio_phone_sid text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_phone_numbers_user_id
  on public.user_phone_numbers (user_id);

create index if not exists idx_user_phone_numbers_is_active
  on public.user_phone_numbers (is_active);


-- Number change logs (for 1-change-per-month rule)

create table if not exists public.user_phone_number_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  old_phone_number text,
  new_phone_number text,
  changed_at timestamptz not null default now()
);

create index if not exists idx_user_phone_number_changes_user_id_changed_at
  on public.user_phone_number_changes (user_id, changed_at);


-- Business / agent profile (for Aloha name, business name, voice, etc.)

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  business_name text,
  assistant_name text,
  voice_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_profiles_user_id
  on public.business_profiles (user_id);


-- Optional: Call logs for Aloha (AI receptionist)

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  twilio_call_sid text not null,
  from_number text,
  to_number text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  summary text,
  transcript text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_call_logs_user_id_started_at
  on public.call_logs (user_id, started_at);


