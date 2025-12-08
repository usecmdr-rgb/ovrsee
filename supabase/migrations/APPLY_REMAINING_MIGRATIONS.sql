-- ============================================================================
-- REMAINING MIGRATIONS - Apply these in Supabase SQL Editor
-- ============================================================================
-- This script contains the most critical remaining migrations.
-- Copy and paste each section into the Supabase SQL Editor and run them.
-- If you see "already exists" notices, that's fine - those tables/indexes are already there.
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Agent Memory Tables (if not already applied)
-- ============================================================================
create extension if not exists "pgcrypto";

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists agent_conversations_user_agent_idx
  on public.agent_conversations (user_id, agent_id, created_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_conversation_idx
  on public.agent_messages (conversation_id, created_at desc);

-- ============================================================================
-- MIGRATION 2: User Phone Number Changes (if not already applied)
-- ============================================================================
-- Note: This table might already exist from the first migration.
-- If you see "already exists", skip this section.

CREATE TABLE IF NOT EXISTS user_phone_number_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_phone_number TEXT,
  new_phone_number TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_phone_number_changes_user_id_changed_at
  ON user_phone_number_changes (user_id, changed_at);




