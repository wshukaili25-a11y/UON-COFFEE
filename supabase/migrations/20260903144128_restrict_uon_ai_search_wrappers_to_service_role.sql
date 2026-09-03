revoke execute on function public.uon_ai_search_fast(text,integer) from public, anon, authenticated;
revoke execute on function public.uon_ai_building_search(text,integer) from public, anon, authenticated;
revoke execute on function public.uon_ai_staff_search(text,integer) from public, anon, authenticated;

grant execute on function public.uon_ai_search_fast(text,integer) to service_role;
grant execute on function public.uon_ai_building_search(text,integer) to service_role;
grant execute on function public.uon_ai_staff_search(text,integer) to service_role;
