alter function public.uon_ai_building_search(text,integer) rename to uon_ai_building_search_core_v1;
revoke all on function public.uon_ai_building_search_core_v1(text,integer) from public,anon,authenticated;
grant execute on function public.uon_ai_building_search_core_v1(text,integer) to service_role;
create function public.uon_ai_building_search(p_query text,p_limit integer default 8)
returns table(type text,title text,description text,url text,official boolean,score numeric)
language sql stable security definer set search_path=''
as $$
 select * from public.uon_ai_building_search_core_v1(left(trim(coalesce(p_query,'')),240),greatest(1,least(coalesce(p_limit,8),20)));
$$;
revoke all on function public.uon_ai_building_search(text,integer) from public,authenticated;
grant execute on function public.uon_ai_building_search(text,integer) to anon,service_role;

alter function public.uon_ai_staff_search(text,integer) rename to uon_ai_staff_search_core_v1;
revoke all on function public.uon_ai_staff_search_core_v1(text,integer) from public,anon,authenticated;
grant execute on function public.uon_ai_staff_search_core_v1(text,integer) to service_role;
create function public.uon_ai_staff_search(p_query text,p_limit integer default 8)
returns table(full_name text,job_title text,department text,college text,phone text,extension text,email text,office_location text,source_url text,score integer)
language sql stable security definer set search_path=''
as $$
 select * from public.uon_ai_staff_search_core_v1(left(trim(coalesce(p_query,'')),240),greatest(1,least(coalesce(p_limit,8),20)));
$$;
revoke all on function public.uon_ai_staff_search(text,integer) from public,authenticated;
grant execute on function public.uon_ai_staff_search(text,integer) to anon,service_role;

alter function public.uon_ai_search_fast(text,integer) rename to uon_ai_search_fast_core_v1;
revoke all on function public.uon_ai_search_fast_core_v1(text,integer) from public,anon,authenticated;
grant execute on function public.uon_ai_search_fast_core_v1(text,integer) to service_role;
create function public.uon_ai_search_fast(p_question text,p_limit integer default 14)
returns table(type text,title text,description text,url text,official boolean,score numeric)
language sql stable security definer set search_path=''
as $$
 select * from public.uon_ai_search_fast_core_v1(left(trim(coalesce(p_question,'')),800),greatest(1,least(coalesce(p_limit,14),30)));
$$;
revoke all on function public.uon_ai_search_fast(text,integer) from public,authenticated;
grant execute on function public.uon_ai_search_fast(text,integer) to anon,service_role;

alter function public.uon_global_search_v42(text,integer,text) rename to uon_global_search_v42_core_v1;
revoke all on function public.uon_global_search_v42_core_v1(text,integer,text) from public,anon,authenticated;
grant execute on function public.uon_global_search_v42_core_v1(text,integer,text) to service_role;
create function public.uon_global_search_v42(p_query text,p_limit integer default 30,p_language text default 'ar')
returns table(result_type text,result_id text,title text,subtitle text,url text,score numeric,meta jsonb)
language sql stable security definer set search_path=''
as $$
 select * from public.uon_global_search_v42_core_v1(
   left(trim(coalesce(p_query,'')),240),
   greatest(1,least(coalesce(p_limit,30),80)),
   case when lower(trim(coalesce(p_language,'ar')))='en' then 'en' else 'ar' end
 );
$$;
revoke all on function public.uon_global_search_v42(text,integer,text) from public,authenticated;
grant execute on function public.uon_global_search_v42(text,integer,text) to anon,service_role;

alter function public.uon_global_search_v44(text,integer,text) rename to uon_global_search_v44_core_v1;
revoke all on function public.uon_global_search_v44_core_v1(text,integer,text) from public,anon,authenticated;
grant execute on function public.uon_global_search_v44_core_v1(text,integer,text) to service_role;
create function public.uon_global_search_v44(p_query text,p_limit integer default 40,p_language text default 'ar')
returns table(result_type text,result_id text,title text,subtitle text,url text,score numeric,meta jsonb)
language sql stable security definer set search_path=''
as $$
 select * from public.uon_global_search_v44_core_v1(
   left(trim(coalesce(p_query,'')),240),
   greatest(1,least(coalesce(p_limit,40),100)),
   case when lower(trim(coalesce(p_language,'ar')))='en' then 'en' else 'ar' end
 );
$$;
revoke all on function public.uon_global_search_v44(text,integer,text) from public,authenticated;
grant execute on function public.uon_global_search_v44(text,integer,text) to anon,service_role;

