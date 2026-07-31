from pathlib import Path
import re

path = Path('supabase/functions/telegram-admin/index.ts')
source = path.read_text(encoding='utf-8')

helpers = r'''
async function courseCollegeChoiceKeyboard(){
 const {data,error}=await db.from('academic_colleges').select('id,name_ar,name_en').eq('active',true).order('sort_order');
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{text:`🏫 ${item.name_ar}`,callback_data:`ca:c:${item.id}`}]);
 rows.push([{text:'⬅️ إلغاء',callback_data:'courses:menu'}]);
 return rows;
}

async function courseDepartmentChoiceKeyboard(collegeId:string){
 const {data,error}=await db.from('academic_departments').select('id,name_ar,name_en').eq('active',true).eq('college_id',collegeId).order('sort_order');
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{text:`🏢 ${item.name_ar}`,callback_data:`ca:d:${item.id}`}]);
 rows.push([{text:'⬅️ اختيار كلية أخرى',callback_data:'course:add:college'}]);
 return rows;
}

async function courseProgramChoice(chatId:string,mid:number,conversationData:any){
 const departmentId=String(conversationData.department_id||'');
 const selected=new Set<string>((conversationData.program_ids||[]).map(String));
 const {data,error}=await db.from('academic_programs')
  .select('id,name_ar,degree_ar').eq('active',true).eq('department_id',departmentId).order('sort_order');
 if(error)throw error;
 const rows=(data||[]).map((item:any)=>[{
  text:`${selected.has(String(item.id))?'✅':'☐'} ${item.name_ar}${item.degree_ar?` — ${item.degree_ar}`:''}`,
  callback_data:`ca:p:${item.id}`
 }]);
 rows.push([{text:'✅ متابعة وحفظ الاختيارات',callback_data:'ca:done'}]);
 rows.push([{text:'⬅️ اختيار قسم آخر',callback_data:`ca:backd:${conversationData.college_id}`}]);
 await edit(chatId,mid,`اختر تخصصًا أو أكثر للمقرر\nالمحدد حاليًا: ${selected.size}` ,rows);
}

async function getCourseConversation(chatId:string){
 const {data,error}=await db.from('telegram_conversations').select('*').eq('chat_id',chatId).single();
 if(error)throw error;
 return data;
}
'''

marker = 'async function coursesMenu(chatId:string,mid:number){'
if helpers.strip() not in source:
    source = source.replace(marker, helpers + '\n' + marker, 1)

