begin;

alter table public.uon_student_section_observations
  alter column confirmed_at drop not null;

alter table public.uon_student_section_observations
  add column if not exists source_type text not null default 'student_confirmed',
  add column if not exists review_status text not null default 'confirmed',
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists parser_model text;

alter table public.course_section_options
  add column if not exists course_name text,
  add column if not exists enrolled_count integer,
  add column if not exists source_kind text not null default 'admin_import',
  add column if not exists observation_count integer not null default 0,
  add column if not exists first_observed_at timestamptz,
  add column if not exists last_observed_at timestamptz,
  add column if not exists last_parser_model text;

create index if not exists course_section_options_recent_idx
  on public.course_section_options(last_observed_at desc nulls last);
create index if not exists course_section_options_instructor_idx
  on public.course_section_options(lower(instructor));

create or replace function public.uon_ingest_schedule_extraction(
  p_session_id uuid,
  p_client_token text,
  p_term text,
  p_model text,
  p_courses jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_hash text;
  v_course jsonb;
  v_section jsonb;
  v_meeting jsonb;
  v_course_code text;
  v_course_name text;
  v_section_no text;
  v_instructor text;
  v_enrolled integer;
  v_term text;
  v_now timestamp;
  v_sections integer:=0;
  v_meetings integer:=0;
begin
  if p_session_id is null or octet_length(coalesce(p_client_token,'')) not between 16 and 200 then
    raise exception 'invalid_session';
  end if;
  if jsonb_typeof(p_courses)<>'array' or jsonb_array_length(p_courses) not between 1 and 30 or octet_length(p_courses::text)>300000 then
    raise exception 'invalid_courses';
  end if;

  v_hash:=encode(extensions.digest(convert_to(trim(p_client_token),'UTF8'),'sha256'),'hex');
  v_now:=timezone('Asia/Muscat',now());
  v_term:=coalesce(nullif(left(trim(coalesce(p_term,'')),40),''),
    case
      when extract(month from v_now)<=5 then extract(year from v_now)::int||'-Spring'
      when extract(month from v_now)<=8 then extract(year from v_now)::int||'-Summer'
      else extract(year from v_now)::int||'-Fall'
    end);

  for v_course in select value from jsonb_array_elements(p_courses)
  loop
    v_course_code:=upper(left(trim(coalesce(v_course->>'course_code','')),40));
    v_course_name:=nullif(left(trim(coalesce(v_course->>'course_name','')),120),'');
    if char_length(v_course_code)<2 or jsonb_typeof(v_course->'sections')<>'array' then continue; end if;

    for v_section in select value from jsonb_array_elements(v_course->'sections')
    loop
      v_section_no:=left(trim(coalesce(v_section->>'section_no','')),20);
      v_instructor:=nullif(left(trim(coalesce(v_section->>'instructor','')),100),'');
      v_enrolled:=greatest(0,least(999,coalesce(nullif(v_section->>'enrolled','')::integer,0)));
      if char_length(v_section_no)<1 or jsonb_typeof(v_section->'meetings')<>'array' or jsonb_array_length(v_section->'meetings')<1 then continue; end if;

      insert into public.uon_student_section_observations(
        session_id,client_token_hash,term,course_code,course_name,section_no,instructor,capacity,enrolled,meetings,
        confirmed_at,updated_at,source_type,review_status,first_seen_at,parser_model
      ) values(
        p_session_id,v_hash,v_term,v_course_code,v_course_name,v_section_no,v_instructor,0,v_enrolled,v_section->'meetings',
        null,now(),'eduwave_image','unreviewed',now(),nullif(left(trim(coalesce(p_model,'')),80),'')
      )
      on conflict(session_id,course_code,section_no) do update set
        term=excluded.term,
        course_name=coalesce(excluded.course_name,public.uon_student_section_observations.course_name),
        instructor=coalesce(excluded.instructor,public.uon_student_section_observations.instructor),
        enrolled=excluded.enrolled,
        meetings=excluded.meetings,
        source_type='eduwave_image',
        review_status=case when public.uon_student_section_observations.review_status='confirmed' then 'confirmed' else 'unreviewed' end,
        parser_model=excluded.parser_model,
        updated_at=now();

      v_sections:=v_sections+1;

      for v_meeting in select value from jsonb_array_elements(v_section->'meetings')
      loop
        if coalesce(v_meeting->>'day','') not in ('الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس') then continue; end if;
        if coalesce(v_meeting->>'start','') !~ '^[0-2][0-9]:[0-5][0-9]$' or coalesce(v_meeting->>'end','') !~ '^[0-2][0-9]:[0-5][0-9]$' then continue; end if;

        insert into public.course_section_options(
          term,course_code,section_code,day_name,start_time,end_time,room,instructor,source_url,verified,updated_at,
          course_name,enrolled_count,source_kind,observation_count,first_observed_at,last_observed_at,last_parser_model
        ) values(
          v_term,v_course_code,v_section_no,v_meeting->>'day',(v_meeting->>'start')::time,(v_meeting->>'end')::time,
          nullif(left(trim(coalesce(v_meeting->>'room','')),50),''),v_instructor,null,false,now(),
          v_course_name,v_enrolled,'eduwave_image',1,now(),now(),nullif(left(trim(coalesce(p_model,'')),80),'')
        )
        on conflict(term,course_code,section_code,day_name,start_time,end_time) do update set
          room=coalesce(excluded.room,public.course_section_options.room),
          instructor=coalesce(excluded.instructor,public.course_section_options.instructor),
          course_name=coalesce(excluded.course_name,public.course_section_options.course_name),
          enrolled_count=excluded.enrolled_count,
          source_kind=case when public.course_section_options.verified then public.course_section_options.source_kind else 'eduwave_image' end,
          observation_count=public.course_section_options.observation_count+1,
          first_observed_at=coalesce(public.course_section_options.first_observed_at,now()),
          last_observed_at=now(),
          last_parser_model=excluded.last_parser_model,
          updated_at=now();
        v_meetings:=v_meetings+1;
      end loop;
    end loop;
  end loop;

  return jsonb_build_object('ok',true,'term',v_term,'sections_recorded',v_sections,'meetings_recorded',v_meetings);
end;
$function$;

revoke all on function public.uon_ingest_schedule_extraction(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.uon_ingest_schedule_extraction(uuid,text,text,text,jsonb) to service_role;

create or replace function public.uon_confirm_schedule_sections(
  p_session_id uuid,
  p_client_token text,
  p_sections jsonb,
  p_term text default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_hash text;
  v_existing_hash text;
  v_item jsonb;
  v_meeting jsonb;
  v_count integer:=0;
  v_term text;
  v_now timestamp;
  v_course_code text;
  v_course_name text;
  v_section_no text;
  v_instructor text;
  v_enrolled integer;
begin
  if p_session_id is null or octet_length(coalesce(p_client_token,'')) not between 16 and 200 then raise exception 'invalid_session'; end if;
  if jsonb_typeof(p_sections)<>'array' or jsonb_array_length(p_sections) not between 1 and 20 or octet_length(p_sections::text)>100000 then raise exception 'invalid_sections'; end if;
  v_hash:=encode(extensions.digest(convert_to(trim(p_client_token),'UTF8'),'sha256'),'hex');
  select client_token_hash into v_existing_hash from public.uon_ai_schedule_snapshots where session_id=p_session_id;
  if nullif(v_existing_hash,'') is not null and v_existing_hash<>v_hash then raise exception 'session_not_allowed'; end if;
  if not public.uon_public_rate_allow('confirm_schedule_sections',p_session_id::text,20,3600) then raise exception 'rate_limited'; end if;

  v_now:=timezone('Asia/Muscat',now());
  v_term:=nullif(left(trim(coalesce(p_term,'')),40),'');

  for v_item in select value from jsonb_array_elements(p_sections)
  loop
    v_course_code:=upper(left(trim(coalesce(v_item->>'course_code','')),40));
    v_course_name:=nullif(left(trim(coalesce(v_item->>'course_name','')),120),'');
    v_section_no:=left(trim(coalesce(v_item->>'section_no','')),20);
    v_instructor:=nullif(left(trim(coalesce(v_item->>'instructor','')),100),'');
    v_enrolled:=greatest(0,least(999,coalesce(nullif(v_item->>'enrolled','')::integer,0)));
    if char_length(v_course_code)<2 or char_length(v_section_no)<1 or jsonb_typeof(v_item->'meetings')<>'array' or jsonb_array_length(v_item->'meetings') not between 1 and 8 then
      raise exception 'invalid_section_row';
    end if;

    if v_term is null then
      select term into v_term from public.uon_student_section_observations
      where session_id=p_session_id and course_code=v_course_code and section_no=v_section_no limit 1;
    end if;
    if v_term is null then
      v_term:=case
        when extract(month from v_now)<=5 then extract(year from v_now)::int||'-Spring'
        when extract(month from v_now)<=8 then extract(year from v_now)::int||'-Summer'
        else extract(year from v_now)::int||'-Fall'
      end;
    end if;

    insert into public.uon_student_section_observations(
      session_id,client_token_hash,term,course_code,course_name,section_no,instructor,capacity,enrolled,meetings,
      confirmed_at,updated_at,source_type,review_status,first_seen_at
    ) values(
      p_session_id,v_hash,v_term,v_course_code,v_course_name,v_section_no,v_instructor,0,v_enrolled,v_item->'meetings',
      now(),now(),'eduwave_image','confirmed',now()
    )
    on conflict(session_id,course_code,section_no) do update set
      term=excluded.term,course_name=excluded.course_name,instructor=excluded.instructor,capacity=0,enrolled=excluded.enrolled,
      meetings=excluded.meetings,confirmed_at=now(),review_status='confirmed',source_type='eduwave_image',updated_at=now()
    where public.uon_student_section_observations.client_token_hash=v_hash;

    for v_meeting in select value from jsonb_array_elements(v_item->'meetings')
    loop
      if coalesce(v_meeting->>'day','') not in ('الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس') then continue; end if;
      if coalesce(v_meeting->>'start','') !~ '^[0-2][0-9]:[0-5][0-9]$' or coalesce(v_meeting->>'end','') !~ '^[0-2][0-9]:[0-5][0-9]$' then continue; end if;
      insert into public.course_section_options(
        term,course_code,section_code,day_name,start_time,end_time,room,instructor,source_url,verified,updated_at,
        course_name,enrolled_count,source_kind,observation_count,first_observed_at,last_observed_at
      ) values(
        v_term,v_course_code,v_section_no,v_meeting->>'day',(v_meeting->>'start')::time,(v_meeting->>'end')::time,
        nullif(left(trim(coalesce(v_meeting->>'room','')),50),''),v_instructor,null,true,now(),
        v_course_name,v_enrolled,'eduwave_confirmed',1,now(),now()
      )
      on conflict(term,course_code,section_code,day_name,start_time,end_time) do update set
        room=coalesce(excluded.room,public.course_section_options.room),
        instructor=coalesce(excluded.instructor,public.course_section_options.instructor),
        course_name=coalesce(excluded.course_name,public.course_section_options.course_name),
        enrolled_count=excluded.enrolled_count,
        verified=true,
        source_kind='eduwave_confirmed',
        observation_count=public.course_section_options.observation_count+1,
        first_observed_at=coalesce(public.course_section_options.first_observed_at,now()),
        last_observed_at=now(),
        updated_at=now();
    end loop;
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('ok',true,'term',v_term,'confirmed_sections',v_count);
end;
$function$;

create or replace function public.uon_ai_schedule_search(p_question text,p_limit integer default 12)
returns table(type text,title text,description text,url text,official boolean,score numeric)
language sql
stable
security definer
set search_path=''
as $function$
with q as (
  select lower(trim(coalesce(p_question,''))) text
), ranked as (
  select
    'بيانات شعب EduWave'::text as type,
    concat(c.course_code,coalesce(' — '||nullif(c.course_name,''),''),' · شعبة ',c.section_code)::text as title,
    concat_ws(' • ',
      case when c.verified then 'بيانات مؤكدة من جدول اعتمده طالب' else 'بيانات مستخرجة آليًا من صورة EduWave وغير معتمدة بعد' end,
      'الفصل: '||c.term,
      c.day_name||' '||to_char(c.start_time,'HH24:MI')||'–'||to_char(c.end_time,'HH24:MI'),
      case when nullif(c.room,'') is not null then 'القاعة: '||c.room end,
      case when nullif(c.instructor,'') is not null then 'الدكتور: '||c.instructor end,
      case when c.enrolled_count is not null then 'عدد المسجلين الظاهر: '||c.enrolled_count end,
      'مرات الرصد: '||greatest(c.observation_count,1)
    )::text as description,
    '/schedule.html'::text as url,
    false as official,
    (
      case when c.verified then 95 else 58 end
      + least(greatest(c.observation_count,1),6)*4
      + case when lower((select text from q)) like '%'||lower(c.course_code)||'%' then 80 else 0 end
      + extensions.similarity(lower((select text from q)),lower(concat_ws(' ',c.course_code,c.course_name,c.instructor,c.section_code)))*55
    )::numeric as score
  from public.course_section_options c
  where coalesce(c.last_observed_at,c.updated_at) > now()-interval '365 days'
    and (
      lower((select text from q)) like '%'||lower(c.course_code)||'%'
      or extensions.similarity(lower((select text from q)),lower(concat_ws(' ',c.course_code,c.course_name,c.instructor,c.section_code)))>.08
      or lower((select text from q)) ~ '(شعب|شعبة|سكشن|section|جدول|مادة|course|دكتور|محاضر|instructor|teacher|وقت|موعد|قاعة|room)'
    )
)
select type,title,description,url,official,score
from ranked
order by score desc,title
limit greatest(1,least(coalesce(p_limit,12),20));
$function$;

create or replace function public.uon_ai_search_fast_core_v1(p_question text,p_limit integer default 14)
returns table(type text,title text,description text,url text,official boolean,score numeric)
language sql
stable security definer
set search_path to 'public'
as $function$
with all_rows as (
 select * from public.uon_ai_search_fast_base(p_question,greatest(1,least(coalesce(p_limit,14),20)))
 union all select 'موظف جامعة نزوى',s.full_name,concat_ws(' • ',nullif(s.job_title,''),nullif(s.department,''),nullif(s.college,''),case when nullif(s.email,'') is not null then 'البريد: '||s.email end,case when nullif(s.phone,'') is not null then 'الهاتف: '||s.phone end,case when nullif(s.extension,'') is not null then 'المحول: '||s.extension end,case when nullif(s.office_location,'') is not null then 'المكتب: '||s.office_location end),coalesce(s.source_url,'https://www.unizwa.edu.om/staff.php'),true,(s.score+case when lower(coalesce(p_question,''))~'(موظف|مدير|رئيس|عميد|دكتور|استاذ|أستاذ|ايميل|إيميل|بريد|رقم|تواصل|staff|employee|director|dean|email|phone|contact)' then 45 else 10 end)::numeric from public.uon_ai_staff_search(p_question,12) s
 union all select b.type,b.title,b.description,b.url,b.official,(b.score+case when lower(coalesce(p_question,''))~'(مبنى|المبنى|موقع|وين|اين|أين|يقع|قاعة|مختبر|library|building|where|location)' then 70 else 0 end)::numeric from public.uon_ai_building_search(p_question,12) b
 union all select * from public.uon_ai_schedule_search(p_question,12)
 union all select * from public.uon_ai_search_everything(p_question,20)
), dedup as (
 select distinct on (lower(coalesce(title,'')),coalesce(url,'')) type,title,description,url,official,score from all_rows order by lower(coalesce(title,'')),coalesce(url,''),score desc,official desc
)
select type,title,description,url,official,score from dedup order by score desc,official desc,title limit greatest(1,least(coalesce(p_limit,14),30));
$function$;

create or replace function public.uon_ai_generate_schedule(p_session_id uuid,p_term text,p_preference text default 'balanced',p_max_courses integer default 6)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare result jsonb:='{}'::jsonb; selected jsonb:='[]'::jsonb; chosen_courses text[]:='{}'; candidate record; has_conflict boolean; violates_daily boolean; prof public.uon_ai_student_profiles%rowtype; pref text; max_courses int;
begin
 select * into prof from public.uon_ai_student_profiles where session_id=p_session_id;
 pref:=case when p_preference in ('few_days','early','late','balanced') then p_preference when prof.schedule_preference in ('few_days','early','late','balanced') then prof.schedule_preference else 'balanced' end;
 max_courses:=greatest(1,least(coalesce(p_max_courses,prof.preferred_load,6),8));
 create temporary table if not exists pg_temp.uon_sched_candidates(course_code text,section_code text,meetings jsonb,base_score numeric,primary key(course_code,section_code)) on commit drop;
 truncate pg_temp.uon_sched_candidates;
 insert into pg_temp.uon_sched_candidates(course_code,section_code,meetings,base_score)
 with eligible as (
  select upper(r.course_code) course_code,case r.requirement_type when 'major' then 0 when 'college' then 20 when 'university' then 40 else 60 end priority
  from public.uon_ai_registration_options(p_session_id,50) r where r.eligible=true
 ), compliant as (
  select cso.*,e.priority from public.course_section_options cso join eligible e on e.course_code=upper(cso.course_code)
  where cso.term=p_term
    and (cso.verified=true or (cso.source_kind='eduwave_image' and cso.observation_count>=1 and coalesce(cso.last_observed_at,cso.updated_at)>now()-interval '180 days'))
    and not (cso.day_name=any(coalesce(prof.preferred_days_off,'{}'::text[])))
    and (prof.earliest_start is null or cso.start_time>=prof.earliest_start)
    and (prof.latest_end is null or cso.end_time<=prof.latest_end)
 ), grouped as (
  select upper(course_code) course_code,section_code,
   jsonb_agg(jsonb_build_object('day',day_name,'start',to_char(start_time,'HH24:MI'),'end',to_char(end_time,'HH24:MI'),'room',coalesce(room,''),'teacher',coalesce(instructor,''),'verified',verified) order by day_name,start_time) meetings,
   count(distinct day_name) days_count,min(start_time) first_start,max(end_time) last_end,min(priority) priority,bool_or(verified) verified,max(observation_count) observations
  from compliant group by upper(course_code),section_code
 )
 select course_code,section_code,meetings,
  priority
  + case when verified then 0 else greatest(160,520-least(observations,6)*55) end
  + case pref when 'few_days' then days_count*120+extract(epoch from(last_end-first_start))/60 when 'early' then extract(epoch from first_start)/60+days_count*25 when 'late' then (1440-extract(epoch from last_end)/60)+days_count*25 else days_count*70+extract(epoch from(last_end-first_start))/60 end
 from grouped;
 for candidate in select * from pg_temp.uon_sched_candidates order by base_score,course_code,section_code loop
  exit when cardinality(chosen_courses)>=max_courses;
  if candidate.course_code=any(chosen_courses) then continue; end if;
  select exists(select 1 from jsonb_array_elements(candidate.meetings) nm cross join lateral jsonb_array_elements(selected) cs cross join lateral jsonb_array_elements(cs->'meetings') sm where nm->>'day'=sm->>'day' and nm->>'start'<sm->>'end' and nm->>'end'>sm->>'start') into has_conflict;
  if coalesce(prof.max_classes_per_day,0)>0 then
   with allm as (select x->>'day' d from jsonb_array_elements(candidate.meetings) x union all select m->>'day' from jsonb_array_elements(selected) s cross join lateral jsonb_array_elements(s->'meetings') m)
   select exists(select 1 from allm group by d having count(*)>prof.max_classes_per_day) into violates_daily;
  else violates_daily:=false; end if;
  if not has_conflict and not violates_daily then selected:=selected||jsonb_build_array(jsonb_build_object('course_code',candidate.course_code,'section_code',candidate.section_code,'meetings',candidate.meetings,'score',candidate.base_score));chosen_courses:=array_append(chosen_courses,candidate.course_code);end if;
 end loop;
 return jsonb_build_object('term',p_term,'preference',pref,'courses',selected,'course_count',jsonb_array_length(selected),'conflicts',0,'applied_constraints',jsonb_build_object('days_off',coalesce(prof.preferred_days_off,'{}'::text[]),'earliest_start',prof.earliest_start,'latest_end',prof.latest_end,'max_classes_per_day',prof.max_classes_per_day),'note',case when not exists(select 1 from public.course_section_options where term=p_term and (verified=true or (source_kind='eduwave_image' and observation_count>=1))) then 'لا توجد شعب مرصودة لهذا الفصل حتى الآن' when jsonb_array_length(selected)=0 then 'لا توجد تركيبة متاحة تطابق الشروط الحالية من الشعب المرصودة والمواد المؤهلة' else null end);
end $function$;

-- Backfill previously confirmed observations into the global section knowledge table.
insert into public.course_section_options(
  term,course_code,section_code,day_name,start_time,end_time,room,instructor,source_url,verified,updated_at,
  course_name,enrolled_count,source_kind,observation_count,first_observed_at,last_observed_at
)
select
  coalesce(o.term,
    case when extract(month from timezone('Asia/Muscat',now()))<=5 then extract(year from timezone('Asia/Muscat',now()))::int||'-Spring'
         when extract(month from timezone('Asia/Muscat',now()))<=8 then extract(year from timezone('Asia/Muscat',now()))::int||'-Summer'
         else extract(year from timezone('Asia/Muscat',now()))::int||'-Fall' end),
  upper(o.course_code),o.section_no,m->>'day',(m->>'start')::time,(m->>'end')::time,nullif(m->>'room',''),o.instructor,null,true,now(),
  o.course_name,o.enrolled,'eduwave_confirmed',1,o.confirmed_at,coalesce(o.updated_at,o.confirmed_at)
from public.uon_student_section_observations o
cross join lateral jsonb_array_elements(o.meetings) m
where o.confirmed_at is not null
  and coalesce(m->>'day','') in ('الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس')
  and coalesce(m->>'start','') ~ '^[0-2][0-9]:[0-5][0-9]$'
  and coalesce(m->>'end','') ~ '^[0-2][0-9]:[0-5][0-9]$'
on conflict(term,course_code,section_code,day_name,start_time,end_time) do update set
  room=coalesce(excluded.room,public.course_section_options.room),
  instructor=coalesce(excluded.instructor,public.course_section_options.instructor),
  course_name=coalesce(excluded.course_name,public.course_section_options.course_name),
  enrolled_count=excluded.enrolled_count,
  verified=true,
  source_kind='eduwave_confirmed',
  observation_count=greatest(public.course_section_options.observation_count,1),
  first_observed_at=coalesce(public.course_section_options.first_observed_at,excluded.first_observed_at),
  last_observed_at=greatest(public.course_section_options.last_observed_at,excluded.last_observed_at),
  updated_at=now();

commit;
