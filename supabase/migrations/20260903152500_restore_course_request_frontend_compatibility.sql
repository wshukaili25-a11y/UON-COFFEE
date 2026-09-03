-- Compatibility wrapper for the current course page payload.
-- Delegates validation and rate limiting to the canonical six-argument RPC.
create or replace function public.uon_submit_course_content_request(
  p_course_code text,
  p_request_type text,
  p_details text,
  p_session_id uuid
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.uon_submit_course_content_request(
    p_code => p_course_code,
    p_content_type => p_request_type,
    p_description => p_details,
    p_contact => null,
    p_page_url => null,
    p_session_id => p_session_id
  );
$$;

revoke all on function public.uon_submit_course_content_request(text,text,text,uuid) from public;
grant execute on function public.uon_submit_course_content_request(text,text,text,uuid) to anon,authenticated,service_role;
