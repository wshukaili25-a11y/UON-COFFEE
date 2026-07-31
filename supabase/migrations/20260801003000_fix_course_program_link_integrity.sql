do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.course_programs'::regclass
      and conname='course_programs_course_program_key'
  ) then
    alter table public.course_programs
      add constraint course_programs_course_program_key unique(course_code,program_id);
  end if;
end $$;

create or replace function public.sync_course_program_links_from_department()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_college_id uuid;
  v_department_id uuid;
begin
  select c.id into v_college_id
  from public.academic_colleges c
  where c.active is true
    and (c.name_ar=new.college_ar or c.name_ar=new.college or c.name_en=new.college_en)
  limit 1;

  select d.id into v_department_id
  from public.academic_departments d
  where d.active is true
    and (v_college_id is null or d.college_id=v_college_id)
    and (d.name_ar=new.department_ar or d.name_ar=new.department or d.name_en=new.department_en)
  limit 1;

  if tg_op='UPDATE' and old.code is distinct from new.code then
    update public.course_programs
       set course_code=new.code
     where course_code=old.code;
  end if;

  if v_department_id is not null
     and not exists (
       select 1 from public.course_programs cp where cp.course_code=new.code
     ) then
    insert into public.course_programs(course_code,program_id,requirement_type)
    select new.code,p.id,coalesce(nullif(new.requirement_type,''),'major')
    from public.academic_programs p
    where p.active is true and p.department_id=v_department_id
    on conflict (course_code,program_id) do update
      set requirement_type=excluded.requirement_type;
  end if;

  return new;
end;
$function$;