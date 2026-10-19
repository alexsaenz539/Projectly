-- Ejecutar después de las migraciones de espacios y profile_avatars.
-- Vincula responsables con cuentas confirmadas; solo comparte su imagen de perfil.
begin;

alter table public.members add column account_id uuid references auth.users(id) on delete set null;
create index members_account_id_idx on public.members(account_id);
create index members_normalized_email_idx on public.members(lower(trim(email)));

update public.members m set account_id = u.id from auth.users u
where lower(trim(m.email)) = lower(trim(u.email)) and u.email_confirmed_at is not null;

create function public.link_member_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.account_id := null;
  elsif new.email is not distinct from old.email and old.account_id is not null and new.account_id is not null then
    -- El cliente no puede elegir otra cuenta mediante account_id.
    new.account_id := old.account_id;
    return new;
  end if;
  select u.id into new.account_id from auth.users u
  where lower(trim(u.email)) = lower(trim(new.email)) and u.email_confirmed_at is not null;
  return new;
end $$;
revoke all on function public.link_member_account() from public, anon, authenticated;
create trigger member_account_link before insert or update on public.members
for each row execute function public.link_member_account();

-- Los contactos anteriores se vinculan cuando su cuenta confirma el correo.
create function public.link_confirmed_account_members() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null then
    -- Dispara la resolución del correo sin permitir account_id del cliente.
    update public.members set email = new.email
    where account_id is null and lower(trim(email)) = lower(trim(new.email));
  end if;
  return new;
end $$;
revoke all on function public.link_confirmed_account_members() from public, anon, authenticated;
create trigger confirmed_account_member_link after insert or update of email, email_confirmed_at on auth.users
for each row execute function public.link_confirmed_account_members();

create function public.validate_ticket_account_assignee() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.assignee is not distinct from old.assignee
      and new.workspace_id = old.workspace_id and new.user_id = old.user_id then return new; end if;
  end if;
  if new.assignee is not null and not exists (
    select 1 from public.members m join auth.users u on u.id = m.account_id
    where m.id = new.assignee and m.workspace_id = new.workspace_id and m.user_id = new.user_id
      and u.email_confirmed_at is not null
  ) then
    raise exception 'El responsable debe tener una cuenta registrada y un correo confirmado.' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.validate_ticket_account_assignee() from public, anon, authenticated;
create trigger ticket_account_assignee before insert or update on public.tickets
for each row execute function public.validate_ticket_account_assignee();

create function public.member_profile_images(p_workspace_id uuid)
returns table(member_id uuid, account_id uuid, avatar text, photo_path text)
language sql stable security definer set search_path = '' as $$
  select m.id, u.id,
    coalesce(u.raw_user_meta_data->>'profile_avatar', ''),
    case when u.raw_user_meta_data->>'profile_avatar' = 'custom'
      and u.raw_user_meta_data->>'profile_photo_path' ~ ('^' || u.id::text || '/[a-zA-Z0-9-]+\.(webp|png|jpg)$')
      then u.raw_user_meta_data->>'profile_photo_path' else '' end
  from public.members m join auth.users u on u.id = m.account_id
  join public.workspaces w on w.id = m.workspace_id and w.user_id = m.user_id
  where w.id = p_workspace_id and w.user_id = (select auth.uid()) and u.email_confirmed_at is not null
$$;
revoke all on function public.member_profile_images(uuid) from public, anon;
grant execute on function public.member_profile_images(uuid) to authenticated;

create function public.can_read_member_profile_photo(p_path text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m join auth.users u on u.id = m.account_id
    join public.workspaces w on w.id = m.workspace_id and w.user_id = m.user_id
    where w.user_id = (select auth.uid()) and u.email_confirmed_at is not null
      and u.raw_user_meta_data->>'profile_avatar' = 'custom'
      and u.raw_user_meta_data->>'profile_photo_path' = p_path
      and p_path ~ ('^' || u.id::text || '/[a-zA-Z0-9-]+\.(webp|png|jpg)$')
  )
$$;
revoke all on function public.can_read_member_profile_photo(text) from public, anon;
grant execute on function public.can_read_member_profile_photo(text) to authenticated;
create policy profile_avatars_member_read on storage.objects for select to authenticated
using (bucket_id = 'profile-avatars' and public.can_read_member_profile_photo(name));
commit;
