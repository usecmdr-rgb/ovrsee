-- Use pgcrypto's gen_random_uuid() for UUID generation, which is available
-- on Supabase. We avoid uuid_generate_v4() because it may not be exposed.
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














