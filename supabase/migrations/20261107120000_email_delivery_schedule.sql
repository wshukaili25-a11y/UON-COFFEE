-- Email delivery: support schedules alongside summaries. Additive and backward compatible.
alter table public.summary_email_requests add column if not exists kind text not null default 'summary';
alter table public.summary_email_requests add column if not exists payload jsonb;
alter table public.summary_email_requests alter column summary_id drop not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='summary_email_requests_kind_check') then
  alter table public.summary_email_requests add constraint summary_email_requests_kind_check
   check (kind in ('summary','schedule') and (kind<>'summary' or summary_id is not null) and (kind<>'schedule' or (payload is not null or state<>'pending')) and (payload is null or pg_column_size(payload)<=32768));
 end if;
end $$;

create or replace function public.uon_email_request_v2(p_id uuid,p_kind text,p_summary uuid,p_payload jsonb,p_email text,p_name text,p_hash text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_kind not in ('summary','schedule') then return false; end if;
 perform pg_advisory_xact_lock(617203);
 delete from public.summary_email_requests where created_at < now()-interval '24 hours';
 if (select count(*) from public.summary_email_requests where created_at>now()-interval '1 hour')>=100
 or (select count(*) from public.summary_email_requests where email=p_email and created_at>now()-interval '1 hour')>=3
 or exists(select 1 from public.summary_email_requests where email=p_email and created_at>now()-interval '60 seconds') then return false; end if;
 insert into public.summary_email_requests(id,kind,summary_id,payload,email,name,otp_hash,expires_at)
 values(p_id,p_kind,case when p_kind='summary' then p_summary end,case when p_kind='schedule' then p_payload end,p_email,p_name,p_hash,now()+interval '10 minutes');
 return true;
end $$;

create or replace function public.uon_email_request(p_id uuid,p_summary uuid,p_email text,p_name text,p_hash text) returns boolean language sql security invoker set search_path='' as $$
 select public.uon_email_request_v2(p_id,'summary',p_summary,null,p_email,p_name,p_hash)
$$;

create or replace function public.uon_email_claim(p_id uuid,p_hash text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.summary_email_requests;
begin
 select * into r from public.summary_email_requests where id=p_id for update;
 if not found or r.state<>'pending' or r.expires_at<now() or r.attempts>=5 then return null; end if;
 update public.summary_email_requests set attempts=attempts+1 where id=p_id;
 if r.otp_hash<>p_hash then return null; end if;
 update public.summary_email_requests set state='sending',otp_hash='',payload=null where id=p_id;
 return jsonb_build_object('kind',r.kind,'summary_id',r.summary_id,'payload',r.payload,'email',r.email,'name',r.name);
end $$;

revoke all on function public.uon_email_request_v2(uuid,text,uuid,jsonb,text,text,text),public.uon_email_request(uuid,uuid,text,text,text),public.uon_email_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.uon_email_request_v2(uuid,text,uuid,jsonb,text,text,text),public.uon_email_request(uuid,uuid,text,text,text),public.uon_email_claim(uuid,text) to service_role;
