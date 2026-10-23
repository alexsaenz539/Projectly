-- Aplicar después de ticket_target_version y ticket_topics. No ejecuta borrados.
begin;
create table public.ticket_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  kind text not null check (kind in ('topic','version')),
  name text not null check (name = trim(name) and length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  foreign key (workspace_id,user_id) references public.workspaces(id,user_id) on delete cascade,
  unique (workspace_id,user_id,kind,name),
  check (kind <> 'version' or name ~ '^[A-Za-z0-9][A-Za-z0-9.+_-]{0,39}$'),
  check (kind <> 'topic' or position(',' in name) = 0)
);
create index ticket_catalog_workspace_idx on public.ticket_catalog(workspace_id,user_id,created_at);
alter table public.ticket_catalog enable row level security;
-- Entries are append-only: renaming/removing a label must not break existing tickets.
revoke all on public.ticket_catalog from anon, authenticated;
grant select,insert on public.ticket_catalog to authenticated;
create policy own_ticket_catalog_read on public.ticket_catalog for select to authenticated
using (user_id = (select auth.uid()));
create policy own_ticket_catalog_insert on public.ticket_catalog for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.workspaces w where w.id = workspace_id and w.user_id = (select auth.uid())
));

-- Retain existing labels and versions without modifying tickets or firing activity notifications.
insert into public.ticket_catalog(user_id,workspace_id,kind,name)
select distinct user_id,workspace_id,'version',target_version from public.tickets where target_version is not null;
insert into public.ticket_catalog(user_id,workspace_id,kind,name)
select distinct user_id,workspace_id,'topic',unnest(topics) from public.tickets;

create function public.validate_ticket_catalog() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.target_version is not null and not exists (
    select 1 from public.ticket_catalog c where c.user_id = new.user_id
      and c.workspace_id = new.workspace_id and c.kind = 'version' and c.name = new.target_version
  ) then
    raise exception 'Selecciona una versión del catálogo del espacio.' using errcode = '23503';
  end if;
  if exists (
    select 1 from unnest(new.topics) topic where not exists (
      select 1 from public.ticket_catalog c where c.user_id = new.user_id
        and c.workspace_id = new.workspace_id and c.kind = 'topic' and c.name = topic
    )
  ) then
    raise exception 'Selecciona las temáticas del catálogo del espacio.' using errcode = '23503';
  end if;
  return new;
end $$;
create trigger ticket_catalog_check before insert or update on public.tickets
for each row execute function public.validate_ticket_catalog();
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.ticket_catalog;
  end if;
end $$;
commit;
