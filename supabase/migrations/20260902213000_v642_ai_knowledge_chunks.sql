-- UON Hub V64.2 — derived chunks for long trusted University knowledge records.
-- Parent records remain as provenance rows but are hidden from public retrieval when chunked.

create or replace function public.uon_ai_refresh_knowledge_chunks_v642(p_parent_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  p public.uon_ai_knowledge%rowtype;
  v_length integer;
  v_position integer := 1;
  v_index integer := 0;
  v_step constant integer := 1300;
  v_size constant integer := 1500;
  v_total integer := 0;
  v_chunk text;
  v_external_id text;
begin
  select * into p
  from public.uon_ai_knowledge
  where id = p_parent_id
  for update;

  if not found
     or p.source_provider is distinct from 'university_page'
     or coalesce((p.metadata ->> 'derived_chunk')::boolean, false) then
    return 0;
  end if;

  delete from public.uon_ai_knowledge
  where source_provider = 'university_page'
    and coalesce((metadata ->> 'derived_chunk')::boolean, false)
    and metadata ->> 'parent_id' = p.id::text;

  v_length := length(coalesce(p.content, ''));

  -- Small records remain directly searchable and need no derived children.
  if v_length <= 1600 then
    return 0;
  end if;

  v_total := least(20, ceil(v_length::numeric / v_step)::integer);

  while v_position <= v_length and v_index < 20 loop
    v_index := v_index + 1;
    v_chunk := btrim(substring(p.content from v_position for v_size));

    if length(v_chunk) >= 80 then
      v_external_id := p.source_external_id || '#chunk:' || lpad(v_index::text, 2, '0');

      insert into public.uon_ai_knowledge (
        title,
        content,
        category,
        source_url,
        source_title,
        official,
        active,
        tags,
        source_provider,
        source_external_id,
        source_type,
        fetched_at,
        source_updated_at,
        expires_at,
        content_hash,
        confidence,
        verification_status,
        metadata,
        last_verified_at,
        updated_at,
        created_at
      ) values (
        p.title || ' · جزء ' || v_index || '/' || v_total,
        v_chunk,
        p.category,
        p.source_url,
        p.source_title,
        p.official,
        p.active,
        array(select distinct x from unnest(coalesce(p.tags, '{}'::text[]) || array['derived_chunk','v64.2']) as x where x <> ''),
        p.source_provider,
        v_external_id,
        p.source_type,
        p.fetched_at,
        p.source_updated_at,
        p.expires_at,
        md5(coalesce(p.content_hash, '') || ':' || v_index::text || ':' || v_chunk),
        p.confidence,
        p.verification_status,
        coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object(
          'derived_chunk', true,
          'chunk_version', '64.2',
          'parent_id', p.id::text,
          'parent_external_id', p.source_external_id,
          'chunk_index', v_index,
          'chunk_count', v_total,
          'chunk_start', v_position,
          'chunk_chars', length(v_chunk)
        ),
        p.last_verified_at,
        now(),
        now()
      )
      on conflict (source_provider, source_external_id)
      where source_provider is not null and source_external_id is not null
      do update set
        title = excluded.title,
        content = excluded.content,
        category = excluded.category,
        source_url = excluded.source_url,
        source_title = excluded.source_title,
        official = excluded.official,
        active = excluded.active,
        tags = excluded.tags,
        source_type = excluded.source_type,
        fetched_at = excluded.fetched_at,
        source_updated_at = excluded.source_updated_at,
        expires_at = excluded.expires_at,
        content_hash = excluded.content_hash,
        confidence = excluded.confidence,
        verification_status = excluded.verification_status,
        metadata = excluded.metadata,
        last_verified_at = excluded.last_verified_at,
        updated_at = now();
    end if;

    v_position := v_position + v_step;
  end loop;

  -- Keep the parent as provenance, but remove the large body from active retrieval.
  update public.uon_ai_knowledge
  set active = false,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'chunked', true,
        'chunk_version', '64.2',
        'chunk_count', v_index
      ),
      updated_at = now()
  where id = p.id;

  return v_index;
end;
$$;

revoke all on function public.uon_ai_refresh_knowledge_chunks_v642(uuid) from public, anon, authenticated;
grant execute on function public.uon_ai_refresh_knowledge_chunks_v642(uuid) to service_role;

create or replace function public.uon_ai_chunk_knowledge_trigger_v642()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.source_provider = 'university_page'
     and not coalesce((new.metadata ->> 'derived_chunk')::boolean, false)
     and (
       tg_op = 'INSERT'
       or old.content_hash is distinct from new.content_hash
       or old.active is distinct from new.active
     ) then
    perform public.uon_ai_refresh_knowledge_chunks_v642(new.id);
  end if;

  return new;
end;
$$;

revoke all on function public.uon_ai_chunk_knowledge_trigger_v642() from public, anon, authenticated;
grant execute on function public.uon_ai_chunk_knowledge_trigger_v642() to service_role;

drop trigger if exists uon_ai_chunk_knowledge_v642 on public.uon_ai_knowledge;
create trigger uon_ai_chunk_knowledge_v642
after insert or update of content_hash, active on public.uon_ai_knowledge
for each row
execute function public.uon_ai_chunk_knowledge_trigger_v642();

create index if not exists uon_ai_knowledge_chunk_parent_idx
on public.uon_ai_knowledge ((metadata ->> 'parent_id'))
where source_provider = 'university_page'
  and coalesce((metadata ->> 'derived_chunk')::boolean, false);

-- Backfill currently stored official University pages. The function itself skips small records.
do $$
declare r record;
begin
  for r in
    select id
    from public.uon_ai_knowledge
    where source_provider = 'university_page'
      and not coalesce((metadata ->> 'derived_chunk')::boolean, false)
  loop
    perform public.uon_ai_refresh_knowledge_chunks_v642(r.id);
  end loop;
end;
$$;
