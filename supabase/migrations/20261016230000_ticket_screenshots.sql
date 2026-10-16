-- Private screenshots. Apply after the workspace migrations via the SQL Editor.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ticket-screenshots','ticket-screenshots',false,5242880,array['image/png','image/jpeg','image/webp']);

-- Path: auth.uid()/workspace_id/ticket_id/random-uuid_filename.ext.
-- Owned objects remain deletable after their parent is removed so the app can
-- clean up bytes through the Storage API, never by directly deleting SQL rows.
create policy ticket_screenshots_read on storage.objects for select to authenticated
using (bucket_id='ticket-screenshots' and split_part(name,'/',1)=(select auth.uid())::text);

create policy ticket_screenshots_insert on storage.objects for insert to authenticated
with check (
  bucket_id='ticket-screenshots'
  and split_part(name,'/',1)=(select auth.uid())::text
  and array_length(string_to_array(name,'/'),1)=4
  and exists (
    select 1 from public.tickets t
    where t.id=split_part(name,'/',3)::uuid
      and t.workspace_id=split_part(name,'/',2)::uuid
      and t.user_id=(select auth.uid())
  )
);

create policy ticket_screenshots_delete on storage.objects for delete to authenticated
using (bucket_id='ticket-screenshots' and split_part(name,'/',1)=(select auth.uid())::text);
commit;
