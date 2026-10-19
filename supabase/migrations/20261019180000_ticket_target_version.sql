-- Aplicar manualmente antes de guardar versiones de entrega desde la aplicación.
begin;
alter table public.tickets add column target_version text;
alter table public.tickets add constraint tickets_target_version_format
  check (target_version is null or target_version ~ '^[A-Za-z0-9][A-Za-z0-9.+_-]{0,39}$');
comment on column public.tickets.target_version is 'Versión del producto en la que se entregará el ticket; null si no está definida.';
commit;
