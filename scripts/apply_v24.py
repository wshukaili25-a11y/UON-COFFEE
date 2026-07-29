#!/usr/bin/env python3
from pathlib import Path
import shutil

TARGET=Path('supabase/functions/telegram-admin/index.ts')
if not TARGET.exists(): raise SystemExit(f'لم أجد {TARGET}')
text=TARGET.read_text(encoding='utf-8')
if 'UON_AI_SUPERVISOR_V24' in text: raise SystemExit('V24 مركبة مسبقًا')
backup=TARGET.with_name('index.ts.bak-v24')
shutil.copy2(TARGET,backup)

def replace_once(old,new,name):
 global text
 if old not in text: raise SystemExit(f'تعذر إيجاد نقطة الدمج: {name}')
 text=text.replace(old,new,1)

replace_once("  [{text:'🕓 الطلبات المعلقة',callback_data:'pending:menu'}],",
"  [{text:'🕓 الطلبات المعلقة',callback_data:'pending:menu'}],\n  [{text:'🤖 مركز المشرف الذكي',callback_data:'ai:menu'}],",'main menu')

AI_CODE=r'''
// UON_AI_SUPERVISOR_V24

type AiAssessment={score:number;recommendation:'approve'|'review'|'reject';reasons:string[];flags:string[]};

function aiSource(item:any,cfg:any){
 const fields=[...(cfg?.fields||[]),'title','subject','text','content','comment','details','description','contact','course_code','college','major'];
 return fields.map((f:string)=>item?.[f]).filter((v:any)=>v!==null&&v!==undefined&&v!=='')
  .map((v:any)=>typeof v==='object'?JSON.stringify(v):String(v)).join(' ').trim();
}
function aiAssess(table:string,item:any,cfg:any):AiAssessment{
 const source=aiSource(item,cfg); let score=72; const reasons:string[]=[]; const flags:string[]=[];
 const link=(cfg?.urlFields||[]).map((f:string)=>validExternalUrl(item?.[f])).find(Boolean);
 if(source.length>=15){score+=7;reasons.push('المحتوى واضح وكافٍ');}else{score-=22;flags.push('short');reasons.push('المحتوى قصير أو ناقص');}
 if(['summaries','whatsapp_groups','student_projects'].includes(table)){
  if(link){score+=12;reasons.push('الرابط أو الملف صالح');}else{score-=28;flags.push('missing_link');reasons.push('الرابط أو الملف غير موجود');}
 }
 if(item?.course_code){score+=5;reasons.push('رمز المادة محدد');}
 if(item?.college){score+=3;reasons.push('الكلية محددة');}
 if(/\b(?:\+?968)?[79]\d{7}\b|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|@\w{3,}/i.test(source)){
  score-=18;flags.push('personal_data');reasons.push('قد يحتوي معلومات شخصية');
 }
 if(/(.)\1{9,}|ربح سريع|استثمار مضمون|تحويل مالي|اضغط الرابط|خصم حصري/i.test(source)){
  score-=28;flags.push('spam');reasons.push('مؤشرات سبام أو إعلان مزعج');
 }
 if(/تهديد|ابتزاز|قذف|تشهير|إيذاء النفس|انتحار/i.test(source)){
  score-=42;flags.push('sensitive');reasons.push('محتوى حساس يحتاج مراجعة بشرية');
 }
 score=Math.max(0,Math.min(100,score));
 return {score,recommendation:score>=87?'approve':score>=55?'review':'reject',reasons:[...new Set(reasons)].slice(0,6),flags:[...new Set(flags)]};
}
const aiLabel=(r:string)=>r==='approve'?'🟢 مقترح قبول':r==='reject'?'🔴 مقترح رفض':'🟡 مراجعة بشرية';
async function saveAiReview(table:string,id:string,a:AiAssessment){
 const {error}=await db.from('ai_supervisor_reviews').upsert({source_table:table,source_id:String(id),score:a.score,recommendation:a.recommendation,reasons:a.reasons,flags:a.flags,reviewed_by_ai_at:new Date().toISOString()},{onConflict:'source_table,source_id'});
 if(error)throw error;
}
async function aiSettings(){
 const {data}=await db.from('ai_supervisor_settings').select('*').eq('id',true).maybeSingle();
 return data||{enabled:true,auto_approve_enabled:false,auto_approve_threshold:97};
}
async function aiMenu(chatId:string,mid:number,admin:any){
 if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية الإشراف');
 const s=await aiSettings(); const counts=await pendingCounts();
 const total=Object.values(counts).reduce((a:any,b:any)=>Number(a)+Number(b),0);
 const {count:flagged}=await db.from('ai_supervisor_reviews').select('id',{count:'exact',head:true}).neq('flags','[]');
 await edit(chatId,mid,`🤖 مركز المشرف الذكي\n\nالحالة: ${s.enabled?'🟢 يعمل':'🔴 متوقف'}\nالمعلّقة: ${total}\nالمعلّمة بخطر: ${flagged||0}\nالقبول التلقائي: ${s.auto_approve_enabled?'مفعل':'متوقف'}\nحد الثقة: ${s.auto_approve_threshold}%`,[
  [{text:'🧠 تحليل المعلّقة',callback_data:'ai:scan'}],
  [{text:'🟡 قائمة المراجعة',callback_data:'ai:queue:review'},{text:'🔴 قائمة الخطر',callback_data:'ai:queue:flagged'}],
  [{text:'📊 التقرير',callback_data:'ai:report'},{text:'🩺 صحة النظام',callback_data:'ai:health'}],
  [{text:s.enabled?'🔴 إيقاف AI':'🟢 تشغيل AI',callback_data:`ai:toggle:${s.enabled?'0':'1'}`}],
  [{text:'⚙️ القبول التلقائي',callback_data:'ai:auto'}],
  [{text:'⬅️ الرئيسية',callback_data:'home'}]
 ]);
}
async function aiScan(chatId:string,mid:number,admin:any){
 let scanned=0,approve=0,review=0,reject=0;
 for(const [table,cfg] of Object.entries(pendingConfigs) as any[]){
  const {data}=await db.from(table).select('*').eq(cfg.status,cfg.pending).order('created_at',{ascending:true}).limit(40);
  for(const item of data||[]){const a=aiAssess(table,item,cfg);await saveAiReview(table,item.id,a);scanned++;a.recommendation==='approve'?approve++:a.recommendation==='reject'?reject++:review++;}
 }
 audit(admin,'ai_scan','ai_supervisor_reviews','',{scanned,approve,review,reject});
 await edit(chatId,mid,`اكتمل التحليل ✅\n\nتم فحص: ${scanned}\n🟢 قبول: ${approve}\n🟡 مراجعة: ${review}\n🔴 رفض: ${reject}`,[[{text:'🤖 المركز',callback_data:'ai:menu'}],[{text:'🕓 الطلبات',callback_data:'pending:menu'}]]);
}
async function aiQueue(chatId:string,mid:number,mode:string){
 let q=db.from('ai_supervisor_reviews').select('*').order('reviewed_by_ai_at',{ascending:false}).limit(20);
 q=mode==='flagged'?q.neq('flags','[]'):q.eq('recommendation','review');
 const {data,error}=await q;if(error)throw error;
 const rows=(data||[]).map((x:any)=>[{text:`${x.score}% — ${x.source_table}`,callback_data:`ai:open:${pendingCode(x.source_table)}:${x.source_id}`}]);
 rows.push([{text:'⬅️ مركز AI',callback_data:'ai:menu'}]);
 await edit(chatId,mid,rows.length>1?(mode==='flagged'?'الطلبات عالية الخطورة':'طلبات تحتاج مراجعة'):'لا توجد نتائج',rows);
}
async function aiReport(chatId:string,mid:number){
 const {data}=await db.from('ai_supervisor_reviews').select('recommendation,flags,reviewed_by_ai_at').order('reviewed_by_ai_at',{ascending:false}).limit(250);
 const s={approve:0,review:0,reject:0,flagged:0};for(const x of data||[]){s[x.recommendation as 'approve'|'review'|'reject']++;if((x.flags||[]).length)s.flagged++;}
 await edit(chatId,mid,`📊 تقرير AI\n\nإجمالي التحليلات: ${(data||[]).length}\n🟢 قبول: ${s.approve}\n🟡 مراجعة: ${s.review}\n🔴 رفض: ${s.reject}\n🚩 مؤشرات خطر: ${s.flagged}`,[[{text:'🧠 تحليل الآن',callback_data:'ai:scan'}],[{text:'⬅️ مركز AI',callback_data:'ai:menu'}]]);
}
async function aiHealth(chatId:string,mid:number){
 const checks:any[]=[];
 for(const table of ['telegram_admins','platform_features','bot_audit_log','ai_supervisor_reviews']){
  const {error}=await db.from(table).select('*',{head:true,count:'exact'}).limit(1);checks.push(`${error?'❌':'✅'} ${table}`);
 }
 const {count:errors}=await db.from('system_errors').select('id',{head:true,count:'exact'}).gte('created_at',new Date(Date.now()-86400000).toISOString());
 await edit(chatId,mid,`🩺 صحة النظام\n\n${checks.join('\n')}\n\nأخطاء آخر 24 ساعة: ${errors||0}`,[[{text:'🔄 تحديث',callback_data:'ai:health'}],[{text:'⬅️ مركز AI',callback_data:'ai:menu'}]]);
}
async function decisionSnapshot(table:string,id:string){const {data}=await db.from(table).select('*').eq('id',id).maybeSingle();return data||{};}
async function recordDecision(admin:any,table:string,id:string,action:string,oldState:any,newState:any,note=''){
 await db.from('moderation_decisions').insert({source_table:table,source_id:String(id),action,old_state:oldState||{},new_state:newState||{},admin_chat_id:String(admin.chat_id),admin_name:admin.name||'',note:note||null});
}
async function needsChanges(table:string,id:string,admin:any){
 const cfg=pendingConfigs[table];const before=await decisionSnapshot(table,id);
 const patch=cfg.booleanModeration?{approved:false,moderation_status:'needs_changes'}:{[cfg.status]:'needs_changes'};
 let r=await db.from(table).update({...patch,reviewed_at:new Date().toISOString()}).eq('id',id);
 if(r.error&&/moderation_status|reviewed_at|column/i.test(r.error.message||''))r=await db.from(table).update(cfg.booleanModeration?{approved:false}:{[cfg.status]:'needs_changes'}).eq('id',id);
 if(r.error)throw r.error;await recordDecision(admin,table,id,'needs_changes',before,patch);audit(admin,'pending_needs_changes',table,id);
}
async function assignmentMenu(chatId:string,mid:number,table:string,id:string,page:number,admin:any){
 const {data:admins}=await db.from('telegram_admins').select('chat_id,name,role').eq('active',true).order('name');
 const rows=(admins||[]).map((x:any)=>[{text:`👤 ${x.name} (${x.role})`,callback_data:`ai:as:${pendingCode(table)}:${id}:${x.chat_id}:${page}`}]);
 rows.push([{text:'⬅️ الطلب',callback_data:pendingCb('v',table,id,page)}]);await edit(chatId,mid,'اختر المشرف الذي سيتولى الطلب',rows);
}
'''
replace_once('async function pendingCounts(){',AI_CODE+'\nasync function pendingCounts(){','AI functions')

