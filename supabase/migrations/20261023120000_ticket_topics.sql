-- Aplicar manualmente antes de guardar temáticas desde la aplicación.
begin;
create function public.valid_ticket_topics(topics text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(topics) <= 20
    and (cardinality(topics) = 0 or array_ndims(topics) = 1)
    and not exists (
      select 1 from unnest(topics) topic
      where topic is null or length(trim(topic)) not between 1 and 60
    )
    and cardinality(topics) = (select count(distinct lower(trim(topic))) from unnest(topics) topic);
$$;
alter table public.tickets add column topics text[] not null default '{}';
alter table public.tickets add constraint tickets_topics_valid check (public.valid_ticket_topics(topics));
comment on column public.tickets.topics is 'Temáticas del ticket, reutilizables dentro del espacio de trabajo.';
commit;
