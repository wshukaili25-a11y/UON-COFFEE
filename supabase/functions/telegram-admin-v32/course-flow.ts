import {db,send,edit,Admin,Conversation,Choice,setConv,getConv,clearConv,audit,requirements} from './lib.ts';
import {collegeKeys,departmentKeys,programScreen,requirementScreen,courseView} from './screens.ts';

async function replaceLinks(code:string,ids:string[],type:string){
 const deleted=await db.from('course_programs').delete().eq('course_code',code);if(deleted.error)throw deleted.error;
 if(type==='service')return;
 const unique=[...new Set(ids.map(String))];if(!unique.length)return;
 const inserted=await db.from('course_programs').insert(unique.map(program_id=>({course_code:code,program_id,requirement_type:type})));
 if(inserted.error)throw inserted.error;
}

async function createCourse(chatId:string,admin:Admin,hoursText:string,choice:Choice){
 const hours=Number(hoursText);
 if(!Number.isInteger(hours)||hours<0||hours>12){await send(chatId,'أرسل عدد الساعات كرقم من 0 إلى 12.');return}
 const type=choice.requirement_type||'major';
 const programIds=type==='service'?[]:(choice.program_ids||[]);
 if(type!=='service'&&!programIds.length){await send(chatId,'اختر برنامجًا واحدًا على الأقل، أو صنف المقرر كمقرر خدمة.');return}
 const payload={
  code:choice.code,name_ar:choice.name_ar,name_en:choice.name_en||null,
  college:choice.college_ar||null,college_ar:choice.college_ar||null,college_en:choice.college_en||null,
  department:choice.department_ar||null,department_ar:choice.department_ar||null,department_en:choice.department_en||null,
  credit_hours:hours||null,requirement_type:type,active:true,status:'approved',reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()
 };
 const result=await db.from('courses').insert(payload).select('id,code').single();if(result.error)throw result.error;
 await replaceLinks(result.data.code,programIds,type);
 await clearConv(chatId);
 audit(admin,'course_create_v323',result.data.id,{...payload,program_ids:programIds});
 const message=type==='service'?`تمت إضافة ${result.data.code} كمقرر خدمة ✅`:`تمت إضافة ${result.data.code} وربطه بـ ${programIds.length} برنامج ✅`;
 await send(chatId,message,[[{text:'📘 فتح المقرر',callback_data:`course:view:${result.data.id}:0`}],[{text:'📚 قائمة المقررات',callback_data:'course:list:0'}]]);
}

async function relinkCourse(chatId:string,mid:number,admin:Admin,choice:Choice){
 if(!choice.course_id)throw new Error('معرّف المقرر مفقود');
 const current=await db.from('courses').select('code').eq('id',choice.course_id).single();if(current.error)throw current.error;
 const type=choice.requirement_type||'major';
 const programIds=type==='service'?[]:(choice.program_ids||[]);
 if(type!=='service'&&!programIds.length)throw new Error('اختر برنامجًا واحدًا على الأقل');
 const patch={
  college:choice.college_ar||null,college_ar:choice.college_ar||null,college_en:choice.college_en||null,
  department:choice.department_ar||null,department_ar:choice.department_ar||null,department_en:choice.department_en||null,
  requirement_type:type,updated_at:new Date().toISOString()
 };
 const updated=await db.from('courses').update(patch).eq('id',choice.course_id);if(updated.error)throw updated.error;
 await replaceLinks(current.data.code,programIds,type);
 await clearConv(chatId);
 audit(admin,'course_relink_v323',choice.course_id,{...patch,program_ids:programIds});
 await courseView(chatId,mid,choice.course_id,choice.page||0,'تم تحديث الربط الأكاديمي ✅\n\n');
}

async function finishRequirement(chatId:string,mid:number,admin:Admin,choice:Choice,type:string){
 if(!requirements[type])throw new Error('نوع المقرر غير معروف');
 const next={...choice,requirement_type:type,program_ids:type==='service'?[]:(choice.program_ids||[])};
 if(next.mode==='edit'){await relinkCourse(chatId,mid,admin,next);return}
 await setConv(chatId,'v32_course_hours',next);
 await edit(chatId,mid,`النوع: ${requirements[type]}\nأرسل عدد الساعات من 0 إلى 12.`,[[{text:'⬅️ إلغاء',callback_data:'courses:menu'}]]);
}

