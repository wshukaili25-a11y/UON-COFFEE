create or replace function public.uon_request_client_hash()
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  v_ip text;
  v_agent text;
  v_lang text;
  v_raw text;
begin
  v_ip:=nullif(trim(coalesce(
    nullif(v_headers->>'cf-connecting-ip',''),
    nullif(v_headers->>'x-real-ip',''),
    nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for',''),',',1)),''),
    ''
  )), '');
  v_agent:=left(coalesce(v_headers->>'user-agent',''),240);
  v_lang:=left(coalesce(v_headers->>'accept-language',''),80);
  v_raw:=concat(coalesce(v_ip,'unknown'),'|',v_agent,'|',v_lang);
  return encode(extensions.digest(convert_to(v_raw,'UTF8'),'sha256'),'hex');
end;
$$;
revoke all on function public.uon_request_client_hash() from public,anon,authenticated;
grant execute on function public.uon_request_client_hash() to service_role;

create or replace function public.uon_anonymous_client_hash()
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  v_ip text;
  v_fallback text;
begin
  v_ip:=nullif(trim(coalesce(
    nullif(v_headers->>'cf-connecting-ip',''),
    nullif(v_headers->>'x-real-ip',''),
    nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for',''),',',1)),''),
    ''
  )), '');
  v_fallback:=concat('unknown|',left(coalesce(v_headers->>'user-agent',''),240),'|',left(coalesce(v_headers->>'accept-language',''),80));
  return encode(extensions.digest(convert_to(coalesce(v_ip,v_fallback),'UTF8'),'sha256'),'hex');
end;
$$;
revoke all on function public.uon_anonymous_client_hash() from public,anon,authenticated;
grant execute on function public.uon_anonymous_client_hash() to service_role;

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
 v_client_hash text:=public.uon_request_client_hash();
 v_recent integer;
 v_duplicate integer;
 v_details jsonb:=coalesce(p_details,'{}'::jsonb)-'password'-'token'-'secret'-'authorization'-'cookie';
begin
 if char_length(v_message)<3 then raise exception 'invalid error message'; end if;
 if v_source !~ '^[A-Za-z0-9_.:/-]{2,80}$' then raise exception 'invalid error source'; end if;
 if octet_length(v_details::text)>8192 then raise exception 'details too large'; end if;
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
 v_hash text:=public.uon_request_client_hash();
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
