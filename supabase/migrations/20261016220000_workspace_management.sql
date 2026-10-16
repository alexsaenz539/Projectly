-- Apply after 20261008222620_workspace_isolation.sql.
-- Owner-only RLS already covers UPDATE and DELETE. Delete all workspace data in
-- one database statement so a failed operation cannot leave a partly empty space.
begin;

grant delete on public.workspaces to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['members','projects','sprints','tickets','notifications'] loop
    execute format('alter table public.%I drop constraint %I', table_name, table_name || '_workspace_owner_fkey');
    execute format(
      'alter table public.%I add constraint %I foreign key (workspace_id,user_id) references public.workspaces(id,user_id) on delete cascade',
      table_name, table_name || '_workspace_owner_fkey'
    );
  end loop;
end $$;

commit;
