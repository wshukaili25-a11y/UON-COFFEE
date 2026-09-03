create or replace function public.uon_ai_gap_category(p_question text)
returns text
language sql
immutable
set search_path=''
as $$
 with q as (select left(coalesce(p_question,''),800) s)
 select case
  when q.s ~* '(موظف|دكتور|استاذ|أستاذ|مدير|عميد|مرشد|ايميل|إيميل|هاتف|رقم|مكتب|employee|staff|director|dean|advisor)' then 'people'
  when q.s ~* '(تسجيل|حذف|اضاف|إضاف|رسوم|eduwave|منظوم)' then 'registration'
  when q.s ~* '(تقويم|متى|فصل|دراس|اختبار|امتحان|اجاز|إجاز)' then 'calendar'
  when q.s ~* '(مقرر|مادة|مساق|course|[A-Za-z]{4}[0-9]{3})' then 'course'
  when q.s ~* '(قروب|جروب|واتساب|مجموعة)' then 'groups'
  when q.s ~* '(ملخص|اختبار سابق|فاينل|ميد)' then 'summaries'
  when q.s ~* '(تخصص|برنامج|كلية|قسم)' then 'programs'
  else 'general' end
 from q;
$$;

create or replace function public.uon_ai_resolve_followup(p_question text,p_previous_question text)
returns text
language sql
immutable
set search_path=''
as $$
 with q as (
  select left(trim(coalesce(p_question,'')),800) current_q,
         left(trim(coalesce(p_previous_question,'')),800) previous_q
 ), normalized as (
  select q.*,
         trim(regexp_replace(
           translate(lower(q.current_q),'أإآةىؤئ','اااهيوي'),
           '[^[:alnum:]\u0600-\u06FF]+',' ','g'
         )) current_n
  from q
 )
 select case
   when normalized.current_n ~ '^(اشرح|اشرحي|وضح|وضحي|كيف|الطريقه|طريقه|طريقة|التفاصيل|كمل|كملي)( |$)'
     and length(normalized.previous_q)>2
   then normalized.previous_q||' '||normalized.current_q
   else normalized.current_q
 end
 from normalized;
$$;

create or replace function public.uon_ai_source_hint(p_category text)
returns text
language sql
immutable
set search_path=''
as $$
 select case left(lower(trim(coalesce(p_category,''))),40)
  when 'people' then 'University of Nizwa official staff directory'
  when 'registration' then 'University of Nizwa official registration/admission pages'
  when 'calendar' then 'University of Nizwa official academic calendar'
  when 'course' then 'University of Nizwa official course/program information'
  when 'programs' then 'University of Nizwa official academic programs pages'
  else 'University of Nizwa official website' end;
$$;

create or replace function public.send_anonymous_message(p_handle text,p_body text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_profile public.anonymous_profiles%rowtype;
  v_id uuid;
  v_body text;
  v_client_hash text:=public.uon_anonymous_client_hash();
  v_recent integer;
  v_target_recent integer;
  v_handle text;
begin
  if octet_length(coalesce(p_handle,''))>80 or lower(trim(coalesce(p_handle,''))) !~ '^[a-z0-9_]{3,24}$' then raise exception 'الحساب غير موجود'; end if;
  if octet_length(coalesce(p_body,''))>2000 then raise exception 'الرسالة أطول من الحد المسموح'; end if;
  v_handle:=lower(trim(p_handle));
  v_body:=trim(coalesce(p_body,''));
  select * into v_profile from public.anonymous_profiles where handle=v_handle and is_active=true;
  if v_profile.id is null then raise exception 'الحساب غير موجود'; end if;
  if not v_profile.inbox_open then raise exception 'صندوق الرسائل مغلق حاليًا'; end if;
  if char_length(v_body) not between 2 and 500 then raise exception 'الرسالة يجب أن تكون بين 2 و500 حرف'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_client_hash,0));
  select count(*) into v_recent from public.anonymous_action_limits
  where client_hash=v_client_hash and action='send_message' and created_at>now()-interval '5 minutes';
  if v_recent>=15 then raise exception 'تم إرسال رسائل كثيرة، حاول بعد قليل'; end if;
  select count(*) into v_target_recent from public.anonymous_action_limits
  where client_hash=v_client_hash and action='send_message' and target_key=v_profile.id::text and created_at>now()-interval '10 minutes';
  if v_target_recent>=8 then raise exception 'تم إرسال رسائل كثيرة لهذا الحساب، حاول لاحقًا'; end if;
  insert into public.anonymous_messages(recipient_id,body,sender_hash) values(v_profile.id,v_body,v_client_hash) returning id into v_id;
  insert into public.anonymous_action_limits(client_hash,action,target_key,success) values(v_client_hash,'send_message',v_profile.id::text,true);
  delete from public.anonymous_action_limits where created_at<now()-interval '7 days';
  return jsonb_build_object('ok',true,'id',v_id,'sent',true);
end;
$$;

create or replace function public.report_anonymous_message(p_message_id uuid,p_reason text default 'محتوى غير مناسب',p_fingerprint text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_client_hash text:=public.uon_anonymous_client_hash();
  v_recent integer;
  v_report_id uuid;
  v_reports_count integer;
  v_status text;
begin
  if p_message_id is null then raise exception 'الرسالة غير صالحة'; end if;
  if octet_length(coalesce(p_reason,''))>1000 or octet_length(coalesce(p_fingerprint,''))>500 then raise exception 'بيانات البلاغ طويلة جدًا'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_client_hash,0));
  select count(*) into v_recent from public.anonymous_action_limits
  where client_hash=v_client_hash and action='report_message' and created_at>now()-interval '1 hour';
  if v_recent>=20 then raise exception 'تم إرسال بلاغات كثيرة، حاول لاحقًا'; end if;
  if not exists(select 1 from public.anonymous_messages where id=p_message_id and status='published') then raise exception 'الرسالة غير متاحة للبلاغ'; end if;
  insert into public.anonymous_message_reports(message_id,reason,fingerprint,client_hash)
  values(p_message_id,left(coalesce(nullif(trim(p_reason),''),'محتوى غير مناسب'),120),left(nullif(trim(coalesce(p_fingerprint,'')),''),120),v_client_hash)
  on conflict (message_id,client_hash) where client_hash is not null do nothing returning id into v_report_id;
  insert into public.anonymous_action_limits(client_hash,action,target_key,success) values(v_client_hash,'report_message',p_message_id::text,v_report_id is not null);
  delete from public.anonymous_action_limits where created_at<now()-interval '7 days';
  if v_report_id is null then
    select reports_count,status into v_reports_count,v_status from public.anonymous_messages where id=p_message_id;
    return jsonb_build_object('ok',true,'duplicate',true,'reports_count',coalesce(v_reports_count,0),'status',v_status);
  end if;
  update public.anonymous_messages set reports_count=reports_count+1,status=case when reports_count+1>=3 then 'hidden' else status end
  where id=p_message_id and status='published' returning reports_count,status into v_reports_count,v_status;
  return jsonb_build_object('ok',true,'duplicate',false,'reports_count',v_reports_count,'status',v_status);
end;
$$;
