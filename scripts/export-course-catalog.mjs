import {mkdir,writeFile} from 'node:fs/promises';

const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const tables={
  courses:'select=*&order=code.asc',
  academic_colleges:'select=*&order=sort_order.asc',
  academic_departments:'select=*&order=sort_order.asc',
  academic_programs:'select=*&order=sort_order.asc',
  course_programs:'select=*&order=course_code.asc'
};

async function readTable(table,query){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`,{
    headers:{apikey:PUBLISHABLE_KEY,authorization:`Bearer ${PUBLISHABLE_KEY}`}
  });
  if(!response.ok)throw new Error(`${table}: ${response.status} ${await response.text()}`);
  const rows=await response.json();
  if(!Array.isArray(rows))throw new Error(`${table}: invalid response`);
  return rows;
}

const entries=await Promise.all(Object.entries(tables).map(async([table,query])=>[table,await readTable(table,query)]));
const data=Object.fromEntries(entries);
const activeCourses=data.courses.filter(row=>row.active!==false);
const linkedCodes=new Set(data.course_programs.map(row=>String(row.course_code||'').toUpperCase()));

const snapshot={
  schema_version:'32.4.0',
  exported_at:new Date().toISOString(),
  source:'UON Hub public catalog',
  metrics:{
    courses:data.courses.length,
    active_courses:activeCourses.length,
    colleges:data.academic_colleges.length,
    departments:data.academic_departments.length,
    programs:data.academic_programs.length,
    course_program_links:data.course_programs.length,
    linked_active_courses:activeCourses.filter(row=>linkedCodes.has(String(row.code||'').toUpperCase())).length
  },
  ...data
};

await mkdir('data',{recursive:true});
await writeFile('data/course-catalog-v32.json',`${JSON.stringify(snapshot,null,2)}\n`,'utf8');
console.log(snapshot.metrics);
