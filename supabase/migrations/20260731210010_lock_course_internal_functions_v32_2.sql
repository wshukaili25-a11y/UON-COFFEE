revoke all on function public.admin_upsert_course_with_programs(jsonb,uuid[],text) from public, anon, authenticated;
grant execute on function public.admin_upsert_course_with_programs(jsonb,uuid[],text) to service_role;

revoke all on function public.normalize_course_academic_fields() from public, anon, authenticated;
grant execute on function public.normalize_course_academic_fields() to service_role;

revoke all on function public.sync_course_program_links_from_department() from public, anon, authenticated;
grant execute on function public.sync_course_program_links_from_department() to service_role;
