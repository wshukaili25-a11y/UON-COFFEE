revoke execute on function public.sync_owner_session_compat_columns() from public, anon, authenticated;
revoke execute on function public.uon_normalize_confession() from public, anon, authenticated;
revoke execute on function public.uon_touch_updated_at() from public, anon, authenticated;

revoke execute on function public.uon_ai_gap_category(text) from public, anon, authenticated;
revoke execute on function public.uon_ai_resolve_followup(text,text) from public, anon, authenticated;
revoke execute on function public.uon_ai_source_hint(text) from public, anon, authenticated;

grant execute on function public.uon_ai_gap_category(text) to service_role;
grant execute on function public.uon_ai_resolve_followup(text,text) to service_role;
grant execute on function public.uon_ai_source_hint(text) to service_role;
