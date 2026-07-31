do $$
declare
  v_college uuid;
  v_department uuid;
begin
  select id into v_college
  from public.academic_colleges
  where name_ar='كلية الاقتصاد والإدارة ونظم المعلومات'
  limit 1;

  select id into v_department
  from public.academic_departments
  where college_id=v_college
    and name_ar='قسم الاقتصاد والتمويل والتجارة الدولية'
  limit 1;

  if not exists(
    select 1 from public.academic_programs
    where lower(name_en)=lower('Economics and Finance – Islamic Banking and Finance')
      and degree_en='Bachelor'
  ) then
    insert into public.academic_programs(
      college_id,department_id,name_ar,name_en,degree_ar,degree_en,
      official_url,sort_order,active
    ) values (
      v_college,v_department,
      'الاقتصاد والتمويل – الصيرفة والتمويل الإسلامي',
      'Economics and Finance – Islamic Banking and Finance',
      'بكالوريوس','Bachelor',
      'https://www.unizwa.edu.om/program_details.php?lang=en&programid=80',
      71,true
    );
  end if;

  if not exists(
    select 1 from public.academic_programs
    where lower(name_en)=lower('Economics and Finance – Natural Resource Economics')
      and degree_en='Bachelor'
  ) then
    insert into public.academic_programs(
      college_id,department_id,name_ar,name_en,degree_ar,degree_en,
      official_url,sort_order,active
    ) values (
      v_college,v_department,
      'الاقتصاد والتمويل – اقتصاد الموارد الطبيعية',
      'Economics and Finance – Natural Resource Economics',
      'بكالوريوس','Bachelor',
      'https://www.unizwa.edu.om/program_details.php?lang=en&programid=82',
      72,true
    );
  end if;
end $$;
