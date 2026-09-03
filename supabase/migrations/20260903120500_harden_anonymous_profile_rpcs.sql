create or replace function public.create_anonymous_profile(p_handle text,p_display_name text,p_secret text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_handle text:=lower(trim(coalesce(p_handle,'')));
  v_name text:=trim(coalesce(p_display_name,''));
  v_client_hash text:=public.uon_anonymous_client_hash();
  v_recent integer;
  v_id uuid;
begin
  if octet_length(coalesce(p_handle,''))>80 or octet_length(coalesce(p_display_name,''))>200 then raise exception 'بيانات الحساب طويلة جدًا'; end if;
  if v_handle !~ '^[a-z0-9_]{3,24}$' then raise exception 'اسم الرابط يجب أن يكون 3-24 حرفًا إنجليزيًا أو رقمًا'; end if;
  if char_length(v_name) not between 2 and 40 then raise exception 'الاسم غير صالح'; end if;
  if octet_length(coalesce(p_secret,'')) not between 24 and 512 then raise exception 'مفتاح الحماية غير صالح'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_client_hash,0));
  select count(*) into v_recent from public.anonymous_action_limits
  where client_hash=v_client_hash and action='create_profile' and created_at>now()-interval '24 hours';
  if v_recent>=5 then return jsonb_build_object('ok',false,'error','تم الوصول للحد المؤقت لإنشاء الحسابات','rate_limited',true); end if;
  insert into public.anonymous_profiles(handle,display_name,secret_hash,creator_hash)
  values(v_handle,v_name,encode(extensions.digest(convert_to(p_secret,'UTF8'),'sha256'),'hex'),v_client_hash)
  on conflict(handle) do nothing returning id into v_id;
  insert into public.anonymous_action_limits(client_hash,action,target_key,success)
  values(v_client_hash,'create_profile',coalesce(v_id::text,v_handle),v_id is not null);
  delete from public.anonymous_action_limits where created_at<now()-interval '7 days';
  if v_id is null then return jsonb_build_object('ok',false,'error','اسم الرابط مستخدم'); end if;
  return jsonb_build_object('ok',true,'id',v_id,'handle',v_handle,'display_name',v_name);
end;
$$;

create or replace function public.get_anonymous_profile(p_handle text)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
 select case when p.id is null then null else jsonb_build_object(
  'handle',p.handle,'display_name',p.display_name,'bio',p.bio,'inbox_open',p.inbox_open,
  'messages',coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',m.id,'body',m.body,'reply',m.reply,'created_at',m.created_at,'published_at',m.published_at
    ) order by m.published_at desc)
    from (
      select id,body,reply,created_at,published_at
      from public.anonymous_messages
      where recipient_id=p.id and status='published'
      order by published_at desc
      limit 100
    ) m
  ),'[]'::jsonb)
 ) end
 from public.anonymous_profiles p
 where octet_length(coalesce(p_handle,''))<=80
   and lower(trim(coalesce(p_handle,''))) ~ '^[a-z0-9_]{3,24}$'
   and p.handle=lower(trim(coalesce(p_handle,'')))
   and p.is_active=true
$$;

