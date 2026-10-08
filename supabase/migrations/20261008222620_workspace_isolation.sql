-- Apply after schema.sql. Existing personal data stays together in "Mi espacio personal".
-- Workspaces are private to their owner; directory member roles do not grant access.
begin;
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 3 and 64),
  slug text not null check (length(slug) between 3 and 32 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug <> 'demo'),
  description text not null default '' check (length(description) <= 240),
  created_at timestamptz not null default now(),
  unique (id,user_id), unique (user_id,slug)
);
alter table public.workspaces enable row level security;
revoke all on public.workspaces from anon;
grant select,insert,update on public.workspaces to authenticated;
create policy own_workspaces on public.workspaces for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create index workspaces_user_created_idx on public.workspaces(user_id,created_at);

-- Only accounts with existing data receive a migrated space. New accounts create their first space in the app.
insert into public.workspaces(user_id,name,slug)
select user_id,'Mi espacio personal','mi-espacio-personal' from (
  select user_id from public.members union select user_id from public.projects union
  select user_id from public.sprints union select user_id from public.tickets union select user_id from public.notifications
) existing_users;

-- Disable the old activity trigger while assigning workspace IDs to historical tickets.
alter table public.tickets disable trigger ticket_activity;
do $$
declare table_name text;
begin
  foreach table_name in array array['members','projects','sprints','tickets','notifications'] loop
    execute format('alter table public.%I add column workspace_id uuid',table_name);
    execute format('update public.%I item set workspace_id=space.id from public.workspaces space where item.user_id=space.user_id',table_name);
    execute format('alter table public.%I alter column workspace_id set not null',table_name);
    execute format('alter table public.%I add constraint %I foreign key (workspace_id,user_id) references public.workspaces(id,user_id)',table_name,table_name || '_workspace_owner_fkey');
    execute format('create index %I on public.%I (workspace_id,user_id,created_at)',table_name || '_workspace_idx',table_name);
  end loop;
end $$;

alter table public.members add unique (id,user_id,workspace_id);
alter table public.projects add unique (id,user_id,workspace_id);
alter table public.sprints add unique (id,project_id,user_id,workspace_id);
alter table public.projects drop constraint projects_user_id_key_key;
alter table public.tickets drop constraint tickets_user_id_key_key;
alter table public.projects add unique (workspace_id,key);
alter table public.tickets add unique (workspace_id,key);

alter table public.projects drop constraint projects_owner_user_id_fkey;
alter table public.sprints drop constraint sprints_project_id_user_id_fkey;
alter table public.tickets drop constraint tickets_project_id_user_id_fkey;
alter table public.tickets drop constraint tickets_assignee_user_id_fkey;
alter table public.tickets drop constraint tickets_sprint_id_project_id_user_id_fkey;

alter table public.projects add foreign key (owner,user_id,workspace_id) references public.members(id,user_id,workspace_id);
alter table public.sprints add foreign key (project_id,user_id,workspace_id) references public.projects(id,user_id,workspace_id);
alter table public.tickets add foreign key (project_id,user_id,workspace_id) references public.projects(id,user_id,workspace_id);
alter table public.tickets add foreign key (assignee,user_id,workspace_id) references public.members(id,user_id,workspace_id);
alter table public.tickets add foreign key (sprint_id,project_id,user_id,workspace_id) references public.sprints(id,project_id,user_id,workspace_id);

create or replace function public.log_ticket_activity() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.notifications(user_id,workspace_id,title,body)
  values (new.user_id,new.workspace_id,case when tg_op='INSERT' then 'Ticket creado' else 'Ticket actualizado' end,
    new.key || ' · ' || new.title || ' · ' || new.status);
  return new;
end $$;
alter table public.tickets enable trigger ticket_activity;
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.workspaces;
  end if;
end $$;
commit;

