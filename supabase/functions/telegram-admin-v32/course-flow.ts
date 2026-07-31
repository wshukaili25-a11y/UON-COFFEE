import {db,send,edit,Admin,Conversation,Choice,setConv,getConv,clearConv,audit,requirements} from './lib.ts';
import {collegeKeys,departmentKeys,programScreen,requirementScreen,courseView} from './screens.ts';

async function links(code:string,ids:string[],type:string){
 const d=await db.from('course_programs').delete().eq('course_code',code);if(d.error)throw d.error;
 const u=[...new Set(ids.map(String))];if(!u.length)return;
 const r=await db.from('course_programs').insert(u.map(program_id=>({course_code:code,program_id,requirement_type:type})));if(r.error)throw r.error;
}
async function create(chatId:string,a:Admin,text:string,c:Choice){
 const h=Number(text);if(!Number.isInteger(h)||h<0||h>12){await send(chatId,'أرسل عدد الساعات كرقم من 0 إلى 12.');return}
 const p={code:c.code,name_ar:c.name_ar,name_en:c.name_en||null,college:c.college_ar,college_ar:c.college_ar,college_en:c.college_en||null,department:c.department_ar,department_ar:c.department_ar,department_en:c.department_en||null,credit_hours:h||null,requirement_type:c.requirement_type||'major',active:true,status:'approved',reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 const r=await db.from('courses').insert(p).select('id,code').single();if(r.error)throw r.error;
 await links(r.data.code,c.program_ids||[],c.requirement_type||'major');await clearConv(chatId);audit(a,'course_create_v32',r.data.id,{...p,program_ids:c.program_ids||[]});
 await send(chatId,`تمت إضافة ${r.data.code} وربطها أكاديميًا ✅`,[[{text:'📘 فتح المقرر',callback_data:`course:view:${r.data.id}:0`}],[{text:'📚 قائمة المقررات',callback_data:'course:list:0'}]]);
}
async function relink(chatId:string,mid:number,a:Admin,c:Choice){
 if(!c.course_id)throw new Error('معرّف المقرر مفقود');const q=await db.from('courses').select('code').eq('id',c.course_id).single();if(q.error)throw q.error;
 const p={college:c.college_ar,college_ar:c.college_ar,college_en:c.college_en||null,department:c.department_ar,department_ar:c.department_ar,department_en:c.department_en||null,requirement_type:c.requirement_type||'major',updated_at:new Date().toISOString()};
 const r=await db.from('courses').update(p).eq('id',c.course_id);if(r.error)throw r.error;await links(q.data.code,c.program_ids||[],c.requirement_type||'major');await clearConv(chatId);audit(a,'course_relink_v32',c.course_id,{...p,program_ids:c.program_ids||[]});
 await courseView(chatId,mid,c.course_id,c.page||0,'تم تحديث الربط الأكاديمي ✅\n\n');
}
export async function textFlow(chatId:string,a:Admin,text:string,conv:Conversation){
 const c=(conv.data||{}) as Choice;
 if(conv.state==='v32_course_code'){
  const code=text.toUpperCase().replace(/\s+/g,'');if(!/^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code)){await send(chatId,'رمز غير صحيح. مثال: STAT101');return}
  const e=await db.from('courses').select('id').eq('code',code).maybeSingle();if(e.error)throw e.error;if(e.data){await send(chatId,'هذا الرمز موجود مسبقًا.');return}
  await setConv(chatId,'v32_course_name_ar',{...c,code});await send(chatId,'أرسل اسم المقرر بالعربي.');return;
 }
 if(conv.state==='v32_course_name_ar'){if(text.length<2){await send(chatId,'اسم المقرر قصير جدًا.');return}await setConv(chatId,'v32_course_name_en',{...c,name_ar:text});await send(chatId,'أرسل الاسم بالإنجليزي، أو - للتخطي.');return}
 if(conv.state==='v32_course_name_en'){const n={...c,name_en:text==='-'?null:text};await setConv(chatId,'v32_course_college',n);await send(chatId,'اختر الكلية:',await collegeKeys());return}
 if(conv.state==='v32_course_hours'){await create(chatId,a,text,c);return}
 await clearConv(chatId);await send(chatId,'انتهت الجلسة. ابدأ مرة ثانية من مركز المقررات.');
}
export async function callbackFlow(chatId:string,mid:number,a:Admin,data:string){
 if(data==='course:add:start'){await setConv(chatId,'v32_course_code',{mode:'create'});await edit(chatId,mid,'أرسل رمز المقرر، مثل STAT101',[[{text:'⬅️ إلغاء',callback_data:'courses:menu'}]]);return}
 if(data.startsWith('course:view:')){const [,,id,p]=data.split(':');await courseView(chatId,mid,id,Number(p)||0);return}
 if(data.startsWith('course:deleteask:')){const [,,id,p]=data.split(':');await edit(chatId,mid,'⚠️ تأكيد حذف المقرر وروابطه الأكاديمية؟',[[{text:'نعم، حذف نهائي',callback_data:`v32c:delete:${id}:${Number(p)||0}`}],[{text:'إلغاء',callback_data:`course:view:${id}:${Number(p)||0}`}]]);return}
 if(data.startsWith('v32c:delete:')){if(a.role!=='owner')throw new Error('الحذف للمالك فقط');const [,,id,p]=data.split(':');const q=await db.from('courses').select('code').eq('id',id).single();if(q.error)throw q.error;const l=await db.from('course_programs').delete().eq('course_code',q.data.code);if(l.error)throw l.error;const d=await db.from('courses').delete().eq('id',id);if(d.error)throw d.error;audit(a,'course_delete_v32',id,{code:q.data.code});await edit(chatId,mid,'تم حذف المقرر وروابطه ✅',[[{text:'⬅️ قائمة المقررات',callback_data:`course:list:${Number(p)||0}`}]]);return}
 if(data.startsWith('v32c:relink:')){const [,,id,p]=data.split(':');const q=await db.from('courses').select('code').eq('id',id).single();if(q.error)throw q.error;await setConv(chatId,'v32_course_college',{mode:'edit',course_id:id,page:Number(p)||0,code:q.data.code,program_ids:[]});await edit(chatId,mid,'اختر الكلية الجديدة:',await collegeKeys());return}
 const conv=await getConv(chatId);if(!conv?.state?.startsWith('v32_course_'))throw new Error('انتهت جلسة التعديل.');let c=(conv.data||{}) as Choice;
 if(data==='v32c:back:college'){await setConv(chatId,'v32_course_college',c);await edit(chatId,mid,'اختر الكلية:',await collegeKeys());return}
 if(data==='v32c:back:dept'){if(!c.college_id)throw new Error('اختر الكلية أولًا');c={...c,department_id:undefined,department_ar:undefined,department_en:undefined,program_ids:[]};await setConv(chatId,'v32_course_department',c);await edit(chatId,mid,'اختر القسم:',await departmentKeys(c.college_id));return}
 if(data==='v32c:back:programs'){await setConv(chatId,'v32_course_programs',c);await programScreen(chatId,mid,c);return}
 if(data.startsWith('v32c:college:')){const id=data.split(':')[2],q=await db.from('academic_colleges').select('*').eq('id',id).eq('active',true).single();if(q.error)throw q.error;c={...c,college_id:q.data.id,college_ar:q.data.name_ar,college_en:q.data.name_en,department_id:undefined,program_ids:[]};await setConv(chatId,'v32_course_department',c);await edit(chatId,mid,`الكلية: ${q.data.name_ar}\nاختر القسم:`,await departmentKeys(q.data.id));return}
 if(data.startsWith('v32c:dept:')){const id=data.split(':')[2],q=await db.from('academic_departments').select('*').eq('id',id).eq('active',true).single();if(q.error)throw q.error;c={...c,department_id:q.data.id,department_ar:q.data.name_ar,department_en:q.data.name_en,program_ids:[]};await setConv(chatId,'v32_course_programs',c);await programScreen(chatId,mid,c);return}
 if(data.startsWith('v32c:prog:')){const id=data.split(':')[2],s=new Set((c.program_ids||[]).map(String));s.has(id)?s.delete(id):s.add(id);c={...c,program_ids:[...s]};await setConv(chatId,'v32_course_programs',c);await programScreen(chatId,mid,c);return}
 if(data==='v32c:all'){const q=await db.from('academic_programs').select('id').eq('active',true).eq('department_id',c.department_id);if(q.error)throw q.error;const all=(q.data||[]).map((x:any)=>String(x.id)),cur=new Set((c.program_ids||[]).map(String));c={...c,program_ids:cur.size===all.length?[]:all};await setConv(chatId,'v32_course_programs',c);await programScreen(chatId,mid,c);return}
 if(data==='v32c:programs:done'){const q=await db.from('academic_programs').select('id',{count:'exact',head:true}).eq('active',true).eq('department_id',c.department_id);if(q.error)throw q.error;if((q.count||0)>0&&!(c.program_ids||[]).length)throw new Error('اختر تخصصًا واحدًا على الأقل');await setConv(chatId,'v32_course_requirement',c);await requirementScreen(chatId,mid,c);return}
 if(data.startsWith('v32c:req:')){const type=data.split(':')[2];if(!requirements[type])throw new Error('نوع المتطلب غير معروف');c={...c,requirement_type:type};if(c.mode==='edit')await relink(chatId,mid,a,c);else{await setConv(chatId,'v32_course_hours',c);await edit(chatId,mid,`النوع: ${requirements[type]}\nأرسل عدد الساعات من 0 إلى 12.`,[[{text:'⬅️ إلغاء',callback_data:'courses:menu'}]])}return}
 throw new Error('خيار غير معروف');
}