OLD="""  const keyboard:any[]=[];
  const external=(cfg.urlFields||[]).map((f:string)=>validExternalUrl(data[f])).find(Boolean);"""
NEW="""  const ai=aiAssess(table,data,cfg);
  await saveAiReview(table,id,ai);
  const keyboard:any[]=[];
  const external=(cfg.urlFields||[]).map((f:string)=>validExternalUrl(data[f])).find(Boolean);"""
replace_once(OLD,NEW,'pending assessment')

replace_once("""  keyboard.push([
   {text:'✅ قبول',callback_data:pendingCb('a',table,id,page)},
   {text:'❌ رفض',callback_data:pendingCb('r',table,id,page)}
  ]);""",
"""  keyboard.push([
   {text:'✅ قبول',callback_data:pendingCb('a',table,id,page)},
   {text:'❌ رفض',callback_data:pendingCb('r',table,id,page)}
  ]);
  keyboard.push([
   {text:'🟡 يحتاج تعديل',callback_data:pendingCb('n',table,id,page)},
   {text:'👤 توزيع',callback_data:`ai:assign:${pendingCode(table)}:${id}:${page}`}
  ]);""",'pending buttons')

replace_once("""  await edit(chatId,mid,`${cfg.title}
${lines||'لا توجد تفاصيل إضافية'}`,keyboard);""",
"""  await edit(chatId,mid,`${cfg.title}
${lines||'لا توجد تفاصيل إضافية'}

🤖 تقييم المشرف الذكي
النتيجة: ${ai.score}/100
التوصية: ${aiLabel(ai.recommendation)}
${ai.reasons.map((x:string)=>`• ${x}`).join('\\n')}`,keyboard);""",'pending message')

