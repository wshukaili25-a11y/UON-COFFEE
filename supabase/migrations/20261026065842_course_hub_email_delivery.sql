create or replace function public.uon_course_name_key(value text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(translate(regexp_replace(lower(coalesce(value,'')),'[ًٌٍَُِّْٰـ]','','g'),'أإآى','اااي'),'[^a-z0-9ء-ي]+',' ','g'));
$$;
create or replace function public.uon_course_resource_matches(explicit_code text,label text,code text,name_ar text,name_en text) returns boolean language plpgsql stable set search_path='' as $$
declare target text:=regexp_replace(upper(code),'[[:space:]-]','','g'); found_codes text[]; clean text;
begin
 if nullif(trim(explicit_code),'') is not null then return regexp_replace(upper(explicit_code),'[[:space:]-]','','g')=target; end if;
 select array_agg(regexp_replace(m[1],'[[:space:]-]','','g')) into found_codes from regexp_matches(upper(replace(label,'_',' ')),'\m([A-Z]{2,10}[ -]*[0-9]{2,4}[A-Z]?)\M','g') m;
 if found_codes is not null then return target=any(found_codes); end if;
 clean:=public.uon_course_name_key(regexp_replace(label,'\s*(سكشن|شعبة|section|sec\.)\s*.*$','','i'));
 if length(clean)<4 then return false; end if;
 return clean in (public.uon_course_name_key(name_ar),public.uon_course_name_key(name_en)) and (select count(*) from public.courses c where c.active and c.status='approved' and clean in(public.uon_course_name_key(c.name_ar),public.uon_course_name_key(c.name_en)))=1;
end $$;
revoke all on function public.uon_course_name_key(text),public.uon_course_resource_matches(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.uon_course_name_key(text),public.uon_course_resource_matches(text,text,text,text,text) to service_role;
CREATE OR REPLACE FUNCTION public.uon_course_hub_v65_core_v1(p_code text, p_language text DEFAULT 'ar'::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with selected as (
  select c.* from public.courses c
  where c.active is true and c.status='approved' and regexp_replace(upper(c.code),'[[:space:]-]','','g')=regexp_replace(upper(trim(p_code)),'[[:space:]-]','','g')
  limit 1
), summary_rows as (
  select s.* from public.summaries s, selected c
  where s.approved is true and public.uon_course_resource_matches(s.course_code, concat_ws(' ',s.subject,s.title), c.code,c.name_ar,c.name_en)
), program_rows as (
  select ap.id,ap.name_ar,ap.name_en,ap.degree_ar,ap.degree_en,cp.requirement_type,cp.semester_no
  from public.course_programs cp
  join public.academic_programs ap on ap.id=cp.program_id and ap.active is true
  join selected c on upper(cp.course_code)=upper(c.code)
), prereq_rows as (
  select cp.prerequisite_code,cp.minimum_grade
  from public.course_prerequisites cp join selected c on upper(cp.course_code)=upper(c.code)
), resource_rows as (
  select cr.id,cr.title,cr.description,cr.resource_type,cr.url,cr.sort_order
  from public.course_resources cr join selected c on upper(cr.course_code)=upper(c.code)
  where cr.active is true
), group_rows as (
  select g.id,g.link,g.subject,g.college,g.description,g.course_code,g.members_count,g.created_at,g.updated_at
  from public.whatsapp_groups g join selected c on public.uon_course_resource_matches(g.course_code,g.subject,c.code,c.name_ar,c.name_en)
  where g.approved is true
), rating_rows as (
  select r.id,r.kind,r.target_name,r.overall_rating,r.clarity_rating,r.exams_rating,r.comment,r.created_at,
         r.target_type,r.course_code,r.overall,r.teaching,r.interaction,r.exam_difficulty,r.recommended,r.attendance
  from public.rating_submissions r join selected c on upper(coalesce(r.course_code,''))=upper(c.code)
  where r.status='approved'
)
select jsonb_build_object(
 'course',(
   select jsonb_build_object(
    'id',c.id,'code',c.code,'name_ar',c.name_ar,'name_en',c.name_en,
    'college',c.college,'department',c.department,'credit_hours',c.credit_hours,
    'description',c.description,'active',c.active,'level',c.level,
    'learning_outcomes',c.learning_outcomes,'college_ar',c.college_ar,'college_en',c.college_en,
    'department_ar',c.department_ar,'department_en',c.department_en,'requirement_type',c.requirement_type
   ) from selected c
 ),
 'summaries',coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'title',s.title,'course_code',s.course_code,'college',s.college,
    'pdf_url',s.pdf_url,'downloads',s.downloads,'created_at',s.created_at,'subject',s.subject,
    'tags',s.tags,'link',s.link,'description',s.description,'url',s.url,'views',s.views,
    'rating',s.rating,'updated_at',s.updated_at,'resource_type',s.resource_type,'content_type',s.content_type,
    'instructor_name',s.instructor_name,'semester',s.semester,'academic_year',s.academic_year,
    'language',s.language,'page_count',s.page_count
  ) order by s.created_at desc) from summary_rows s where coalesce(s.content_type,s.resource_type,'summary') not in ('exam')),'[]'::jsonb),
 'exams',coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'title',s.title,'course_code',s.course_code,'college',s.college,
    'pdf_url',s.pdf_url,'downloads',s.downloads,'created_at',s.created_at,'subject',s.subject,
    'tags',s.tags,'link',s.link,'description',s.description,'url',s.url,'views',s.views,
    'rating',s.rating,'updated_at',s.updated_at,'resource_type',s.resource_type,'content_type',s.content_type,
    'instructor_name',s.instructor_name,'semester',s.semester,'academic_year',s.academic_year,
    'language',s.language,'page_count',s.page_count
  ) order by s.created_at desc) from summary_rows s where coalesce(s.content_type,s.resource_type,'')='exam'),'[]'::jsonb),
 'groups',coalesce((select jsonb_agg(to_jsonb(g) order by g.updated_at desc nulls last,g.created_at desc) from group_rows g),'[]'::jsonb),
 'ratings',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from rating_rows r),'[]'::jsonb),
 'resources',coalesce((select jsonb_agg(to_jsonb(r) order by r.sort_order,r.title) from resource_rows r),'[]'::jsonb),
 'prerequisites',coalesce((select jsonb_agg(to_jsonb(p) order by p.prerequisite_code) from prereq_rows p),'[]'::jsonb),
 'programs',coalesce((select jsonb_agg(to_jsonb(p) order by p.name_ar) from program_rows p),'[]'::jsonb),
 'stats',jsonb_build_object(
    'summaries',(select count(*) from summary_rows s where coalesce(s.content_type,s.resource_type,'summary')<>'exam'),
    'exams',(select count(*) from summary_rows s where coalesce(s.content_type,s.resource_type,'')='exam'),
    'groups',(select count(*) from group_rows),
    'ratings',(select count(*) from rating_rows),
    'resources',(select count(*) from resource_rows),
    'rating_average',(select round(avg(coalesce(r.overall,r.overall_rating))::numeric,2) from rating_rows r)
 )
);
$function$;

