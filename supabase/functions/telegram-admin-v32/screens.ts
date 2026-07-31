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
 const k:any[][]=rows.map((x:any)=>[{text:`${selected.has(String(x.id))?'✅':'☐'} ${x.name_ar}${x.degree_ar?` — ${x.degree_ar}`:''}`,callback_data:`v32c:prog:${x.id}`}]);
 if(rows.length)k.push([{text:selected.size===rows.length?'☐ إلغاء تحديد الكل':'✅ تحديد كل تخصصات القسم',callback_data:'v32c:all'}]);
 k.push([{text:'متابعة ➡️',callback_data:'v32c:programs:done'}],[{text:'⬅️ تغيير القسم',callback_data:'v32c:back:dept'}]);
 await edit(chatId,mid,rows.length?`اختر تخصصًا أو أكثر\nالمحدد: ${selected.size} من ${rows.length}`:'لا توجد تخصصات تحت هذا القسم. تابع لاختيار نوع المتطلب.',k);
}
export const requirementKeys=()=>[
 [{text:'🏛 متطلب جامعة',callback_data:'v32c:req:university'},{text:'🏫 متطلب كلية',callback_data:'v32c:req:college'}],
 [{text:'🎓 متطلب تخصص',callback_data:'v32c:req:major'},{text:'🧩 مقرر اختياري',callback_data:'v32c:req:elective'}],
 [{text:'⬅️ رجوع للتخصصات',callback_data:'v32c:back:programs'}]
];
export async function requirementScreen(chatId:string,mid:number,c:Choice){await edit(chatId,mid,`تم اختيار ${(c.program_ids||[]).length} تخصص.\nاختر نوع المقرر في الخطة:`,requirementKeys())}

export async function courseView(chatId:string,mid:number,id:string,page=0,prefix=''){
 const {data:c,error}=await db.from('courses').select('*').eq('id',id).single();if(error)throw error;
 const {data:links,error:le}=await db.from('course_programs').select('program_id,requirement_type').eq('course_code',c.code);if(le)throw le;
 const ids=(links||[]).map((x:any)=>x.program_id);let programs:any[]=[];
 if(ids.length){const r=await db.from('academic_programs').select('id,name_ar').in('id',ids).order('sort_order');if(r.error)throw r.error;programs=r.data||[]}
 const names=programs.map((x:any)=>x.name_ar),type=c.requirement_type||links?.[0]?.requirement_type||'major';
 const p=names.length?`${names.slice(0,12).join('، ')}${names.length>12?`، و${names.length-12} أخرى`:''}`:'غير مربوط بأي تخصص';
 const text=`${prefix}${c.code} — ${c.name_ar}\nالاسم الإنجليزي: ${c.name_en||'—'}\nالكلية: ${c.college_ar||c.college||'—'}\nالقسم: ${c.department_ar||c.department||'—'}\nالتخصصات (${names.length}): ${p}\nنوع المتطلب: ${requirements[type]||type}\nالساعات: ${c.credit_hours??'—'}\nالمستوى: ${c.level??'—'}\nالحالة: ${c.active?'نشط':'متوقف'}`;
 await edit(chatId,mid,text,[
  [{text:'🧭 تعديل الكلية والقسم والتخصصات',callback_data:`v32c:relink:${id}:${page}`}],
  [{text:'✏️ الاسم العربي',callback_data:`c:e:${id}:n:${page}`},{text:'🌐 الاسم الإنجليزي',callback_data:`c:e:${id}:e:${page}`}],
  [{text:'🏷 تعديل الرمز',callback_data:`c:e:${id}:c:${page}`},{text:'⏱ تعديل الساعات',callback_data:`c:e:${id}:h:${page}`}],
  [{text:'📶 المستوى',callback_data:`c:e:${id}:l:${page}`},{text:'📝 الوصف',callback_data:`c:e:${id}:x:${page}`}],
  [{text:c.active?'🔴 إيقاف المادة':'🟢 تفعيل المادة',callback_data:`course:toggle:${id}:${c.active?'off':'on'}:${page}`}],
  [{text:'🗑 حذف المادة',callback_data:`course:deleteask:${id}:${page}`}],[{text:'⬅️ المواد',callback_data:`course:list:${page}`}]
 ]);
}