alter function public.uon_confessions_feed(text,text,integer) rename to uon_confessions_feed_core_v1;
revoke all on function public.uon_confessions_feed_core_v1(text,text,integer) from public,anon,authenticated;
grant execute on function public.uon_confessions_feed_core_v1(text,text,integer) to service_role;
create function public.uon_confessions_feed(p_sort text default 'latest',p_college text default null,p_limit integer default 50)
returns table(id uuid,text text,college text,program text,created_at timestamptz,reactions jsonb,comments_count bigint)
language sql stable security definer set search_path=''
as $$
 select * from public.uon_confessions_feed_core_v1(
   case when lower(trim(coalesce(p_sort,'latest')))='popular' then 'popular' else 'latest' end,
   nullif(left(trim(coalesce(p_college,'')),120),''),
   greatest(1,least(coalesce(p_limit,50),100))
 );
$$;
revoke all on function public.uon_confessions_feed(text,text,integer) from public,authenticated;
grant execute on function public.uon_confessions_feed(text,text,integer) to anon,service_role;

alter function public.uon_course_hub_v65(text,text) rename to uon_course_hub_v65_core_v1;
revoke all on function public.uon_course_hub_v65_core_v1(text,text) from public,anon,authenticated;
grant execute on function public.uon_course_hub_v65_core_v1(text,text) to service_role;
create function public.uon_course_hub_v65(p_code text,p_language text default 'ar')
returns jsonb
language sql stable security definer set search_path=''
as $$
 select public.uon_course_hub_v65_core_v1(
   left(trim(coalesce(p_code,'')),32),
   case when lower(trim(coalesce(p_language,'ar')))='en' then 'en' else 'ar' end
 );
$$;
revoke all on function public.uon_course_hub_v65(text,text) from public,authenticated;
grant execute on function public.uon_course_hub_v65(text,text) to anon,service_role;

alter function public.uon_summary_rating_stats(text[]) rename to uon_summary_rating_stats_core_v1;
revoke all on function public.uon_summary_rating_stats_core_v1(text[]) from public,anon,authenticated;
grant execute on function public.uon_summary_rating_stats_core_v1(text[]) to service_role;
create function public.uon_summary_rating_stats(p_ids text[])
returns table(resource_id text,average numeric,total bigint,recommended_percent numeric,stars jsonb,comments jsonb)
language sql stable security definer set search_path=''
as $$
 select * from public.uon_summary_rating_stats_core_v1(
   array(select left(x,100) from unnest(coalesce(p_ids,array[]::text[])) x where x is not null limit 100)
 );
$$;
revoke all on function public.uon_summary_rating_stats(text[]) from public,authenticated;
grant execute on function public.uon_summary_rating_stats(text[]) to anon,service_role;

alter function public.uon_public_announcements(text,text) rename to uon_public_announcements_core_v1;
revoke all on function public.uon_public_announcements_core_v1(text,text) from public,anon,authenticated;
grant execute on function public.uon_public_announcements_core_v1(text,text) to service_role;
create function public.uon_public_announcements(p_college text default null,p_feature text default null)
returns setof public.site_announcements
language sql stable security definer set search_path=''
as $$
 select * from public.uon_public_announcements_core_v1(
   nullif(left(trim(coalesce(p_college,'')),120),''),
   nullif(left(trim(coalesce(p_feature,'')),120),'')
 ) limit 100;
$$;
revoke all on function public.uon_public_announcements(text,text) from public,authenticated;
grant execute on function public.uon_public_announcements(text,text) to anon,service_role;

alter function public.uon_public_tool_catalog(text) rename to uon_public_tool_catalog_core_v1;
revoke all on function public.uon_public_tool_catalog_core_v1(text) from public,anon,authenticated;
grant execute on function public.uon_public_tool_catalog_core_v1(text) to service_role;
create function public.uon_public_tool_catalog(p_college text default null)
returns jsonb
language sql stable security definer set search_path=''
as $$
 select public.uon_public_tool_catalog_core_v1(nullif(left(trim(coalesce(p_college,'')),120),''));
$$;
revoke all on function public.uon_public_tool_catalog(text) from public,authenticated;
grant execute on function public.uon_public_tool_catalog(text) to anon,service_role;

alter function public.uon_ai_get_schedule_analysis(uuid,text) rename to uon_ai_get_schedule_analysis_core_v1;
revoke all on function public.uon_ai_get_schedule_analysis_core_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.uon_ai_get_schedule_analysis_core_v1(uuid,text) to service_role;
create function public.uon_ai_get_schedule_analysis(p_session_id uuid,p_client_token text)
returns table(metric text,value text,details jsonb)
language plpgsql stable security definer set search_path=''
as $$
begin
 if p_session_id is null or octet_length(coalesce(p_client_token,'')) not between 16 and 512 then
   raise exception 'session_not_allowed';
 end if;
 return query select * from public.uon_ai_get_schedule_analysis_core_v1(p_session_id,p_client_token);
end;
$$;
revoke all on function public.uon_ai_get_schedule_analysis(uuid,text) from public,authenticated;
grant execute on function public.uon_ai_get_schedule_analysis(uuid,text) to anon,service_role;