export async function textFlow(chatId:string,admin:Admin,value:string,conv:Conversation){
 const choice=(conv.data||{}) as Choice;
 if(conv.state==='v32_course_code'){
  const code=value.toUpperCase().replace(/\s+/g,'');
  if(!/^[A-Z]{2,5}\d{3}[A-Z]?$/.test(code)){await send(chatId,'رمز غير صحيح. مثال: STAT101');return}
  const existing=await db.from('courses').select('id').eq('code',code).maybeSingle();if(existing.error)throw existing.error;
  if(existing.data){await send(chatId,'هذا الرمز موجود مسبقًا.');return}
  await setConv(chatId,'v32_course_name_ar',{...choice,code});await send(chatId,'أرسل اسم المقرر بالعربي.');return;
 }
 if(conv.state==='v32_course_name_ar'){
  if(value.length<2){await send(chatId,'اسم المقرر قصير جدًا.');return}
  await setConv(chatId,'v32_course_name_en',{...choice,name_ar:value});await send(chatId,'أرسل الاسم بالإنجليزي، أو - للتخطي.');return;
 }
 if(conv.state==='v32_course_name_en'){
  const next={...choice,name_en:value==='-'?null:value};await setConv(chatId,'v32_course_college',next);await send(chatId,'اختر الكلية الأساسية:',await collegeKeys());return;
 }
 if(conv.state==='v32_course_hours'){await createCourse(chatId,admin,value,choice);return}
 await clearConv(chatId);await send(chatId,'انتهت الجلسة. ابدأ مرة ثانية من مركز المقررات.');
}

