create or replace function public.uon_admin_course_health(p_password text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_active integer;
  v_linked integer;
  v_inactive integer;
  v_quarantined integer;
  v_unlinked jsonb;
  v_quarantine jsonb;
begin
  if not public.uon_admin_authorized(p_password) then
    raise exception 'Unauthorized';
  end if;

  select count(*) into v_active from public.courses where active is true;
  select count(*) into v_inactive from public.courses where active is false;
  select count(distinct c.code) into v_linked
  from public.courses c
  join public.course_programs cp on cp.course_code=c.code
  where c.active is true;
  select count(*) into v_quarantined from public.course_import_quarantine;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.code),'[]'::jsonb) into v_unlinked
  from (
    select c.id,c.code,c.name_ar,c.name_en,c.college_ar,c.department_ar,c.credit_hours,c.active
    from public.courses c
    where c.active is true
      and not exists(select 1 from public.course_programs cp where cp.course_code=c.code)
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.course_code),'[]'::jsonb) into v_quarantine
  from (
    select q.source_course_id,q.course_code,q.reason,q.quarantined_at,
           q.snapshot->>'name_ar' as name_ar,
           q.snapshot->>'name_en' as name_en,
           q.snapshot->>'college_ar' as college_ar,
           q.snapshot->>'department_ar' as department_ar
    from public.course_import_quarantine q
  ) x;

  return jsonb_build_object(
    'active',v_active,
    'linked',v_linked,
    'unlinked',greatest(v_active-v_linked,0),
    'inactive',v_inactive,
    'quarantined',v_quarantined,
    'unlinked_rows',v_unlinked,
    'quarantine_rows',v_quarantine
  );
end;
$function$;

revoke all on function public.uon_admin_course_health(text) from public;
grant execute on function public.uon_admin_course_health(text) to anon, authenticated;
