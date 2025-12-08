-- Per-user OpenAI API keys
-- This table lets different users bring their own OpenAI keys.

create table if not exists public.user_openai_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'openai' check (provider = 'openai'),
  api_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists user_openai_keys_user_id_idx
  on public.user_openai_keys (user_id)
  where is_active = true;

create or replace function public.update_user_openai_keys_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_user_openai_keys_updated_at
  on public.user_openai_keys;

create trigger trigger_update_user_openai_keys_updated_at
  before update on public.user_openai_keys
  for each row
  execute function public.update_user_openai_keys_updated_at();

-- Enable row level security
alter table public.user_openai_keys enable row level security;

-- Users can manage only their own keys
create policy "Users can view their own OpenAI keys"
  on public.user_openai_keys
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own OpenAI keys"
  on public.user_openai_keys
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own OpenAI keys"
  on public.user_openai_keys
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own OpenAI keys"
  on public.user_openai_keys
  for delete
  using (auth.uid() = user_id);