export async function callbackFlow(chatId:string,mid:number,admin:Admin,data:string){
 if(data==='course:add:start'){
  await setConv(chatId,'v32_course_code',{mode:'create'});
  await edit(chatId,mid,'أرسل رمز المقرر، مثل STAT101',[[{text:'⬅️ إلغاء',callback_data:'courses:menu'}]]);return;
 }
 if(data.startsWith('course:view:')){const [,,id,page]=data.split(':');await courseView(chatId,mid,id,Number(page)||0);return}
 if(data.startsWith('course:deleteask:')){
  const [,,id,page]=data.split(':');
  await edit(chatId,mid,'⚠️ تأكيد حذف المقرر وروابطه الأكاديمية؟',[[{text:'نعم، حذف نهائي',callback_data:`v32c:delete:${id}:${Number(page)||0}`}],[{text:'إلغاء',callback_data:`course:view:${id}:${Number(page)||0}`}]]);return;
 }
 if(data.startsWith('v32c:delete:')){
  if(admin.role!=='owner')throw new Error('الحذف للمالك فقط');
  const [,,id,page]=data.split(':');
  const course=await db.from('courses').select('code').eq('id',id).single();if(course.error)throw course.error;
  const links=await db.from('course_programs').delete().eq('course_code',course.data.code);if(links.error)throw links.error;
  const deleted=await db.from('courses').delete().eq('id',id);if(deleted.error)throw deleted.error;
  audit(admin,'course_delete_v323',id,{code:course.data.code});
  await edit(chatId,mid,'تم حذف المقرر وروابطه ✅',[[{text:'⬅️ قائمة المقررات',callback_data:`course:list:${Number(page)||0}`}]]);return;
 }
 if(data.startsWith('v32c:relink:')){
  const [,,id,page]=data.split(':');
  const [courseResult,linkResult]=await Promise.all([
   db.from('courses').select('code,requirement_type').eq('id',id).single(),
   db.from('course_programs').select('program_id').eq('course_code',(await db.from('courses').select('code').eq('id',id).single()).data?.code||'')
  ]);
  if(courseResult.error)throw courseResult.error;if(linkResult.error)throw linkResult.error;
  await setConv(chatId,'v32_course_college',{mode:'edit',course_id:id,page:Number(page)||0,code:courseResult.data.code,requirement_type:courseResult.data.requirement_type||'major',program_ids:(linkResult.data||[]).map((x:any)=>String(x.program_id))});
  await edit(chatId,mid,'اختر الكلية الأساسية للمقرر:',await collegeKeys());return;
 }

 const conv=await getConv(chatId);
 if(!conv?.state?.startsWith('v32_course_'))throw new Error('انتهت جلسة التعديل.');
 let choice=(conv.data||{}) as Choice;

 if(data==='v32c:back:college'){
  await setConv(chatId,'v32_course_college',choice);await edit(chatId,mid,'اختر الكلية الأساسية:',await collegeKeys());return;
 }
 if(data==='v32c:back:dept'){
  if(!choice.college_id)throw new Error('اختر الكلية أولًا');
  choice={...choice,department_id:undefined,department_ar:undefined,department_en:undefined,program_ids:choice.mode==='edit'?(choice.program_ids||[]):[]};
  await setConv(chatId,'v32_course_department',choice);await edit(chatId,mid,'اختر القسم الأساسي:',await departmentKeys(choice.college_id));return;
 }
 if(data==='v32c:back:programs'){
  await setConv(chatId,'v32_course_programs',choice);await programScreen(chatId,mid,choice);return;
 }
 if(data.startsWith('v32c:college:')){
  const id=data.split(':')[2],result=await db.from('academic_colleges').select('*').eq('id',id).eq('active',true).single();if(result.error)throw result.error;
  choice={...choice,college_id:result.data.id,college_ar:result.data.name_ar,college_en:result.data.name_en,department_id:undefined,department_ar:undefined,department_en:undefined,program_ids:choice.mode==='edit'?(choice.program_ids||[]):[]};
  await setConv(chatId,'v32_course_department',choice);await edit(chatId,mid,`الكلية الأساسية: ${result.data.name_ar}\nاختر القسم الأساسي:`,await departmentKeys(result.data.id));return;
 }
 if(data.startsWith('v32c:dept:')){
  const id=data.split(':')[2],result=await db.from('academic_departments').select('*').eq('id',id).eq('active',true).single();if(result.error)throw result.error;
  choice={...choice,department_id:result.data.id,department_ar:result.data.name_ar,department_en:result.data.name_en,program_ids:choice.mode==='edit'?(choice.program_ids||[]):[]};
  await setConv(chatId,'v32_course_programs',choice);await programScreen(chatId,mid,choice);return;
 }
 if(data.startsWith('v32c:prog:')){
  const id=data.split(':')[2],selected=new Set((choice.program_ids||[]).map(String));selected.has(id)?selected.delete(id):selected.add(id);
  choice={...choice,program_ids:[...selected]};await setConv(chatId,'v32_course_programs',choice);await programScreen(chatId,mid,choice);return;
 }
 if(data==='v32c:all'){
  const result=await db.from('academic_programs').select('id').eq('active',true).eq('department_id',choice.department_id);if(result.error)throw result.error;
  const visible=(result.data||[]).map((x:any)=>String(x.id)),selected=new Set((choice.program_ids||[]).map(String));
  const allSelected=visible.length>0&&visible.every(id=>selected.has(id));
  visible.forEach(id=>allSelected?selected.delete(id):selected.add(id));
  choice={...choice,program_ids:[...selected]};await setConv(chatId,'v32_course_programs',choice);await programScreen(chatId,mid,choice);return;
 }
 if(data==='v32c:clear'){
  choice={...choice,program_ids:[]};await setConv(chatId,'v32_course_programs',choice);await programScreen(chatId,mid,choice);return;
 }
 if(data==='v32c:service'||data==='v32c:req:service'){
  await finishRequirement(chatId,mid,admin,{...choice,program_ids:[]},'service');return;
 }
 if(data==='v32c:programs:done'){
  if(!(choice.program_ids||[]).length)throw new Error('اختر برنامجًا واحدًا على الأقل أو اختر مقرر خدمة');
  await setConv(chatId,'v32_course_requirement',choice);await requirementScreen(chatId,mid,choice);return;
 }
 if(data.startsWith('v32c:req:')){
  await finishRequirement(chatId,mid,admin,choice,data.split(':')[2]);return;
 }
 throw new Error('خيار غير معروف');
}