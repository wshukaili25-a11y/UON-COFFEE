-- Opt-in mailing list for UON Hub announcements.
-- Only students who tick the (unchecked by default) consent box AND confirm the
-- OTP are added. Oman PDPL requires explicit consent before marketing email and
-- a free, immediate way to stop it, so consent and withdrawal are both recorded.
alter table public.summary_email_requests add column if not exists marketing_opt_in boolean not null default false;

create table if not exists public.email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and length(email) <= 254),
  name text,
  source text not null check (source in ('summary','schedule')),
  consent_text text not null,
  consented_at timestamptz not null default now(),
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.email_subscribers enable row level security;
revoke all on public.email_subscribers from anon, authenticated;
comment on table public.email_subscribers is 'Opt-in announcement list (explicit consent + OTP-verified). Service role only. Never email rows with unsubscribed_at set.';

create or replace function public.uon_email_claim(p_id uuid, p_hash text)
 returns jsonb language plpgsql set search_path to '' as $function$
declare r public.summary_email_requests;
begin
 select * into r from public.summary_email_requests where id=p_id for update;
 if not found or r.state<>'pending' or r.expires_at<now() or r.attempts>=5 then return null; end if;
 update public.summary_email_requests set attempts=attempts+1 where id=p_id;
 if r.otp_hash<>p_hash then return null; end if;
 update public.summary_email_requests set state='sending',otp_hash='',payload=null where id=p_id;
 return jsonb_build_object('kind',r.kind,'summary_id',r.summary_id,'payload',r.payload,'email',r.email,'name',r.name,'marketing_opt_in',r.marketing_opt_in);
end $function$;

-- Re-subscribing after an unsubscribe is a fresh consent, so it clears unsubscribed_at.
create or replace function public.uon_email_subscribe(p_email text, p_name text, p_source text, p_consent text)
 returns uuid language plpgsql set search_path to '' as $function$
declare tok uuid;
begin
 insert into public.email_subscribers(email,name,source,consent_text)
 values(lower(trim(p_email)),left(p_name,80),p_source,p_consent)
 on conflict (email) do update set name=excluded.name,consent_text=excluded.consent_text,consented_at=now(),unsubscribed_at=null
 returning unsubscribe_token into tok;
 return tok;
end $function$;

create or replace function public.uon_email_unsubscribe(p_token uuid)
 returns boolean language plpgsql set search_path to '' as $function$
begin
 update public.email_subscribers set unsubscribed_at=coalesce(unsubscribed_at,now()) where unsubscribe_token=p_token;
 return found;
end $function$;

revoke all on function public.uon_email_subscribe(text,text,text,text) from public, anon, authenticated;
revoke all on function public.uon_email_unsubscribe(uuid) from public, anon, authenticated;
revoke all on function public.uon_email_claim(uuid,text) from public, anon, authenticated;
grant execute on function public.uon_email_subscribe(text,text,text,text), public.uon_email_unsubscribe(uuid), public.uon_email_claim(uuid,text) to service_role;
grant all on public.email_subscribers to service_role;