create or replace function public.get_anonymous_inbox(p_handle text,p_secret text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_profile public.anonymous_profiles%rowtype;
  v_client_hash text:=public.uon_anonymous_client_hash();
  v_target text;
  v_failures integer;
begin
  if octet_length(coalesce(p_handle,''))>80 or lower(trim(coalesce(p_handle,''))) !~ '^[a-z0-9_]{3,24}$' then
    return jsonb_build_object('ok',false,'error','تعذر فتح الصندوق');
  end if;
  if octet_length(coalesce(p_secret,'')) not between 24 and 512 then
    return jsonb_build_object('ok',false,'error','تعذر فتح الصندوق');
  end if;
  v_target:=encode(extensions.digest(convert_to(lower(trim(p_handle)),'UTF8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_client_hash,0));
  select count(*) into v_failures from public.anonymous_action_limits
  where client_hash=v_client_hash and action='inbox_auth_failed' and created_at>now()-interval '15 minutes';
  if v_failures>=12 then return jsonb_build_object('ok',false,'error','محاولات كثيرة، حاول بعد قليل','rate_limited',true); end if;
  select * into v_profile from public.anonymous_profiles
  where handle=lower(trim(p_handle))
    and secret_hash=encode(extensions.digest(convert_to(p_secret,'UTF8'),'sha256'),'hex');
  if v_profile.id is null then
    insert into public.anonymous_action_limits(client_hash,action,target_key,success)
    values(v_client_hash,'inbox_auth_failed',v_target,false);
    delete from public.anonymous_action_limits where created_at<now()-interval '7 days';
    return jsonb_build_object('ok',false,'error','تعذر فتح الصندوق');
  end if;
  delete from public.anonymous_action_limits where client_hash=v_client_hash and action='inbox_auth_failed' and target_key=v_target;
  if not public.uon_public_rate_allow('anonymous_inbox',v_profile.id::text,120,3600) then
    return jsonb_build_object('ok',false,'error','محاولات كثيرة، حاول بعد قليل','rate_limited',true);
  end if;
  update public.anonymous_messages set is_read=true where recipient_id=v_profile.id and is_read=false;
  return jsonb_build_object(
    'ok',true,
    'profile',jsonb_build_object('handle',v_profile.handle,'display_name',v_profile.display_name,'bio',v_profile.bio,'inbox_open',v_profile.inbox_open),
    'messages',coalesce((
      select jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'reply',m.reply,'status',m.status,'is_read',m.is_read,'created_at',m.created_at) order by m.created_at desc)
      from (
        select id,body,reply,status,is_read,created_at
        from public.anonymous_messages
        where recipient_id=v_profile.id and status<>'deleted'
        order by created_at desc
        limit 200
      ) m
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.manage_anonymous_message(p_handle text,p_secret text,p_message_id uuid,p_action text,p_reply text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_profile_id uuid;
  v_status text;
  v_client_hash text:=public.uon_anonymous_client_hash();
  v_target text;
  v_failures integer;
  v_action text:=lower(trim(coalesce(p_action,'')));
begin
  if octet_length(coalesce(p_handle,''))>80 or lower(trim(coalesce(p_handle,''))) !~ '^[a-z0-9_]{3,24}$' then return jsonb_build_object('ok',false,'error','غير مصرح'); end if;
  if octet_length(coalesce(p_secret,'')) not between 24 and 512 then return jsonb_build_object('ok',false,'error','غير مصرح'); end if;
  if p_message_id is null then raise exception 'الرسالة غير موجودة'; end if;
  if v_action not in ('publish','hide','delete','inbox') then raise exception 'إجراء غير صالح'; end if;
  if char_length(coalesce(p_reply,''))>1000 then raise exception 'الرد طويل جدًا'; end if;
  v_target:=encode(extensions.digest(convert_to(lower(trim(p_handle)),'UTF8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_client_hash,0));
  select count(*) into v_failures from public.anonymous_action_limits
  where client_hash=v_client_hash and action='manage_auth_failed' and created_at>now()-interval '15 minutes';
  if v_failures>=12 then return jsonb_build_object('ok',false,'error','محاولات كثيرة، حاول بعد قليل','rate_limited',true); end if;
  select id into v_profile_id from public.anonymous_profiles
  where handle=lower(trim(p_handle))
    and secret_hash=encode(extensions.digest(convert_to(p_secret,'UTF8'),'sha256'),'hex');
  if v_profile_id is null then
    insert into public.anonymous_action_limits(client_hash,action,target_key,success)
    values(v_client_hash,'manage_auth_failed',v_target,false);
    delete from public.anonymous_action_limits where created_at<now()-interval '7 days';
    return jsonb_build_object('ok',false,'error','غير مصرح');
  end if;
  delete from public.anonymous_action_limits where client_hash=v_client_hash and action='manage_auth_failed' and target_key=v_target;
  if not public.uon_public_rate_allow('anonymous_manage',v_profile_id::text,120,3600) then
    return jsonb_build_object('ok',false,'error','عمليات كثيرة، حاول بعد قليل','rate_limited',true);
  end if;
  if v_action='publish' then
    update public.anonymous_messages
    set status='published',reply=nullif(trim(p_reply),''),replied_at=case when nullif(trim(p_reply),'') is null then replied_at else now() end,published_at=now()
    where id=p_message_id and recipient_id=v_profile_id returning status into v_status;
  elsif v_action='hide' then
    update public.anonymous_messages set status='hidden' where id=p_message_id and recipient_id=v_profile_id returning status into v_status;
  elsif v_action='delete' then
    update public.anonymous_messages set status='deleted' where id=p_message_id and recipient_id=v_profile_id returning status into v_status;
  else
    update public.anonymous_messages set status='inbox' where id=p_message_id and recipient_id=v_profile_id returning status into v_status;
  end if;
  if v_status is null then raise exception 'الرسالة غير موجودة'; end if;
  return jsonb_build_object('ok',true,'status',v_status);
end;
$$;

create or replace function public.update_anonymous_profile(p_handle text,p_secret text,p_display_name text,p_bio text,p_inbox_open boolean)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.anonymous_profiles%rowtype;
  v_profile_id uuid;
  v_client_hash text:=public.uon_anonymous_client_hash();
  v_target text;
  v_failures integer;
begin
  if octet_length(coalesce(p_handle,''))>80 or lower(trim(coalesce(p_handle,''))) !~ '^[a-z0-9_]{3,24}$' then return jsonb_build_object('ok',false,'error','غير مصرح'); end if;
  if octet_length(coalesce(p_secret,'')) not between 24 and 512 then return jsonb_build_object('ok',false,'error','غير مصرح'); end if;
  if char_length(trim(coalesce(p_display_name,''))) not between 2 and 40 then raise exception 'الاسم غير صالح'; end if;
  if char_length(coalesce(p_bio,''))>160 then raise exception 'النبذة طويلة جدًا'; end if;
  v_target:=encode(extensions.digest(convert_to(lower(trim(p_handle)),'UTF8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_client_hash,0));
  select count(*) into v_failures from public.anonymous_action_limits
  where client_hash=v_client_hash and action='profile_auth_failed' and created_at>now()-interval '15 minutes';
  if v_failures>=12 then return jsonb_build_object('ok',false,'error','محاولات كثيرة، حاول بعد قليل','rate_limited',true); end if;
  select id into v_profile_id from public.anonymous_profiles
  where handle=lower(trim(p_handle))
    and secret_hash=encode(extensions.digest(convert_to(p_secret,'UTF8'),'sha256'),'hex');
  if v_profile_id is null then
    insert into public.anonymous_action_limits(client_hash,action,target_key,success)
    values(v_client_hash,'profile_auth_failed',v_target,false);
    delete from public.anonymous_action_limits where created_at<now()-interval '7 days';
    return jsonb_build_object('ok',false,'error','غير مصرح');
  end if;
  delete from public.anonymous_action_limits where client_hash=v_client_hash and action='profile_auth_failed' and target_key=v_target;
  if not public.uon_public_rate_allow('anonymous_profile_update',v_profile_id::text,20,3600) then
    return jsonb_build_object('ok',false,'error','تعديلات كثيرة، حاول بعد قليل','rate_limited',true);
  end if;
  update public.anonymous_profiles
  set display_name=trim(p_display_name),bio=nullif(trim(coalesce(p_bio,'')),''),inbox_open=coalesce(p_inbox_open,true),updated_at=now()
  where id=v_profile_id
  returning * into v_row;
  return jsonb_build_object('ok',true,'handle',v_row.handle,'display_name',v_row.display_name,'bio',v_row.bio,'inbox_open',v_row.inbox_open);
end;
$$;