-- Short-lived delivery requests; only the server role may access them.
create table if not exists public.summary_email_requests(
 id uuid primary key, summary_id uuid not null, email text not null, name text not null,
 otp_hash text not null, created_at timestamptz not null default now(), expires_at timestamptz not null,
 attempts integer not null default 0, state text not null default 'pending' check(state in ('pending','sending','sent','failed')),
 sent_at timestamptz, provider_id text
);
alter table public.summary_email_requests enable row level security;
revoke all on public.summary_email_requests from public,anon,authenticated;
grant select,insert,update,delete on public.summary_email_requests to service_role;
create index if not exists summary_email_rate_idx on public.summary_email_requests(email,created_at);
create or replace function public.uon_email_request(p_id uuid,p_summary uuid,p_email text,p_name text,p_hash text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(617203);
 delete from public.summary_email_requests where created_at < now()-interval '24 hours';
 if (select count(*) from public.summary_email_requests where created_at>now()-interval '1 hour')>=100
 or (select count(*) from public.summary_email_requests where email=p_email and created_at>now()-interval '1 hour')>=3
 or exists(select 1 from public.summary_email_requests where email=p_email and created_at>now()-interval '60 seconds') then return false; end if;
 insert into public.summary_email_requests(id,summary_id,email,name,otp_hash,expires_at) values(p_id,p_summary,p_email,p_name,p_hash,now()+interval '10 minutes');
 return true;
end $$;
create or replace function public.uon_email_claim(p_id uuid,p_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.summary_email_requests;
begin
 select * into r from public.summary_email_requests where id=p_id for update;
 if not found or r.state<>'pending' or r.expires_at<now() or r.attempts>=5 then return null; end if;
 update public.summary_email_requests set attempts=attempts+1 where id=p_id;
 if r.otp_hash<>p_hash then return null; end if;
 update public.summary_email_requests set state='sending',otp_hash='' where id=p_id;
 return jsonb_build_object('summary_id',r.summary_id,'email',r.email,'name',r.name);
end $$;
revoke all on function public.uon_email_request(uuid,uuid,text,text,text),public.uon_email_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.uon_email_request(uuid,uuid,text,text,text),public.uon_email_claim(uuid,text) to service_role;

select cron.schedule('uon-summary-email-retention','17 * * * *',$cleanup$delete from public.summary_email_requests where created_at < now()-interval '24 hours'$cleanup$);
