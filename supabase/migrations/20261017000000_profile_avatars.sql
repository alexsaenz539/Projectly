-- Fotos de perfil privadas. Ejecutar manualmente en Supabase antes de subir fotos.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 524288, array['image/png','image/jpeg','image/webp']);

create policy profile_avatars_read on storage.objects for select to authenticated
using (bucket_id = 'profile-avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy profile_avatars_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and array_length(string_to_array(name, '/'), 1) = 2
  and split_part(name, '/', 2) ~ '^[a-zA-Z0-9-]+\.(webp|png|jpg)$'
);

create policy profile_avatars_delete on storage.objects for delete to authenticated
using (bucket_id = 'profile-avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
commit;
