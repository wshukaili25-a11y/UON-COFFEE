alter function public.uon_ai_source_hint(text) set search_path = public, extensions;
alter function public.uon_ai_gap_category(text) set search_path = public, extensions;
alter function public.uon_ai_resolve_followup(text,text) set search_path = public, extensions;

revoke execute on function public.sync_legacy_tool_to_registry() from public, anon, authenticated;
revoke execute on function public.uon_ai_feedback_learning_trigger() from public, anon, authenticated;
revoke execute on function public.uon_ai_handoff_learning_trigger() from public, anon, authenticated;
revoke execute on function public.uon_ai_learn_from_feedback() from public, anon, authenticated;
revoke execute on function public.uon_ai_learn_from_question() from public, anon, authenticated;
revoke execute on function public.uon_ai_queue_on_gap_change() from public, anon, authenticated;
revoke execute on function public.uon_ai_track_negative_gap() from public, anon, authenticated;
revoke execute on function public.uon_ai_track_question_gap() from public, anon, authenticated;
revoke execute on function public.uon_trigger_confession_ai_alert() from public, anon, authenticated;
revoke execute on function public.uon_queue_moderation_review(text,text,text) from public, anon, authenticated;

grant execute on function public.sync_legacy_tool_to_registry() to service_role;
grant execute on function public.uon_ai_feedback_learning_trigger() to service_role;
grant execute on function public.uon_ai_handoff_learning_trigger() to service_role;
grant execute on function public.uon_ai_learn_from_feedback() to service_role;
grant execute on function public.uon_ai_learn_from_question() to service_role;
grant execute on function public.uon_ai_queue_on_gap_change() to service_role;
grant execute on function public.uon_ai_track_negative_gap() to service_role;
grant execute on function public.uon_ai_track_question_gap() to service_role;
grant execute on function public.uon_trigger_confession_ai_alert() to service_role;
grant execute on function public.uon_queue_moderation_review(text,text,text) to service_role;
