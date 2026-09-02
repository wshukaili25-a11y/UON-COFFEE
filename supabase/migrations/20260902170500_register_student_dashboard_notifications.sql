insert into public.tool_registry(key,category_id,name_ar,name_en,description_ar,description_en,url,icon,status,is_visible,is_platform,placement,sort_order,publish_status,draft_payload,version_no,short_slug,audience,health_status,published_at,updated_at)
values
('my-dashboard','platform','لوحتي','My Dashboard','محاضرتك القادمة والمواعيد الأكاديمية والمفضلة وآخر استخدامك في مكان واحد.','Your next class, academic dates, favorites, and recent activity in one place.','user-dashboard.html','🧭','active',true,true,'home_primary',45,'published','{}'::jsonb,1,'my-dashboard','{"type":"all"}'::jsonb,'healthy',now(),now()),
('notifications','platform','تنبيهاتي','My Alerts','تنبيهات ذكية للمحاضرات والمواعيد الأكاديمية حسب تفضيلات الطالب على جهازه.','Smart local alerts for classes and academic dates based on student preferences.','notifications.html','🔔','active',true,true,'home_secondary',125,'published','{}'::jsonb,1,'alerts','{"type":"all"}'::jsonb,'healthy',now(),now())
on conflict (key) do update set
 name_ar=excluded.name_ar,name_en=excluded.name_en,description_ar=excluded.description_ar,description_en=excluded.description_en,url=excluded.url,icon=excluded.icon,status='active',is_visible=true,is_platform=true,placement=excluded.placement,sort_order=excluded.sort_order,publish_status='published',audience=excluded.audience,updated_at=now(),version_no=public.tool_registry.version_no+1;

update public.tool_registry set url='academic-calendar.html',updated_at=now(),version_no=version_no+1 where key='calendar' and url<>'academic-calendar.html';
