-- UON AI 2026-11-06
-- 1) uon_ai_rate_limit deleted old windows on every call; concurrent requests could
--    contend on the same rows and the edge function then returned 503
--    (rate_limit_unavailable). Prune on ~5% of calls instead.
create or replace function public.uon_ai_rate_limit(p_client_key text, p_window_start timestamp with time zone, p_limit integer default 12)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  insert into public.ai_rate_limits(client_key,window_start,request_count,updated_at)
  values(left(coalesce(p_client_key,''),300),p_window_start,1,now())
  on conflict(client_key,window_start)
  do update set request_count=public.ai_rate_limits.request_count+1,updated_at=now()
  returning request_count into v_count;

  if random() < 0.05 then
    begin
      delete from public.ai_rate_limits where window_start < now()-interval '10 minutes';
    exception when others then null; -- pruning is best-effort
    end;
  end if;

  return jsonb_build_object(
    'allowed',v_count<=greatest(coalesce(p_limit,12),1),
    'count',v_count,
    'retry_after',greatest(1,ceil(extract(epoch from (p_window_start+interval '1 minute'-now())))::integer)
  );
end;
$function$;

-- 2) Close knowledge gaps that the current assistant now answers
--    (greetings are handled by greetingReply; Anjiz head via staff lookup;
--    study files and registration via UON Hub tool cards).
update public.uon_ai_knowledge_gaps
set status='resolved', resolved_at=now(), updated_at=now(),
    resolution_reason='2026-11-06: verified answered by uon-ai-chat-v64 (greetings, staff-title routing, UON Hub tool cards)'
where status in ('open','improving')
  and normalized_topic in ('حيك','اهلين','اهلاً','من مدير مركز انجز ؟','مركز انجز وليس انجاز','اريد شروحات','كيف اسجل المقررات','كيف اعرف مرشدي الاكاديمي');
