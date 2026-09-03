create or replace function public.uon_public_submission_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  duplicate_exists boolean := false;
  fingerprint text := '';
begin
  if tg_table_name='confessions' then
    fingerprint := lower(trim(coalesce(new.content,new.text,'')));
    if length(fingerprint)<5 then raise exception 'المحتوى قصير جدًا'; end if;
    select exists(select 1 from public.confessions where created_at>now()-interval '2 minutes' and lower(trim(coalesce(content,text,'')))=fingerprint) into duplicate_exists;
  elsif tg_table_name='feature_suggestions' then
    fingerprint := lower(trim(coalesce(new.title,'')||'|'||coalesce(new.details,'')));
    if length(trim(coalesce(new.title,'')))<3 or length(trim(coalesce(new.details,'')))<5 then raise exception 'الاقتراح غير مكتمل'; end if;
    select exists(select 1 from public.feature_suggestions where created_at>now()-interval '3 minutes' and lower(trim(coalesce(title,'')||'|'||coalesce(details,'')))=fingerprint) into duplicate_exists;
  elsif tg_table_name='platform_feedback' then
    fingerprint := lower(trim(coalesce(new.page_path,'')||'|'||coalesce(new.rating::text,'')||'|'||coalesce(new.comment,'')));
    select exists(select 1 from public.platform_feedback where created_at>now()-interval '2 minutes' and lower(trim(coalesce(page_path,'')||'|'||coalesce(rating::text,'')||'|'||coalesce(comment,'')))=fingerprint) into duplicate_exists;
  elsif tg_table_name='broken_link_reports' then
    new.status := 'pending';
    new.reviewed_at := null;
    if char_length(trim(coalesce(new.source_table,''))) not between 1 and 80 then raise exception 'مصدر البلاغ غير صالح'; end if;
    if char_length(trim(coalesce(new.source_id,''))) not between 1 and 160 then raise exception 'معرف المصدر غير صالح'; end if;
    if char_length(coalesce(new.source_title,''))>240 or char_length(coalesce(new.source_url,''))>1500 then raise exception 'بيانات البلاغ طويلة جدًا'; end if;
    if char_length(trim(coalesce(new.reason,''))) not between 1 and 500 then raise exception 'سبب البلاغ غير صالح'; end if;
    fingerprint := lower(trim(coalesce(new.source_table,'')||'|'||coalesce(new.source_id,'')));
    if not public.uon_public_rate_allow('broken_link_insert',fingerprint,8,3600) then raise exception 'rate_limited'; end if;
    select exists(
      select 1 from public.broken_link_reports
      where created_at>now()-interval '24 hours'
        and status='pending'
        and lower(trim(coalesce(source_table,'')||'|'||coalesce(source_id,'')))=fingerprint
    ) into duplicate_exists;
  elsif tg_table_name='rating_submissions' then
    fingerprint := lower(trim(coalesce(new.target_name,'')||'|'||coalesce(new.course_code,'')||'|'||coalesce(new.comment,'')));
    select exists(select 1 from public.rating_submissions where created_at>now()-interval '3 minutes' and lower(trim(coalesce(target_name,'')||'|'||coalesce(course_code,'')||'|'||coalesce(comment,'')))=fingerprint) into duplicate_exists;
  end if;
  if duplicate_exists then raise exception 'already_reported'; end if;
  return new;
end;
$$;

revoke all on table public.broken_link_reports from anon,authenticated;
grant insert(id,source_table,source_id,source_title,source_url,reason,status) on public.broken_link_reports to anon,authenticated;

drop policy if exists public_insert_pending_broken_link_reports on public.broken_link_reports;
create policy public_insert_pending_broken_link_reports
on public.broken_link_reports
for insert to anon,authenticated
with check (
 status='pending'
 and reviewed_at is null
 and char_length(trim(coalesce(source_table,''))) between 1 and 80
 and char_length(trim(coalesce(source_id,''))) between 1 and 160
 and char_length(coalesce(source_title,''))<=240
 and char_length(coalesce(source_url,''))<=1500
 and char_length(trim(coalesce(reason,''))) between 1 and 500
);
