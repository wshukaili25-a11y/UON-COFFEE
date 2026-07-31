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
    and name_ar='قسم الإدارة والتسويق'
  limit 1;

  if not exists(
    select 1 from public.academic_programs
    where lower(name_en)=lower('Operations Management')
      and degree_en='Bachelor'
  ) then
    insert into public.academic_programs(
      college_id,department_id,name_ar,name_en,degree_ar,degree_en,
      official_url,sort_order,active
    ) values (
      v_college,v_department,
      'إدارة العمليات','Operations Management',
      'بكالوريوس','Bachelor',
      'https://www.unizwa.edu.om/program_details.php?lang=en&programid=79',
      65,true
    );
  end if;

  update public.academic_programs
     set official_url='https://www.unizwa.edu.om/program_details.php?lang=en&programid=58'
   where name_en='Tourism and Recreational Facilities Management'
     and degree_en='Bachelor';
end $$;
