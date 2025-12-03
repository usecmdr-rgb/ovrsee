-- 20241212000000_insight_memory_and_personalization.sql

-- 1. Insight memory facts
create table if not exists public.insight_memory_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type text not null check (type in (
    'preference',
    'pattern',
    'behavior',
    'risk',
    'tag',
    'goal'
  )),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  confidence real not null default 0.5,        -- 0..1
  importance_score integer not null default 50, -- 0..100
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insight_memory_facts_workspace_type_key_idx
  on public.insight_memory_facts (workspace_id, type, key);

create index if not exists insight_memory_facts_workspace_idx
  on public.insight_memory_facts (workspace_id);

-- 2. User goals tracked by Insight
create table if not exists public.insight_user_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal_label text not null,
  description text,
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insight_user_goals_workspace_idx
  on public.insight_user_goals (workspace_id);

-- 3. Important relationships (contacts, companies, projects, etc.)
create table if not exists public.insight_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('contact', 'company', 'project')),
  entity_identifier text not null,  -- e.g. email, domain, project slug
  display_name text,
  interaction_count integer not null default 0,
  sentiment_score real,            -- -1..1 if you track this
  last_contact_at timestamptz,
  importance_score integer not null default 50, -- 0..100
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insight_relationships_workspace_entity_unique
    unique (workspace_id, entity_type, entity_identifier)
);

create index if not exists insight_relationships_workspace_idx
  on public.insight_relationships (workspace_id);

-- 4. RLS

alter table public.insight_memory_facts enable row level security;
alter table public.insight_user_goals enable row level security;
alter table public.insight_relationships enable row level security;

-- NOTE: adjust column names if workspaces / workspace_seats differ.
-- Assumes:
--   workspaces(id, owner_user_id)
--   workspace_seats(workspace_id, user_id, status)

create policy "workspace_members_can_select_insight_memory"
on public.insight_memory_facts
for select
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_memory_facts.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);

create policy "workspace_members_can_modify_insight_memory"
on public.insight_memory_facts
for all
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_memory_facts.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_memory_facts.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);

create policy "workspace_members_can_select_goals"
on public.insight_user_goals
for select
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_user_goals.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);

create policy "workspace_members_can_modify_goals"
on public.insight_user_goals
for all
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_user_goals.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_user_goals.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);

create policy "workspace_members_can_select_relationships"
on public.insight_relationships
for select
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_relationships.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);

create policy "workspace_members_can_modify_relationships"
on public.insight_relationships
for all
using (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_relationships.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.workspaces w
    left join public.workspace_seats s
      on s.workspace_id = w.id
     and s.status = 'active'
    where w.id = insight_relationships.workspace_id
      and (
        w.owner_user_id = auth.uid()
        or s.user_id = auth.uid()
      )
  )
);



