create or replace function public.admin_upsert_course_with_programs(
  p_course jsonb,
  p_program_ids uuid[] default '{}'::uuid[],
  p_requirement_type text default 'major'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_existing_id uuid;
  v_code text;
  v_name_ar text;
  v_name_en text;
  v_college_id uuid;
  v_department_id uuid;
  v_college public.academic_colleges%rowtype;
  v_department public.academic_departments%rowtype;
  v_requirement text;
  v_saved public.courses%rowtype;
  v_program_count integer := 0;
begin
  v_code := upper(regexp_replace(trim(coalesce(p_course->>'code','')), '\s+', '', 'g'));
  v_name_ar := trim(coalesce(p_course->>'name_ar',''));
  v_name_en := nullif(trim(coalesce(p_course->>'name_en','')), '');
  v_requirement := lower(trim(coalesce(nullif(p_requirement_type,''), 'major')));

  if v_code !~ '^[A-Z]{2,8}[0-9]{2,4}[A-Z]?$' then
    raise exception 'Invalid course code';
  end if;
  if length(v_name_ar) < 2 then
    raise exception 'Course Arabic name is required';
  end if;
  if v_requirement not in ('university','college','major','elective') then
    raise exception 'Invalid requirement type';
  end if;

  if nullif(p_course->>'id','') is not null then
    begin
      v_id := (p_course->>'id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid course id';
    end;
  end if;

  if nullif(p_course->>'college_id','') is not null then
    begin
      v_college_id := (p_course->>'college_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid college id';
    end;
    select * into v_college
      from public.academic_colleges
     where id=v_college_id and active is true;
    if v_college.id is null then raise exception 'College not found'; end if;
  end if;

  if nullif(p_course->>'department_id','') is not null then
    begin
      v_department_id := (p_course->>'department_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid department id';
    end;
    select * into v_department
      from public.academic_departments
     where id=v_department_id
       and active is true
       and (v_college_id is null or college_id=v_college_id);
    if v_department.id is null then raise exception 'Department not found'; end if;
  end if;

  if v_id is null then
    select id into v_existing_id from public.courses where code=v_code;
    if v_existing_id is not null then
      raise exception 'Course code already exists';
    end if;

    insert into public.courses(
      code,name_ar,name_en,college,department,credit_hours,level,description,
      learning_outcomes,active,status,college_ar,college_en,department_ar,
      department_en,requirement_type,source_url,updated_at
    ) values (
      v_code,
      v_name_ar,
      v_name_en,
      coalesce(v_college.name_ar,nullif(trim(coalesce(p_course->>'college','')),'')),
      coalesce(v_department.name_ar,nullif(trim(coalesce(p_course->>'department','')),'')),
      case when nullif(p_course->>'credit_hours','') is null then null else (p_course->>'credit_hours')::integer end,
      case when nullif(p_course->>'level','') is null then null else (p_course->>'level')::integer end,
      nullif(trim(coalesce(p_course->>'description','')),''),
      nullif(trim(coalesce(p_course->>'learning_outcomes','')),''),
      coalesce((p_course->>'active')::boolean,true),
      'approved',
      coalesce(v_college.name_ar,nullif(trim(coalesce(p_course->>'college_ar',p_course->>'college','')),'')),
      coalesce(v_college.name_en,nullif(trim(coalesce(p_course->>'college_en','')),'')),
      coalesce(v_department.name_ar,nullif(trim(coalesce(p_course->>'department_ar',p_course->>'department','')),'')),
      coalesce(v_department.name_en,nullif(trim(coalesce(p_course->>'department_en','')),'')),
      v_requirement,
      nullif(trim(coalesce(p_course->>'source_url','')),''),
      now()
    ) returning * into v_saved;
  else
    if not exists(select 1 from public.courses where id=v_id) then
      raise exception 'Course not found';
    end if;

    update public.courses set
      code=v_code,
      name_ar=v_name_ar,
      name_en=v_name_en,
      college=coalesce(v_college.name_ar,nullif(trim(coalesce(p_course->>'college','')),'')),
      department=coalesce(v_department.name_ar,nullif(trim(coalesce(p_course->>'department','')),'')),
      credit_hours=case when nullif(p_course->>'credit_hours','') is null then null else (p_course->>'credit_hours')::integer end,
      level=case when nullif(p_course->>'level','') is null then null else (p_course->>'level')::integer end,
      description=nullif(trim(coalesce(p_course->>'description','')),''),
      learning_outcomes=nullif(trim(coalesce(p_course->>'learning_outcomes','')),''),
      active=coalesce((p_course->>'active')::boolean,true),
      status='approved',
      college_ar=coalesce(v_college.name_ar,nullif(trim(coalesce(p_course->>'college_ar',p_course->>'college','')),'')),
      college_en=coalesce(v_college.name_en,nullif(trim(coalesce(p_course->>'college_en','')),'')),
      department_ar=coalesce(v_department.name_ar,nullif(trim(coalesce(p_course->>'department_ar',p_course->>'department','')),'')),
      department_en=coalesce(v_department.name_en,nullif(trim(coalesce(p_course->>'department_en','')),'')),
      requirement_type=v_requirement,
      source_url=nullif(trim(coalesce(p_course->>'source_url','')),''),
      updated_at=now()
    where id=v_id
    returning * into v_saved;
  end if;

  delete from public.course_programs where course_code=v_saved.code;

  if coalesce(array_length(p_program_ids,1),0) > 0 then
    insert into public.course_programs(course_code,program_id,requirement_type)
    select v_saved.code,p.id,v_requirement
      from public.academic_programs p
     where p.id=any(p_program_ids)
       and p.active is true
       and (v_college_id is null or p.college_id=v_college_id)
       and (v_department_id is null or p.department_id=v_department_id)
    on conflict (course_code,program_id) do update
      set requirement_type=excluded.requirement_type;
    get diagnostics v_program_count = row_count;
  end if;

  return jsonb_build_object(
    'course',to_jsonb(v_saved),
    'program_count',v_program_count,
    'program_ids',coalesce(to_jsonb(p_program_ids),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_upsert_course_with_programs(jsonb,uuid[],text) from public;
grant execute on function public.admin_upsert_course_with_programs(jsonb,uuid[],text) to service_role;
