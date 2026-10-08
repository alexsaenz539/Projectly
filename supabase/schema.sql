-- Initial schema for personal workspaces. Run once in a new Supabase project.
-- Directory roles are descriptive labels, not authorization roles.
begin;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 90),
  email text not null,
  role text not null default 'Miembro',
  created_at timestamptz not null default now(),
  unique (id,user_id)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null check (key ~ '^[A-Z0-9]{2,6}$'),
  name text not null check (length(trim(name)) between 1 and 90),
  description text not null default '',
  owner uuid,
  status text not null default 'Activo' check (status in ('Activo','Archivado')),
  created_at timestamptz not null default now(),
  unique (id,user_id), unique (user_id,key),
  foreign key (owner,user_id) references public.members(id,user_id)
);
create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 90),
  goal text not null default '',
  start date not null, "end" date not null,
  status text not null default 'Planificado' check (status in ('Planificado','Activo','Cerrado')),
  created_at timestamptz not null default now(),
  check ("end" >= start),
  unique (id,project_id,user_id),
  foreign key (project_id,user_id) references public.projects(id,user_id)
);
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  key text not null,
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null default '',
  type text not null default 'Tarea' check (type in ('Tarea','Bug','Mejora')),
  status text not null default 'Pendiente' check (status in ('Pendiente','En progreso','En revisión','Bloqueado','Completado')),
  priority text not null default 'Media' check (priority in ('Urgente','Alta','Media','Baja')),
  assignee uuid, due date, sprint_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id,key),
  foreign key (project_id,user_id) references public.projects(id,user_id),
  foreign key (assignee,user_id) references public.members(id,user_id),
  foreign key (sprint_id,project_id,user_id) references public.sprints(id,project_id,user_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index members_user_idx on public.members(user_id);
create index projects_owner_idx on public.projects(owner,user_id);
create index sprints_project_idx on public.sprints(project_id,user_id);
create index sprints_user_idx on public.sprints(user_id);
create index tickets_project_idx on public.tickets(project_id,user_id);
create index tickets_assignee_idx on public.tickets(assignee,user_id);
create index tickets_sprint_idx on public.tickets(sprint_id,project_id,user_id);
create index notifications_user_idx on public.notifications(user_id,created_at desc);

-- No anon access. Both row visibility and ownership of new data are checked.
do $$
declare table_name text;
begin
  foreach table_name in array array['members','projects','sprints','tickets','notifications'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on table public.%I from anon',table_name);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',table_name);
    execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',table_name);
  end loop;
end $$;

-- Runs with the caller's rights; inserts remain subject to notifications RLS.
create function public.log_ticket_activity() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.notifications(user_id,title,body)
  values (new.user_id,case when tg_op='INSERT' then 'Ticket creado' else 'Ticket actualizado' end,
    new.key || ' · ' || new.title || ' · ' || new.status);
  return new;
end $$;
revoke all on function public.log_ticket_activity() from public;
grant execute on function public.log_ticket_activity() to authenticated;
create trigger ticket_activity after insert or update on public.tickets
for each row execute function public.log_ticket_activity();

-- Realtime publication. Does not modify the protected realtime schema.
do $$
declare table_name text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach table_name in array array['members','projects','sprints','tickets','notifications'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
        execute format('alter publication supabase_realtime add table public.%I',table_name);
      end if;
    end loop;
  end if;
end $$;
commit;
