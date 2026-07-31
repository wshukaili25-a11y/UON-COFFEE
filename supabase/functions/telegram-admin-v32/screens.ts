import {db,edit,Choice,requirements} from './lib.ts';

export async function collegeKeys(){
 const {data,error}=await db.from('academic_colleges').select('id,name_ar').eq('active',true).order('sort_order');if(error)throw error;
 return [...(data||[]).map((x:any)=>[{text:`🏫 ${x.name_ar}`,callback_data:`v32c:college:${x.id}`}]),[{text:'⬅️ إلغاء',callback_data:'courses:menu'}]];
}

export async function departmentKeys(collegeId:string){
 const {data,error}=await db.from('academic_departments').select('id,name_ar').eq('active',true).eq('college_id',collegeId).order('sort_order');if(error)throw error;
 return [...(data||[]).map((x:any)=>[{text:`🏢 ${x.name_ar}`,callback_data:`v32c:dept:${x.id}`}]),[{text:'⬅️ تغيير الكلية',callback_data:'v32c:back:college'}]];
}

export async function programScreen(chatId:string,mid:number,c:Choice){
 const {data,error}=await db.from('academic_programs').select('id,name_ar,degree_ar').eq('active',true).eq('department_id',c.department_id).order('sort_order');if(error)throw error;
 const rows=data||[],selected=new Set((c.program_ids||[]).map(String));
 const visibleSelected=rows.filter((x:any)=>selected.has(String(x.id))).length;
 const keyboard:any[][]=rows.map((x:any)=>[{
  text:`${selected.has(String(x.id))?'✅':'☐'} ${x.name_ar}${x.degree_ar?` — ${x.degree_ar}`:''}`,
  callback_data:`v32c:prog:${x.id}`
 }]);
 if(rows.length)keyboard.push([{text:visibleSelected===rows.length?'☐ إلغاء تحديد برامج القسم':'✅ تحديد كل برامج القسم',callback_data:'v32c:all'}]);
 keyboard.push([{text:'🧰 مقرر خدمة بدون خطة محددة',callback_data:'v32c:service'}]);
 keyboard.push([{text:'متابعة ➡️',callback_data:'v32c:programs:done'}]);
 keyboard.push([{text:'⬅️ تغيير القسم',callback_data:'v32c:back:dept'}]);
 const hidden=Math.max(0,selected.size-visibleSelected);
 const note=hidden?`\nومنها ${hidden} برنامج من أقسام أخرى محفوظ مسبقًا.`:'';
 await edit(chatId,mid,rows.length?`اختر برنامجًا أو أكثر\nالمحدد: ${selected.size} برنامج${note}`:`لا توجد برامج تحت هذا القسم. يمكنك تصنيف المقرر كمقرر خدمة.`,keyboard);
}

export const requirementKeys=()=>[
 [{text:'🏛 متطلب جامعة',callback_data:'v32c:req:university'},{text:'🏫 متطلب كلية',callback_data:'v32c:req:college'}],
 [{text:'🎓 متطلب تخصص',callback_data:'v32c:req:major'},{text:'🧩 مقرر اختياري',callback_data:'v32c:req:elective'}],
 [{text:'🧰 مقرر خدمة بدون خطة',callback_data:'v32c:req:service'}],
 [{text:'⬅️ رجوع للبرامج',callback_data:'v32c:back:programs'}]
];

export async function requirementScreen(chatId:string,mid:number,c:Choice){
 await edit(chatId,mid,`تم اختيار ${(c.program_ids||[]).length} برنامج.\nاختر نوع المقرر في الخطة:`,requirementKeys());
}

export async function courseView(chatId:string,mid:number,id:string,page=0,prefix=''){
 const {data:course,error}=await db.from('courses').select('*').eq('id',id).single();if(error)throw error;
 const {data:links,error:linksError}=await db.from('course_programs').select('program_id,requirement_type').eq('course_code',course.code);if(linksError)throw linksError;
 const ids=(links||[]).map((x:any)=>x.program_id);let programs:any[]=[];
 if(ids.length){const result=await db.from('academic_programs').select('id,name_ar,degree_ar').in('id',ids).order('sort_order');if(result.error)throw result.error;programs=result.data||[]}
 const names=programs.map((x:any)=>`${x.name_ar}${x.degree_ar?` — ${x.degree_ar}`:''}`);
 const type=course.requirement_type||links?.[0]?.requirement_type||'major';
 const linkedText=names.length?`${names.slice(0,10).join('، ')}${names.length>10?`، و${names.length-10} أخرى`:''}`:type==='service'?'مقرر خدمة بدون خطة محددة':'غير مربوط بأي برنامج';
 await edit(chatId,mid,`${prefix}${course.code} — ${course.name_ar}
الاسم الإنجليزي: ${course.name_en||'—'}
الكلية الأساسية: ${course.college_ar||course.college||'—'}
القسم الأساسي: ${course.department_ar||course.department||'—'}
البرامج (${names.length}): ${linkedText}
نوع المقرر: ${requirements[type]||type}
الساعات: ${course.credit_hours??'—'}
المستوى: ${course.level??'—'}
الحالة: ${course.active?'نشط':'متوقف'}`,[
  [{text:'🧭 تعديل الربط الأكاديمي',callback_data:`v32c:relink:${id}:${page}`}],
  [{text:'✏️ الاسم العربي',callback_data:`c:e:${id}:n:${page}`},{text:'🌐 الاسم الإنجليزي',callback_data:`c:e:${id}:e:${page}`}],
  [{text:'🏷 تعديل الرمز',callback_data:`c:e:${id}:c:${page}`},{text:'⏱ تعديل الساعات',callback_data:`c:e:${id}:h:${page}`}],
  [{text:'📶 المستوى',callback_data:`c:e:${id}:l:${page}`},{text:'📝 الوصف',callback_data:`c:e:${id}:x:${page}`}],
  [{text:course.active?'🔴 إيقاف المادة':'🟢 تفعيل المادة',callback_data:`course:toggle:${id}:${course.active?'off':'on'}:${page}`}],
  [{text:'🗑 حذف المادة',callback_data:`course:deleteask:${id}:${page}`}],
  [{text:'⬅️ المواد',callback_data:`course:list:${page}`}]
 ]);
}