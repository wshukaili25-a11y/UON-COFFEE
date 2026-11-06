-- UON Hub 2026-11-06: revoke public (anon/authenticated) EXECUTE on SECURITY DEFINER
-- RPCs that no page or edge function calls. service_role keeps access.
-- Reversible: `grant execute on function <sig> to anon;`
do $$
declare f text;
begin
  foreach f in array array[
    'public.create_anonymous_profile(text,text,text)',
    'public.get_anonymous_profile(text)',
    'public.send_anonymous_message(text,text)',
    'public.get_anonymous_inbox(text,text)',
    'public.manage_anonymous_message(text,text,uuid,text,text)',
    'public.update_anonymous_profile(text,text,text,text,boolean)',
    'public.report_anonymous_message(uuid,text,text)',
    'public.uon_ai_get_schedule_analysis(uuid,text)',
    'public.uon_ai_schedule_search(text,integer)',
    'public.uon_catalog_version()',
    'public.uon_global_search_v42(text,integer,text)',
    'public.uon_platform_stats()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
