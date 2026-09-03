alter table public.uon_ai_schedule_snapshots add column if not exists client_token_hash text;

update public.uon_ai_schedule_snapshots s
set client_token_hash=c.client_token_hash
from public.uon_ai_conversations c
where c.session_id=s.session_id
  and nullif(c.client_token_hash,'') is not null
  and s.client_token_hash is null;

create or replace function public.uon_ai_sync_schedule(p_session_id uuid,p_client_token text,p_schedule jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_allowed boolean:=false;
  v_count int:=0;
  v_hash text;
  v_existing_hash text;
begin
 if p_session_id is null or octet_length(coalesce(p_client_token,'')) not between 16 and 200 then raise exception 'invalid_session'; end if;
 v_hash:=encode(extensions.digest(convert_to(trim(p_client_token),'UTF8'),'sha256'),'hex');
 select client_token_hash into v_existing_hash from public.uon_ai_schedule_snapshots where session_id=p_session_id;
 if nullif(v_existing_hash,'') is not null and v_existing_hash<>v_hash then raise exception 'session_not_allowed'; end if;
 select allowed into v_allowed from public.uon_ai_bind_conversation_client(p_session_id,p_client_token) limit 1;
 if not coalesce(v_allowed,false) then raise exception 'session_not_allowed'; end if;
 if jsonb_typeof(p_schedule)<>'array' or jsonb_array_length(p_schedule)>80 then raise exception 'invalid_schedule'; end if;
 if octet_length(p_schedule::text)>100000 then raise exception 'schedule_too_large'; end if;
 select count(*) into v_count from jsonb_array_elements(p_schedule) x
 where char_length(coalesce(x->>'course','')) between 1 and 40
   and coalesce(x->>'day','') in ('الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس')
   and coalesce(x->>'start','')~'^[0-9]{2}:[0-9]{2}$'
   and coalesce(x->>'end','')~'^[0-9]{2}:[0-9]{2}$'
   and char_length(coalesce(x->>'room',''))<=50
   and char_length(coalesce(x->>'teacher',''))<=100
   and char_length(coalesce(x->>'type',''))<=20;
 if v_count<>jsonb_array_length(p_schedule) then raise exception 'invalid_schedule_rows'; end if;
 if not public.uon_public_rate_allow('ai_schedule_sync',p_session_id::text,30,3600) then raise exception 'rate_limited'; end if;
 insert into public.uon_ai_schedule_snapshots(session_id,schedule,client_token_hash,updated_at)
 values(p_session_id,p_schedule,v_hash,now())
 on conflict(session_id) do update set schedule=excluded.schedule,client_token_hash=coalesce(public.uon_ai_schedule_snapshots.client_token_hash,excluded.client_token_hash),updated_at=now();
 return jsonb_build_object('ok',true,'classes',v_count);
end;
$$;

create or replace function public.uon_ai_get_schedule_analysis(p_session_id uuid,p_client_token text)
returns table(metric text,value text,details jsonb)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_hash text;
  v_existing_hash text;
  v_allowed boolean:=false;
begin
 if p_session_id is null or octet_length(coalesce(p_client_token,'')) not between 16 and 200 then raise exception 'session_not_allowed'; end if;
 v_hash:=encode(extensions.digest(convert_to(trim(p_client_token),'UTF8'),'sha256'),'hex');
 select client_token_hash into v_existing_hash from public.uon_ai_schedule_snapshots where session_id=p_session_id;
 if v_existing_hash is null then
   select allowed into v_allowed from public.uon_ai_bind_conversation_client(p_session_id,p_client_token) limit 1;
   if not coalesce(v_allowed,false) then raise exception 'session_not_allowed'; end if;
   update public.uon_ai_schedule_snapshots set client_token_hash=v_hash where session_id=p_session_id and client_token_hash is null;
 elsif v_existing_hash<>v_hash then
   raise exception 'session_not_allowed';
 end if;
 if not public.uon_public_rate_allow('ai_schedule_analysis',p_session_id::text,120,3600) then raise exception 'rate_limited'; end if;
 return query select * from public.uon_ai_get_schedule_analysis_core_v1(p_session_id,p_client_token);
end;
$$;
