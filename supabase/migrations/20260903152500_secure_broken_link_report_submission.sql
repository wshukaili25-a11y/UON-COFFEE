create or replace function public.uon_submit_broken_link_report(
  p_source_table text,
  p_source_id text,
  p_source_title text,
  p_source_url text,
  p_reason text,
  p_session_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_table text := left(btrim(coalesce(p_source_table,'')),80);
  v_source_id text := left(btrim(coalesce(p_source_id,'')),160);
  v_title text := left(btrim(coalesce(p_source_title,'')),240);
  v_url text := left(btrim(coalesce(p_source_url,'')),1500);
  v_reason text := left(btrim(coalesce(p_reason,'')),500);
  v_target text;
begin
  if p_session_id is null then raise exception 'تعذر التحقق من الجلسة'; end if;
  if char_length(v_table) < 1 or char_length(v_source_id) < 1 then raise exception 'مصدر البلاغ غير صالح'; end if;
  if char_length(v_reason) < 1 then raise exception 'اكتب سبب البلاغ'; end if;
  if v_url <> '' and v_url !~* '^(https?://|/|[a-z0-9_-]+\.html(?:[?#].*)?)' then raise exception 'الرابط غير صالح'; end if;

  v_target := encode(extensions.digest(convert_to(lower(v_table||':'||v_source_id),'UTF8'),'sha256'),'hex');
  if not public.uon_public_rate_allow('broken_link_session',p_session_id::text,8,3600) then raise exception 'rate_limited'; end if;
  if not public.uon_public_rate_allow('broken_link_target',v_target,3,86400) then raise exception 'rate_limited'; end if;

  if exists (
    select 1 from public.broken_link_reports
    where source_table=v_table and source_id=v_source_id and status='pending'
      and created_at > now()-interval '24 hours'
  ) then
    raise exception 'already_reported';
  end if;

  insert into public.broken_link_reports(source_table,source_id,source_title,source_url,reason,status,created_at,reviewed_at)
  values(v_table,v_source_id,nullif(v_title,''),nullif(v_url,''),v_reason,'pending',now(),null)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.uon_submit_broken_link_report(text,text,text,text,text,uuid) from public;
grant execute on function public.uon_submit_broken_link_report(text,text,text,text,text,uuid) to anon, authenticated, service_role;

revoke all on table public.broken_link_reports from anon, authenticated;
drop policy if exists public_insert_pending_broken_link_reports on public.broken_link_reports;
