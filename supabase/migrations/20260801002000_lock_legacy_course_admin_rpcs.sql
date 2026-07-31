revoke all on function public.uon_admin_course_health(text) from public, anon, authenticated;
grant execute on function public.uon_admin_course_health(text) to service_role;

revoke all on function public.uon_admin_delete_course(text,uuid) from public, anon, authenticated;
grant execute on function public.uon_admin_delete_course(text,uuid) to service_role;

revoke all on function public.uon_admin_save_course(text,uuid,jsonb,uuid[]) from public, anon, authenticated;
grant execute on function public.uon_admin_save_course(text,uuid,jsonb,uuid[]) to service_role;
