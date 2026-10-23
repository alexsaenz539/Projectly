-- Ejecutar manualmente en Supabase para habilitar el indicador de archivos.
begin;
-- Únicamente revela el total agregado del proyecto a sus usuarios autenticados.
-- No devuelve rutas, nombres, propietarios ni contenido; no altera las políticas
-- de acceso a archivos privados. No incluye otros proyectos de la organización.
create function public.project_storage_usage()
returns table (used_bytes numeric, complete boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Inicia sesión para consultar el almacenamiento.' using errcode = '42501';
  end if;
  return query
  select coalesce(sum(case when o.metadata->>'size' ~ '^[0-9]{1,18}$'
    then (o.metadata->>'size')::numeric else 0 end), 0),
    coalesce(bool_and(coalesce(o.metadata->>'size' ~ '^[0-9]{1,18}$', false)), true)
  from storage.objects o;
end $$;
revoke all on function public.project_storage_usage() from public, anon;
grant execute on function public.project_storage_usage() to authenticated;
commit;
