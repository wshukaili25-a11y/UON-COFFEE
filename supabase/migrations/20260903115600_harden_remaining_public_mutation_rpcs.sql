create or replace function public.uon_submit_content_report(
  p_source_table text,
  p_source_id text,
  p_content_title text,
  p_source_url text,
  p_report_type text,
  p_details text,
  p_page_url text,
  p_session_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 v_id uuid;
 v_last timestamptz;
 v_type text:=trim(coalesce(p_report_type,''));
 v_details text:=trim(coalesce(p_details,''));
 v_source_table text:=nullif(trim(coalesce(p_source_table,'')),'');
 v_source_url text:=nullif(trim(coalesce(p_source_url,'')),'');
 v_page_url text:=coalesce(nullif(trim(coalesce(p_page_url,'')),''),'/');
 v_target text:=coalesce(v_source_table,'')||':'||coalesce(left(trim(coalesce(p_source_id,'')),120),'');
begin
 if p_session_id is null then raise exception 'تعذر التحقق من الجلسة'; end if;
 if v_type not in ('broken_link','wrong_content','duplicate','inappropriate','outdated','other') then raise exception 'نوع البلاغ غير صالح'; end if;
 if char_length(v_details)<5 or char_length(v_details)>1000 then raise exception 'تفاصيل البلاغ غير صالحة'; end if;
 if v_source_table is not null and v_source_table not in ('tool_registry','summaries','whatsapp_groups','student_projects','courses','university_programs','site_notifications') then raise exception 'مصدر البلاغ غير صالح'; end if;
 if char_length(coalesce(p_source_id,''))>120 or char_length(coalesce(p_content_title,''))>220 then raise exception 'بيانات البلاغ طويلة جدًا'; end if;
 if char_length(coalesce(v_source_url,''))>1000 or char_length(v_page_url)>1000 then raise exception 'الرابط طويل جدًا'; end if;
 if v_source_url is not null and v_source_url !~ '^(https?://|/|[A-Za-z0-9._-]+\.html)' then raise exception 'رابط المصدر غير صالح'; end if;
 if v_page_url !~ '^(https?://|/)' then raise exception 'رابط الصفحة غير صالح'; end if;
 select last_submitted_at into v_last from public.content_report_limits where session_id=p_session_id for update;
 if v_last is not null and now()-v_last<interval '15 seconds' then raise exception 'انتظر قليلًا قبل إرسال بلاغ آخر'; end if;
 if not public.uon_public_rate_allow('content_report_total',null,30,3600) then raise exception 'rate_limited'; end if;
 if nullif(v_target,':') is not null and not public.uon_public_rate_allow('content_report_target',v_target,6,86400) then raise exception 'rate_limited'; end if;
 insert into public.content_reports(reason,content_title,details,page_url,page_title,status,source_table,source_id,source_url,report_type,session_id)
 values(v_type,nullif(left(trim(coalesce(p_content_title,'')),220),''),v_details,v_page_url,nullif((coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb)->>'referer',''),'pending',v_source_table,nullif(left(trim(coalesce(p_source_id,'')),120),''),v_source_url,v_type,p_session_id)
 returning id into v_id;
 insert into public.content_report_limits(session_id,last_submitted_at) values(p_session_id,now())
 on conflict(session_id) do update set last_submitted_at=excluded.last_submitted_at;
 return v_id;
end;
$$;

create or replace function public.uon_submit_course_content_request(
  p_code text,
  p_content_type text,
  p_description text,
  p_contact text,
  p_page_url text,
  p_session_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 v_id uuid;
 v_code text:=upper(regexp_replace(trim(coalesce(p_code,'')),'[^A-Z0-9]','','g'));
 v_type text:=trim(coalesce(p_content_type,''));
 v_last timestamptz;
begin
 if v_code !~ '^[A-Z]{2,10}[0-9]{3}[A-Z]?$' then raise exception 'رمز المقرر غير صالح'; end if;
 if not exists(select 1 from public.courses where code=v_code and active is true) then raise exception 'المقرر غير موجود'; end if;
 if v_type not in ('summary','exam','group','resource','description','prerequisite','other') then raise exception 'نوع الطلب غير صالح'; end if;
 if p_session_id is null then raise exception 'تعذر التحقق من الجلسة'; end if;
 if char_length(coalesce(p_description,''))>1500 or char_length(coalesce(p_contact,''))>180 or char_length(coalesce(p_page_url,''))>1000 then raise exception 'بيانات الطلب طويلة جدًا'; end if;
 select last_submitted_at into v_last from public.course_request_limits where session_id=p_session_id for update;
 if v_last is not null and now()-v_last<interval '20 seconds' then raise exception 'انتظر قليلًا قبل إرسال طلب آخر'; end if;
 if not public.uon_public_rate_allow('course_content_request_total',null,20,3600) then raise exception 'rate_limited'; end if;
 if not public.uon_public_rate_allow('course_content_request_course',v_code,5,86400) then raise exception 'rate_limited'; end if;
 insert into public.course_requests(request_type,code,description,submitted_by,status,created_at,content_type,contact,session_id,page_url)
 values('content',v_code,nullif(trim(coalesce(p_description,'')),''),'طالب','pending',now(),v_type,nullif(trim(coalesce(p_contact,'')),''),p_session_id,nullif(trim(coalesce(p_page_url,'')),''))
 returning id into v_id;
 insert into public.course_request_limits(session_id,last_submitted_at) values(p_session_id,now())
 on conflict(session_id) do update set last_submitted_at=excluded.last_submitted_at;
 return v_id;
end;
$$;

create or replace function public.uon_submit_feature_suggestion(
  p_category text,
  p_title text,
  p_details text,
  p_college text default null,
  p_contact text default null,
  p_page_url text default null,
  p_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 v_id uuid;
 v_category text:=trim(coalesce(p_category,''));
 v_title text:=trim(coalesce(p_title,''));
 v_details text:=trim(coalesce(p_details,''));
 v_last timestamptz;
begin
 if v_category not in ('feature','improvement','bug','content') then raise exception 'نوع الاقتراح غير صالح'; end if;
 if char_length(v_title)<3 or char_length(v_title)>120 then raise exception 'عنوان الاقتراح غير صالح'; end if;
 if char_length(v_details)<10 or char_length(v_details)>2000 then raise exception 'اكتب تفاصيل أوضح للاقتراح'; end if;
 if p_session_id is null then raise exception 'تعذر التحقق من الجلسة'; end if;
 if char_length(coalesce(p_college,''))>120 or char_length(coalesce(p_contact,''))>180 or char_length(coalesce(p_page_url,''))>1000 then raise exception 'بيانات الاقتراح طويلة جدًا'; end if;
 select last_submitted_at into v_last from public.feature_suggestion_limits where session_id=p_session_id for update;
 if v_last is not null and now()-v_last<interval '20 seconds' then raise exception 'انتظر قليلًا قبل إرسال اقتراح آخر'; end if;
 if not public.uon_public_rate_allow('feature_suggestion_total',null,10,3600) then raise exception 'rate_limited'; end if;
 insert into public.feature_suggestions(category,title,details,college,contact,page_url,status,created_at)
 values(v_category,v_title,v_details,nullif(trim(coalesce(p_college,'')),''),nullif(trim(coalesce(p_contact,'')),''),nullif(trim(coalesce(p_page_url,'')),''),'pending',now())
 returning id into v_id;
 insert into public.feature_suggestion_limits(session_id,last_submitted_at) values(p_session_id,now())
 on conflict(session_id) do update set last_submitted_at=excluded.last_submitted_at;
 return v_id;
end;
$$;

create or replace function public.uon_submit_rating_v65(
 p_target_type text,
 p_target_name text,
 p_course_code text default null,
 p_overall smallint default null,
 p_teaching smallint default null,
 p_interaction smallint default null,
 p_exam_difficulty smallint default null,
 p_attendance smallint default null,
 p_recommended boolean default null,
 p_comment text default null,
 p_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 v_id uuid;
 v_type text:=lower(trim(coalesce(p_target_type,'')));
 v_name text:=trim(coalesce(p_target_name,''));
 v_code text:=upper(regexp_replace(trim(coalesce(p_course_code,'')),'\s+','','g'));
 v_comment text:=trim(coalesce(p_comment,''));
 v_last timestamptz;
 v_target text;
begin
 if p_session_id is null then raise exception 'تعذر التحقق من الجلسة'; end if;
 if v_type not in ('course','instructor') then raise exception 'نوع التقييم غير صالح'; end if;
 if char_length(v_name)<2 or char_length(v_name)>120 then raise exception 'اسم الدكتور أو المقرر غير صالح'; end if;
 if v_code<>'' and v_code !~ '^[A-Z]{2,10}[0-9]{2,4}[A-Z]?$' then raise exception 'رمز المقرر غير صالح'; end if;
 if p_overall is null or p_overall<1 or p_overall>5 then raise exception 'اختر التقييم العام'; end if;
 if p_teaching is not null and (p_teaching<1 or p_teaching>5) then raise exception 'تقييم الشرح غير صالح'; end if;
 if p_interaction is not null and (p_interaction<1 or p_interaction>5) then raise exception 'تقييم التعامل غير صالح'; end if;
 if p_exam_difficulty is not null and (p_exam_difficulty<1 or p_exam_difficulty>5) then raise exception 'تقييم الاختبارات غير صالح'; end if;
 if p_attendance is not null and (p_attendance<1 or p_attendance>5) then raise exception 'تقييم الالتزام غير صالح'; end if;
 if char_length(v_comment)>1200 then raise exception 'التعليق طويل جدًا'; end if;
 insert into public.rating_submission_limits(session_id,last_submitted_at)
 values(p_session_id,now()-interval '1 day') on conflict(session_id) do nothing;
 select last_submitted_at into v_last from public.rating_submission_limits where session_id=p_session_id for update;
 if v_last is not null and now()-v_last<interval '20 seconds' then raise exception 'انتظر قليلًا قبل إرسال تقييم آخر'; end if;
 v_target:=v_type||':'||coalesce(nullif(v_code,''),lower(v_name));
 if not public.uon_public_rate_allow('rating_submission_total',null,20,3600) then raise exception 'rate_limited'; end if;
 if not public.uon_public_rate_allow('rating_submission_target',left(v_target,200),5,86400) then raise exception 'rate_limited'; end if;
 insert into public.rating_submissions(
   kind,target_name,college,overall_rating,difficulty_rating,clarity_rating,exams_rating,workload_rating,
   comment,status,created_at,reviewed_at,target_type,course_code,overall,teaching,interaction,
   exam_difficulty,recommended,attendance
 ) values(
   v_type,v_name,null,p_overall,null,p_teaching,p_exam_difficulty,null,
   v_comment,'pending',now(),null,v_type,nullif(v_code,''),p_overall,p_teaching,p_interaction,
   p_exam_difficulty,p_recommended,p_attendance
 ) returning id into v_id;
 update public.rating_submission_limits set last_submitted_at=now() where session_id=p_session_id;
 return v_id;
end;
$$;

create or replace function public.uon_submit_student_project_v2(
 p_title text,
 p_owner_name text,
 p_major text default null,
 p_study_year text default null,
 p_description text default null,
 p_project_url text default null,
 p_image_url text default null,
 p_contact text default null,
 p_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 v_id uuid;
 v_title text:=trim(coalesce(p_title,''));
 v_owner text:=trim(coalesce(p_owner_name,''));
 v_major text:=trim(coalesce(p_major,''));
 v_year text:=trim(coalesce(p_study_year,''));
 v_description text:=trim(coalesce(p_description,''));
 v_url text:=trim(coalesce(p_project_url,''));
 v_image text:=trim(coalesce(p_image_url,''));
 v_contact text:=trim(coalesce(p_contact,''));
 v_github text;
 v_demo text;
 v_last timestamptz;
 v_target text;
begin
 if p_session_id is null then raise exception 'تعذر التحقق من الجلسة'; end if;
 if char_length(v_title)<3 or char_length(v_title)>180 then raise exception 'عنوان المشروع غير صالح'; end if;
 if char_length(v_owner)<2 or char_length(v_owner)>100 then raise exception 'اسم صاحب المشروع مطلوب'; end if;
 if char_length(v_major)>120 then raise exception 'اسم التخصص طويل جدًا'; end if;
 if char_length(v_year)>40 then raise exception 'السنة الدراسية غير صالحة'; end if;
 if char_length(v_description)<15 or char_length(v_description)>1500 then raise exception 'اكتب وصفًا أوضح للمشروع'; end if;
 if char_length(v_contact)<3 or char_length(v_contact)>150 then raise exception 'وسيلة التواصل مطلوبة للمراجعة'; end if;
 if v_url !~* '^https://[^[:space:]]+$' or char_length(v_url)>1500 then raise exception 'رابط المشروع يجب أن يكون HTTPS صالحًا'; end if;
 if v_image<>'' and (v_image !~* '^https://[^[:space:]]+$' or char_length(v_image)>1500) then raise exception 'رابط الصورة غير صالح'; end if;
 insert into public.student_project_submission_limits(session_id,last_submitted_at)
 values(p_session_id,now()-interval '1 day') on conflict(session_id) do nothing;
 select last_submitted_at into v_last from public.student_project_submission_limits where session_id=p_session_id for update;
 if v_last is not null and now()-v_last<interval '30 seconds' then raise exception 'انتظر قليلًا قبل إرسال مشروع آخر'; end if;
 if exists(select 1 from public.student_projects where lower(coalesce(url,demo_url,github_url,''))=lower(v_url) and status in ('pending','approved')) then raise exception 'هذا المشروع مضاف أو مرسل للمراجعة مسبقًا'; end if;
 v_target:=encode(extensions.digest(convert_to(lower(v_url),'UTF8'),'sha256'),'hex');
 if not public.uon_public_rate_allow('student_project_total',null,5,3600) then raise exception 'rate_limited'; end if;
 if not public.uon_public_rate_allow('student_project_url',v_target,2,604800) then raise exception 'rate_limited'; end if;
 if v_url ~* '^https://(www\.)?github\.com/' then v_github:=v_url; v_demo:=null; else v_demo:=v_url; v_github:=null; end if;
 insert into public.student_projects(title,owner_name,major,study_year,description,github_url,demo_url,image_url,contact,status,featured,views,likes,url,created_at,updated_at)
 values(v_title,v_owner,nullif(v_major,''),nullif(v_year,''),v_description,v_github,v_demo,nullif(v_image,''),v_contact,'pending',false,0,0,v_url,now(),now())
 returning id into v_id;
 update public.student_project_submission_limits set last_submitted_at=now() where session_id=p_session_id;
 return v_id;
end;
$$;

create or replace function public.uon_submit_summary_link_v65(
 p_title text,
 p_course_code text,
 p_college text,
 p_resource_type text,
 p_url text,
 p_description text default null,
 p_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
 v_id uuid;
 v_last timestamptz;
 v_title text:=trim(coalesce(p_title,''));
 v_code text:=upper(regexp_replace(trim(coalesce(p_course_code,'')),'\s+','','g'));
 v_college text:=nullif(trim(coalesce(p_college,'')),'');
 v_type text:=lower(trim(coalesce(p_resource_type,'')));
 v_url text:=trim(coalesce(p_url,''));
 v_target text;
begin
 if p_session_id is null then raise exception 'تعذر التحقق من الجلسة'; end if;
 if char_length(v_title)<3 or char_length(v_title)>150 then raise exception 'اسم الملف غير صالح'; end if;
 if v_code !~ '^[A-Z]{2,10}[0-9]{2,4}[A-Z]?$' then raise exception 'رمز المقرر غير صالح'; end if;
 if v_college is null or char_length(v_college)>120 then raise exception 'الكلية غير صالحة'; end if;
 if v_type not in ('summary','exam','notes') then raise exception 'نوع الملف غير صالح'; end if;
 if v_url !~ '^https://[^[:space:]]+$' or char_length(v_url)>1500 then raise exception 'رابط الملف غير صالح'; end if;
 if char_length(coalesce(p_description,''))>1000 then raise exception 'الوصف طويل جدًا'; end if;
 insert into public.resource_upload_limits(session_id,last_submitted_at)
 values(p_session_id,now()-interval '1 day') on conflict(session_id) do nothing;
 select last_submitted_at into v_last from public.resource_upload_limits where session_id=p_session_id for update;
 if v_last is not null and now()-v_last<interval '15 seconds' then raise exception 'انتظر قليلًا قبل إرسال طلب آخر'; end if;
 v_target:=encode(extensions.digest(convert_to(lower(v_url),'UTF8'),'sha256'),'hex');
 if not public.uon_public_rate_allow('summary_link_total',null,20,3600) then raise exception 'rate_limited'; end if;
 if not public.uon_public_rate_allow('summary_link_url',v_target,3,604800) then raise exception 'rate_limited'; end if;
 insert into public.summaries(title,course_code,subject,college,content_type,resource_type,url,pdf_url,link,description,approved,created_at,updated_at)
 values(v_title,v_code,v_code,v_college,v_type,v_type,v_url,v_url,v_url,nullif(trim(coalesce(p_description,'')),''),false,now(),now())
 returning id into v_id;
 update public.resource_upload_limits set last_submitted_at=now() where session_id=p_session_id;
 return v_id;
end;
$$;

create or replace function public.uon_submit_whatsapp_group_v2(
 p_subject text,
 p_course_code text default null,
 p_college text default null,
 p_link text default null,
 p_description text default null,
 p_session_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
 v_id integer;
 v_subject text:=trim(coalesce(p_subject,''));
 v_link text:=trim(coalesce(p_link,''));
 v_code text:=upper(regexp_replace(trim(coalesce(p_course_code,'')),'\s+','','g'));
 v_college text:=trim(coalesce(p_college,''));
 v_description text:=trim(coalesce(p_description,''));
 v_last timestamptz;
 v_target text;
begin
 if p_session_id is null then raise exception 'تعذر التحقق من الجلسة'; end if;
 if char_length(v_subject)<3 or char_length(v_subject)>150 then raise exception 'اسم المجموعة غير صالح'; end if;
 if char_length(v_college)<2 or char_length(v_college)>120 then raise exception 'الكلية غير صالحة'; end if;
 if v_link !~* '^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{8,}(\?.*)?$' then raise exception 'أدخل رابط دعوة واتساب صحيح'; end if;
 if v_code<>'' and v_code !~ '^[A-Z]{2,10}[0-9]{2,4}[A-Z]?$' then raise exception 'رمز المادة غير صحيح'; end if;
 if char_length(v_description)>800 then raise exception 'الملاحظة طويلة جدًا'; end if;
 insert into public.whatsapp_group_submission_limits(session_id,last_submitted_at)
 values(p_session_id,now()-interval '1 day') on conflict(session_id) do nothing;
 select last_submitted_at into v_last from public.whatsapp_group_submission_limits where session_id=p_session_id for update;
 if v_last is not null and now()-v_last<interval '20 seconds' then raise exception 'انتظر قليلًا قبل إرسال مجموعة أخرى'; end if;
 if exists(select 1 from public.whatsapp_groups where lower(link)=lower(v_link) and approved is not false) then raise exception 'هذه المجموعة موجودة مسبقًا'; end if;
 if exists(select 1 from public.whatsapp_groups where lower(link)=lower(v_link) and approved is false and created_at>now()-interval '7 days') then raise exception 'هذه المجموعة مرسلة للمراجعة مسبقًا'; end if;
 v_target:=encode(extensions.digest(convert_to(lower(v_link),'UTF8'),'sha256'),'hex');
 if not public.uon_public_rate_allow('whatsapp_group_total',null,15,3600) then raise exception 'rate_limited'; end if;
 if not public.uon_public_rate_allow('whatsapp_group_link',v_target,3,604800) then raise exception 'rate_limited'; end if;
 insert into public.whatsapp_groups(subject,course_code,college,link,description,submitter_name,approved,members_count,created_at,updated_at)
 values(v_subject,nullif(v_code,''),v_college,v_link,nullif(v_description,''),null,false,0,now(),now())
 returning id into v_id;
 update public.whatsapp_group_submission_limits set last_submitted_at=now() where session_id=p_session_id;
 return v_id;
end;
$$;

create or replace function public.uon_ai_sync_schedule(p_session_id uuid,p_client_token text,p_schedule jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_allowed boolean:=false; v_count int:=0;
begin
 if p_session_id is null or p_client_token is null or length(trim(p_client_token))<16 then raise exception 'invalid_session'; end if;
 select allowed into v_allowed from public.uon_ai_bind_conversation_client(p_session_id,p_client_token) limit 1;
 if not coalesce(v_allowed,false) then raise exception 'session_not_allowed'; end if;
 if jsonb_typeof(p_schedule)<>'array' or jsonb_array_length(p_schedule)>80 then raise exception 'invalid_schedule'; end if;
 if octet_length(p_schedule::text)>100000 then raise exception 'schedule_too_large'; end if;
 select count(*) into v_count from jsonb_array_elements(p_schedule) x
 where coalesce(x->>'course','')<>''
   and coalesce(x->>'day','') in ('الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس')
   and coalesce(x->>'start','')~'^[0-9]{2}:[0-9]{2}$'
   and coalesce(x->>'end','')~'^[0-9]{2}:[0-9]{2}$';
 if v_count<>jsonb_array_length(p_schedule) then raise exception 'invalid_schedule_rows'; end if;
 if not public.uon_public_rate_allow('ai_schedule_sync',p_session_id::text,30,3600) then raise exception 'rate_limited'; end if;
 insert into public.uon_ai_schedule_snapshots(session_id,schedule,updated_at)
 values(p_session_id,p_schedule,now())
 on conflict(session_id) do update set schedule=excluded.schedule,updated_at=now();
 return jsonb_build_object('ok',true,'classes',v_count);
end;
$$;

create or replace function public.uon_resolve_short_link(p_slug text)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare v_url text; v_slug text:=lower(trim(coalesce(p_slug,'')));
begin
 if v_slug !~ '^[a-z0-9_-]{2,80}$' then return null; end if;
 select destination into v_url from public.short_links where slug=v_slug and active=true limit 1;
 if v_url is null then return null; end if;
 if public.uon_public_rate_allow('short_link_click',v_slug,3,3600) then
   update public.short_links set clicks=clicks+1,updated_at=now() where slug=v_slug and active=true;
 end if;
 return v_url;
end;
$$;

create or replace function public.uon_report_client_error(
 p_message text,
 p_source text default 'browser',
 p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_message text:=left(trim(coalesce(p_message,'')),500);
 v_source text:=left(trim(coalesce(p_source,'browser')),80);
 v_headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 v_ip text;
 v_client_hash text;
 v_recent integer;
 v_duplicate integer;
 v_details jsonb:=coalesce(p_details,'{}'::jsonb)-'password'-'token'-'secret'-'authorization'-'cookie';
begin
 if char_length(v_message)<3 then raise exception 'invalid error message'; end if;
 if v_source !~ '^[A-Za-z0-9_.:/-]{2,80}$' then raise exception 'invalid error source'; end if;
 if octet_length(v_details::text)>8192 then raise exception 'details too large'; end if;
 v_ip:=split_part(coalesce(v_headers->>'x-forwarded-for',v_headers->>'cf-connecting-ip',v_headers->>'x-real-ip','unknown'),',',1);
 v_client_hash:=encode(extensions.digest(convert_to(trim(v_ip),'UTF8'),'sha256'),'hex');
 if not public.uon_public_rate_allow('client_error_report',null,30,300) then return jsonb_build_object('ok',false,'rate_limited',true); end if;
 select count(*) into v_recent from public.system_errors where created_at>now()-interval '5 minutes' and details->>'client_hash'=v_client_hash;
 if v_recent>=12 then return jsonb_build_object('ok',false,'rate_limited',true); end if;
 select count(*) into v_duplicate from public.system_errors
 where created_at>now()-interval '5 minutes' and source=v_source and message=v_message and details->>'client_hash'=v_client_hash;
 if v_duplicate=0 then
  insert into public.system_errors(source,message,details)
  values(v_source,v_message,v_details||jsonb_build_object('client_hash',v_client_hash));
 end if;
 return jsonb_build_object('ok',true,'deduplicated',v_duplicate>0);
end;
$$;

create or replace function public.uon_record_security_event(
 p_event_type text,
 p_severity text default 'info',
 p_source text default 'web',
 p_page_path text default null,
 p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 v_headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 v_ip text;
 v_hash text;
 v_count integer;
 v_id bigint;
 v_type text:=lower(trim(coalesce(p_event_type,'')));
 v_source text:=lower(trim(coalesce(p_source,'web')));
 v_severity text:=lower(trim(coalesce(p_severity,'info')));
 v_details jsonb:=coalesce(p_details,'{}'::jsonb)-'password'-'token'-'secret'-'authorization'-'cookie';
begin
 if v_type !~ '^[a-z0-9_.-]{2,80}$' then raise exception 'Invalid event type'; end if;
 if v_source !~ '^[a-z0-9_.-]{2,40}$' then raise exception 'Invalid source'; end if;
 if v_severity not in ('info','low','medium','high','critical') then raise exception 'Invalid severity'; end if;
 if octet_length(v_details::text)>8192 then raise exception 'Details too large'; end if;
 if char_length(coalesce(p_page_path,''))>300 then raise exception 'Page path too long'; end if;
 v_ip:=split_part(coalesce(v_headers->>'x-forwarded-for',v_headers->>'cf-connecting-ip',v_headers->>'x-real-ip','unknown'),',',1);
 v_hash:=encode(extensions.digest(convert_to(trim(v_ip),'UTF8'),'sha256'),'hex');
 if not public.uon_public_rate_allow('security_event',null,40,3600) then return jsonb_build_object('ok',false,'rate_limited',true); end if;
 select count(*) into v_count from public.security_events where client_hash=v_hash and created_at>now()-interval '1 hour';
 if v_count>=30 then return jsonb_build_object('ok',false,'rate_limited',true); end if;
 insert into public.security_events(event_type,severity,source,client_hash,page_path,details)
 values(v_type,v_severity,v_source,v_hash,left(nullif(p_page_path,''),300),v_details)
 returning id into v_id;
 delete from public.security_events where created_at<now()-interval '90 days';
 return jsonb_build_object('ok',true,'id',v_id);
end;
$$;
