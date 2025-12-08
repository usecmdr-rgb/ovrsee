-- Core tables migration (idempotent - safe to run multiple times)
-- Copy everything below this line and paste into Supabase SQL Editor

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

-- Call logs for Aloha (AI receptionist)
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




