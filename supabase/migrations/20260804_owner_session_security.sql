alter table public.owner_sessions
  add column if not exists client_hash text,
  add column if not exists device_label text,
  add column if not exists user_agent text,
  add column if not exists last_seen_at timestamptz not null default now();

create index if not exists owner_sessions_active_idx
  on public.owner_sessions(revoked_at,expires_at,last_seen_at desc);

create or replace function public.cleanup_owner_security_state()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_sessions integer;
  v_otps integer;
begin
  delete from public.owner_sessions
  where expires_at < now()-interval '1 day'
     or revoked_at < now()-interval '7 days';
  get diagnostics v_sessions=row_count;

  delete from public.owner_otp_challenges
  where created_at < now()-interval '1 day';
  get diagnostics v_otps=row_count;

  delete from public.security_events
  where created_at < now()-interval '90 days';

  return jsonb_build_object(
    'ok',true,
    'sessions_deleted',v_sessions,
    'otp_deleted',v_otps
  );
end
$$;

revoke all on function public.cleanup_owner_security_state() from public,anon,authenticated;
grant execute on function public.cleanup_owner_security_state() to service_role;

create or replace function public.owner_session_summary()
returns jsonb
language sql
security definer
set search_path=''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',id,
        'device_label',coalesce(device_label,'جهاز غير معروف'),
        'created_at',created_at,
        'last_seen_at',last_seen_at,
        'expires_at',expires_at,
        'active',(revoked_at is null and expires_at>now())
      ) order by last_seen_at desc
    ),
    '[]'::jsonb
  )
  from public.owner_sessions
  where revoked_at is null and expires_at>now();
$$;

revoke all on function public.owner_session_summary() from public,anon,authenticated;
grant execute on function public.owner_session_summary() to service_role;

create or replace function public.revoke_owner_session(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.owner_sessions
  set revoked_at=now()
  where id=p_session_id and revoked_at is null;
  return found;
end
$$;

revoke all on function public.revoke_owner_session(uuid) from public,anon,authenticated;
grant execute on function public.revoke_owner_session(uuid) to service_role;

create or replace function public.revoke_other_owner_sessions(p_current_hash text)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_count integer;
begin
  update public.owner_sessions
  set revoked_at=now()
  where token_hash<>p_current_hash
    and revoked_at is null
    and expires_at>now();
  get diagnostics v_count=row_count;
  return v_count;
end
$$;

revoke all on function public.revoke_other_owner_sessions(text) from public,anon,authenticated;
grant execute on function public.revoke_other_owner_sessions(text) to service_role;