new_course_view = r'''async function courseView(chatId:string,mid:number,id:string,page=0){
 const [{data,error},{data:links,error:linksError}]=await Promise.all([
  db.from('courses').select('*').eq('id',id).single(),
  db.from('course_programs').select('program_id,requirement_type,academic_programs(name_ar,degree_ar)').eq('course_code',
   (await db.from('courses').select('code').eq('id',id).single()).data?.code||'')
 ]);
 if(error)throw error;
 if(linksError)throw linksError;
 const programs=(links||[]).map((x:any)=>x.academic_programs?.name_ar).filter(Boolean);
 await edit(chatId,mid,`${data.code} — ${data.name_ar}
الاسم الإنجليزي: ${data.name_en||'—'}
الكلية: ${data.college_ar||data.college||'—'}
القسم: ${data.department_ar||data.department||'—'}
التخصصات: ${programs.length?programs.join('، '):'غير مربوط'}
نوع المتطلب: ${data.requirement_type||'major'}
الساعات: ${data.credit_hours||'—'}
الحالة: ${data.active?'نشطة':'متوقفة'}`,[
  [{text:'✏️ الاسم العربي',callback_data:`c:e:${id}:n:${page}`},{text:'🌐 الاسم الإنجليزي',callback_data:`c:e:${id}:e:${page}`}],
  [{text:'🏷 تعديل الرمز',callback_data:`c:e:${id}:c:${page}`},{text:'⏱ تعديل الساعات',callback_data:`c:e:${id}:h:${page}`}],
  [{text:'📶 المستوى',callback_data:`c:e:${id}:l:${page}`},{text:'📝 الوصف',callback_data:`c:e:${id}:x:${page}`}],
  [{text:'🧩 نوع المتطلب',callback_data:`c:e:${id}:r:${page}`}],
  [{text:data.active?'🔴 إيقاف المادة':'🟢 تفعيل المادة',callback_data:`course:toggle:${id}:${data.active?'off':'on'}:${page}`}],
  [{text:'🗑 حذف المادة',callback_data:`course:deleteask:${id}:${page}`}],
  [{text:'⬅️ المواد',callback_data:`course:list:${page}`}]
 ]);
}
'''
source, count = re.subn(
    r"async function courseView\(chatId:string,mid:number,id:string,page=0\)\{.*?\n\}\n\nasync function contentMenu",
    new_course_view + '\nasync function contentMenu',
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('courseView block not found')

new_conversation = r''' if(state==='course_add_code'){
  const code=text.toUpperCase().replace(/\s+/g,'');
  if(!/^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code)){
   await send(chatId,'رمز المادة غير صحيح. مثال: STAT101');
   return true;
  }
  const {data:existing}=await db.from('courses').select('id').eq('code',code).maybeSingle();
  if(existing){await send(chatId,'هذا الرمز موجود مسبقًا');return true;}
  await setConversation(chatId,'course_add_name_ar',{code});
  await send(chatId,'أرسل اسم المادة بالعربي');
  return true;
 }
 if(state==='course_add_name_ar'){
  await setConversation(chatId,'course_add_name_en',{...data,name_ar:text});
  await send(chatId,'أرسل الاسم بالإنجليزي، أو اكتب - للتخطي');
  return true;
 }
 if(state==='course_add_name_en'){
  await setConversation(chatId,'course_add_college_choice',{...data,name_en:text==='-'?null:text});
  await send(chatId,'اختر الكلية من القائمة',await courseCollegeChoiceKeyboard());
  return true;
 }
 if(state==='course_add_hours'){
  const hours=Number(text);
  if(!Number.isFinite(hours)||hours<0||hours>12){await send(chatId,'أرسل عدد ساعات من 0 إلى 12');return true;}
  const payload={
   code:data.code,name_ar:data.name_ar,name_en:data.name_en||null,
   college:data.college_ar,college_ar:data.college_ar,college_en:data.college_en||null,
   department:data.department_ar,department_ar:data.department_ar,department_en:data.department_en||null,
   credit_hours:hours||null,active:true,status:'approved',updated_at:new Date().toISOString()
  };
  const {data:saved,error}=await db.from('courses').upsert(payload,{onConflict:'code'}).select('id,code').single();
  if(error)throw error;
  await db.from('course_programs').delete().eq('course_code',saved.code);
  const programIds=[...new Set((data.program_ids||[]).map(String))];
  if(programIds.length){
   const {error:linkError}=await db.from('course_programs').insert(programIds.map((program_id:string)=>({
    course_code:saved.code,program_id,requirement_type:'major'
   })));
   if(linkError)throw linkError;
  }
  await clearConversation(chatId);
  audit(admin,'course_create','courses',saved.id,{...payload,program_ids:programIds});
  await send(chatId,`تمت إضافة المادة وربطها بـ ${programIds.length} تخصص ✅`,[[{text:'📘 فتح مركز المقررات',callback_data:'courses:menu'}]]);
  return true;
 }

 if(state==='course_edit_value'){
  const value=['credit_hours','level'].includes(data.field)?Number(text)||null:data.field==='code'?text.toUpperCase().replace(/\s+/g,''):text==='-'?null:text;
  const {data:before,error:beforeError}=await db.from('courses').select('code').eq('id',data.id).single();
  if(beforeError)throw beforeError;
  const {error}=await db.from('courses').update({[data.field]:value,updated_at:new Date().toISOString()}).eq('id',data.id);
  if(error)throw error;
  if(data.field==='code'&&before.code!==value){
   await db.from('course_programs').update({course_code:value}).eq('course_code',before.code);
  }
  await clearConversation(chatId);
  audit(admin,'course_update','courses',data.id,{field:data.field,value});
  await send(chatId,'تم تعديل المادة ✅',[[{text:'فتح المادة',callback_data:`course:view:${data.id}:${data.page||0}`}]]);
  return true;
 }
'''
source, count = re.subn(
    r" if\(state==='course_add_code'\)\{.*? if\(state==='course_edit_value'\)\{.*?\n \}\n\n if\(state==='slide_add_title'\)",
    new_conversation + "\n if(state==='slide_add_title')",
    source,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit('course conversation block not found')

old_start = """    else if(data==='course:add:start'){
     if(!can(admin,'courses'))throw new Error('ليس لديك صلاحية إدارة المقررات');
     await setConversation(chatId,'course_add_code',{});
     await edit(chatId,mid,'أرسل رمز المادة مثل STAT101',[[{text:'⬅️ إلغاء',callback_data:'courses:menu'}]]);
    }
"""
new_start = old_start + r'''    else if(data==='course:add:college'){
     const conv=await getCourseConversation(chatId);
     await setConversation(chatId,'course_add_college_choice',conv.data||{});
     await edit(chatId,mid,'اختر الكلية',await courseCollegeChoiceKeyboard());
    }
    else if(data.startsWith('ca:c:')){
     const collegeId=data.split(':')[2];
     const conv=await getCourseConversation(chatId);
     const {data:college,error}=await db.from('academic_colleges').select('*').eq('id',collegeId).single();
     if(error)throw error;
     await setConversation(chatId,'course_add_department_choice',{...(conv.data||{}),college_id:college.id,college_ar:college.name_ar,college_en:college.name_en});
     await edit(chatId,mid,`الكلية: ${college.name_ar}\nاختر القسم`,await courseDepartmentChoiceKeyboard(college.id));
    }
    else if(data.startsWith('ca:backd:')){
     const collegeId=data.split(':')[2];
     await edit(chatId,mid,'اختر القسم',await courseDepartmentChoiceKeyboard(collegeId));
    }
    else if(data.startsWith('ca:d:')){
     const departmentId=data.split(':')[2];
     const conv=await getCourseConversation(chatId);
     const {data:department,error}=await db.from('academic_departments').select('*').eq('id',departmentId).single();
     if(error)throw error;
     const next={...(conv.data||{}),department_id:department.id,department_ar:department.name_ar,department_en:department.name_en,program_ids:[]};
     await setConversation(chatId,'course_add_program_choice',next);
     await courseProgramChoice(chatId,mid,next);
    }
    else if(data.startsWith('ca:p:')){
     const programId=data.split(':')[2];
     const conv=await getCourseConversation(chatId);
     const selected=new Set<string>((conv.data?.program_ids||[]).map(String));
     if(selected.has(programId))selected.delete(programId);else selected.add(programId);
     const next={...(conv.data||{}),program_ids:[...selected]};
     await setConversation(chatId,'course_add_program_choice',next);
     await courseProgramChoice(chatId,mid,next);
    }
    else if(data==='ca:done'){
     const conv=await getCourseConversation(chatId);
     await setConversation(chatId,'course_add_hours',conv.data||{});
     await edit(chatId,mid,'أرسل عدد الساعات المعتمدة، أو 0 إذا غير معروف',[[{text:'⬅️ إلغاء',callback_data:'courses:menu'}]]);
    }
'''
if old_start not in source:
    raise SystemExit('course add callback start not found')
source = source.replace(old_start, new_start, 1)

# Delete linked program rows explicitly before deleting a course.
old_delete = """     const [, ,id,page]=data.split(':');
     const {error}=await db.from('courses').delete().eq('id',id);
     if(error)throw error;
"""
new_delete = """     const [, ,id,page]=data.split(':');
     const {data:item,error:itemError}=await db.from('courses').select('code').eq('id',id).single();
     if(itemError)throw itemError;
     await db.from('course_programs').delete().eq('course_code',item.code);
     const {error}=await db.from('courses').delete().eq('id',id);
     if(error)throw error;
"""
if old_delete not in source:
    raise SystemExit('course delete callback not found')
source = source.replace(old_delete, new_delete, 1)

path.write_text(source, encoding='utf-8')
print('Telegram course flow patched successfully')