CALLBACK=r'''
     else if(data==='ai:menu')await aiMenu(chatId,mid,admin);
     else if(data==='ai:scan')await aiScan(chatId,mid,admin);
     else if(data==='ai:report')await aiReport(chatId,mid);
     else if(data==='ai:health')await aiHealth(chatId,mid);
     else if(data.startsWith('ai:queue:'))await aiQueue(chatId,mid,data.split(':')[2]);
     else if(data.startsWith('ai:open:')){const [, ,code,id]=data.split(':');await pendingView(chatId,mid,pendingTable(code),id,0);}
     else if(data.startsWith('ai:toggle:')){
      if(!isOwner(admin))throw new Error('للمالك فقط');const enabled=data.endsWith(':1');
      await db.from('ai_supervisor_settings').update({enabled,updated_by:chatId,updated_at:new Date().toISOString()}).eq('id',true);audit(admin,'ai_toggle','ai_supervisor_settings','',{enabled});await aiMenu(chatId,mid,admin);
     }
     else if(data==='ai:auto'){
      if(!isOwner(admin))throw new Error('للمالك فقط');const s=await aiSettings();
      await edit(chatId,mid,`⚙️ القبول التلقائي\n\nالحالة: ${s.auto_approve_enabled?'مفعل':'متوقف'}\nالحد: ${s.auto_approve_threshold}%`,[
       [{text:s.auto_approve_enabled?'🔴 إيقاف':'🟢 تشغيل',callback_data:`ai:auto:t:${s.auto_approve_enabled?'0':'1'}`}],
       [{text:'95%',callback_data:'ai:auto:h:95'},{text:'97%',callback_data:'ai:auto:h:97'},{text:'99%',callback_data:'ai:auto:h:99'}],
       [{text:'⬅️ مركز AI',callback_data:'ai:menu'}]
      ]);
     }
     else if(data.startsWith('ai:auto:t:')){if(!isOwner(admin))throw new Error('للمالك فقط');await db.from('ai_supervisor_settings').update({auto_approve_enabled:data.endsWith(':1'),updated_by:chatId,updated_at:new Date().toISOString()}).eq('id',true);await aiMenu(chatId,mid,admin);}
     else if(data.startsWith('ai:auto:h:')){if(!isOwner(admin))throw new Error('للمالك فقط');await db.from('ai_supervisor_settings').update({auto_approve_threshold:Number(data.split(':')[3]),updated_by:chatId,updated_at:new Date().toISOString()}).eq('id',true);await aiMenu(chatId,mid,admin);}
     else if(data.startsWith('ai:assign:')){const [, ,code,id,page]=data.split(':');await assignmentMenu(chatId,mid,pendingTable(code),id,Number(page)||0,admin);}
     else if(data.startsWith('ai:as:')){
      const [, ,code,id,assignee,page]=data.split(':');const table=pendingTable(code);
      await db.from('moderation_assignments').insert({source_table:table,source_id:String(id),assigned_to_chat_id:String(assignee),assigned_by_chat_id:chatId});
      audit(admin,'moderation_assign',table,id,{assignee});await edit(chatId,mid,'تم توزيع الطلب ✅',[[{text:'⬅️ الطلب',callback_data:pendingCb('v',table,id,Number(page)||0)}]]);
     }
     else if(data.startsWith('p:n:')){
      if(!can(admin,'moderate'))throw new Error('ليس لديك صلاحية المراجعة');const [, ,code,id,page]=data.split(':');const table=pendingTable(code);
      await needsChanges(table,id,admin);await edit(chatId,mid,'تم تحويل الطلب إلى يحتاج تعديل 🟡',[[{text:'⬅️ القائمة',callback_data:pendingCb('l',table,Number(page)||0)}],[{text:'🤖 مركز AI',callback_data:'ai:menu'}]]);
     }
'''
replace_once("     else if(data==='audit:list'){",CALLBACK+"\n     else if(data==='audit:list'){",'callbacks')

TARGET.write_text(text,encoding='utf-8')
print('تم تعديل:',TARGET)
print('النسخة الاحتياطية:',backup)
