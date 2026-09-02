create table if not exists public.support_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  booking_url text,
  location_url text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_centers enable row level security;
drop policy if exists "Public reads active support centers" on public.support_centers;
create policy "Public reads active support centers"
on public.support_centers for select
to anon, authenticated
using (active = true);

grant select on public.support_centers to anon, authenticated;
grant select on public.contact_numbers to anon, authenticated;

create index if not exists support_centers_active_sort_idx
on public.support_centers (active, sort_order, created_at);

insert into public.support_centers(name,description,booking_url,location_url,active,sort_order)
select 'مركز أنجز',
       coalesce((select value #>> '{}' from public.site_settings where key='anjiz_description' limit 1),'دعم مخصص لطلاب السنة التأسيسية في الإنجليزية والرياضيات والحاسب ومهارات الدراسة.'),
       coalesce((select value #>> '{}' from public.site_settings where key='anjiz_booking_url' limit 1),'https://portal.unizwa.edu.om/twc/'),
       null,true,10
where not exists (select 1 from public.support_centers);

insert into public.support_centers(name,description,booking_url,location_url,active,sort_order)
select 'مركز تعزيز مسالك التعلم',
       coalesce((select value #>> '{}' from public.site_settings where key='masalik_description' limit 1),'جلسات دعم أكاديمي وورش صغيرة لطلاب التخصص في المواد الأساسية.'),
       coalesce((select value #>> '{}' from public.site_settings where key='masalik_booking_url' limit 1),'https://portal.unizwa.edu.om/twc/'),
       null,true,20
where (select count(*) from public.support_centers)=1;

do $$
begin
  if (select count(*)=4 and count(distinct phone)=1 and max(phone)='+968 2544 0000' from public.contact_numbers) then
    delete from public.contact_numbers;
    insert into public.contact_numbers(label,phone,sort_order,is_visible) values
      ('المالية','92596648',10,true),
      ('القبول والتسجيل','25446234',20,true),
      ('الرعاية الاجتماعية','91313951',30,true),
      ('الرعاية الاجتماعية','25446247',40,true),
      ('الرقم العام – الحرم المبدئي','25446200',50,true),
      ('مكتب الجامعة – الخوير','24479171',60,true),
      ('مكتب الجامعة – الخوير','24478167',70,true);
  end if;
end $$;

create or replace function public.uon_admin_catalog_action(
  p_password text,
  p_entity text,
  p_action text,
  p_id uuid default null::uuid,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
  v_id uuid;
  v_rows jsonb;
begin
  if not public.uon_admin_authorized(p_password) then raise exception 'Unauthorized'; end if;

  if p_entity='support_centers' and p_action='list' then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.sort_order,s.created_at),'[]'::jsonb)
      into v_rows
      from public.support_centers s;
    return jsonb_build_object('ok',true,'entity',p_entity,'rows',v_rows);
  end if;

  case p_entity
    when 'telegram_admins' then
      if p_action='create' then
        insert into public.telegram_admins(name,chat_id,role,active,notifications_enabled)
        values(trim(p_payload->>'name'),trim(p_payload->>'chat_id'),coalesce(nullif(p_payload->>'role',''),'moderator'),true,true)
        returning id into v_id;
      elsif p_action='delete' then
        delete from public.telegram_admins where id=p_id returning id into v_id;
      else raise exception 'Invalid action'; end if;

    when 'academic_calendar_events' then
      if p_action='create' then
        insert into public.academic_calendar_events(title,description,event_type,start_date,end_date,active)
        values(trim(p_payload->>'title'),nullif(p_payload->>'description',''),coalesce(nullif(p_payload->>'event_type',''),'other'),(p_payload->>'start_date')::date,nullif(p_payload->>'end_date','')::date,true)
        returning id into v_id;
      elsif p_action='delete' then
        delete from public.academic_calendar_events where id=p_id returning id into v_id;
      else raise exception 'Invalid action'; end if;

    when 'courses' then
      if p_action='create' then
        insert into public.courses(code,name_ar,name_en,credit_hours,college,department,description,active,status,reviewed_at)
        values(upper(trim(p_payload->>'code')),trim(p_payload->>'name_ar'),nullif(p_payload->>'name_en',''),nullif(p_payload->>'credit_hours','')::int,nullif(p_payload->>'college',''),nullif(p_payload->>'department',''),nullif(p_payload->>'description',''),true,'approved',now())
        returning id into v_id;
      elsif p_action='delete' then
        delete from public.courses where id=p_id returning id into v_id;
      else raise exception 'Invalid action'; end if;

    when 'site_notifications' then
      if p_action='create' then
        insert into public.site_notifications(title,body,icon,url,active)
        values(trim(p_payload->>'title'),nullif(p_payload->>'body',''),coalesce(nullif(p_payload->>'icon',''),'🔔'),nullif(p_payload->>'url',''),true)
        returning id into v_id;
      elsif p_action='delete' then
        delete from public.site_notifications where id=p_id returning id into v_id;
      else raise exception 'Invalid action'; end if;

    when 'support_centers' then
      if p_action='create' then
        insert into public.support_centers(name,description,booking_url,location_url,active,sort_order)
        values(trim(p_payload->>'name'),nullif(trim(p_payload->>'description'),''),nullif(trim(p_payload->>'booking_url'),''),nullif(trim(p_payload->>'location_url'),''),coalesce((p_payload->>'active')::boolean,true),coalesce(nullif(p_payload->>'sort_order','')::int,100))
        returning id into v_id;
      elsif p_action='update' then
        update public.support_centers set
          name=trim(p_payload->>'name'),
          description=nullif(trim(p_payload->>'description'),''),
          booking_url=nullif(trim(p_payload->>'booking_url'),''),
          location_url=nullif(trim(p_payload->>'location_url'),''),
          active=coalesce((p_payload->>'active')::boolean,active),
          sort_order=coalesce(nullif(p_payload->>'sort_order','')::int,sort_order),
          updated_at=now()
        where id=p_id returning id into v_id;
      elsif p_action='delete' then
        delete from public.support_centers where id=p_id returning id into v_id;
      else raise exception 'Invalid action'; end if;

    else raise exception 'Unsupported entity';
  end case;

  if v_id is null then raise exception 'Record not found'; end if;
  return jsonb_build_object('ok',true,'entity',p_entity,'id',v_id,'action',p_action);
end;
$function$;

revoke all on function public.uon_admin_catalog_action(text,text,text,uuid,jsonb) from public;
grant execute on function public.uon_admin_catalog_action(text,text,text,uuid,jsonb) to anon, authenticated;

update public.tool_registry
set url='support-centers.html',
    placement='home_secondary',
    status='active',
    is_visible=true,
    publish_status='published',
    updated_at=now(),
    version_no=coalesce(version_no,0)+1
where key='support-centers';
