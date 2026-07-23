import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const URL=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const db=createClient(URL,KEY);

async function tg(chat_id:string,text:string){
 const result=await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`,{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({chat_id,text})
 });
 if(!result.ok)throw new Error(await result.text());
}

Deno.serve(async req=>{
 try{
  const body=await req.json().catch(()=>({}));
  const now=new Date();
  const todayStart=new Date(now); todayStart.setHours(0,0,0,0);
  const yesterdayStart=new Date(todayStart.getTime()-86400000);
  const todayISO=todayStart.toISOString();
  const yesterdayISO=yesterdayStart.toISOString();

  const [
   {data:todayEvents},{data:yesterdayEvents},
   {count:suggestions},{count:reports},{count:errors},
   {count:summaries},{count:pendingSummaries},{count:groups},{count:pendingGroups},
   {count:ratings},{count:pendingRatings},{data:admins},{data:state}
  ]=await Promise.all([
   db.from('usage_events').select('event_type,metadata,session_id').gte('created_at',todayISO),
   db.from('usage_events').select('event_type,metadata,session_id').gte('created_at',yesterdayISO).lt('created_at',todayISO),
   db.from('feature_suggestions').select('id',{count:'exact',head:true}).eq('status','pending'),
   db.from('broken_link_reports').select('id',{count:'exact',head:true}).eq('status','pending'),
   db.from('system_errors').select('id',{count:'exact',head:true}).gte('created_at',todayISO),
   db.from('summaries').select('id',{count:'exact',head:true}).eq('approved',true),
   db.from('summaries').select('id',{count:'exact',head:true}).eq('approved',false),
   db.from('whatsapp_groups').select('id',{count:'exact',head:true}).eq('approved',true),
   db.from('whatsapp_groups').select('id',{count:'exact',head:true}).eq('approved',false),
   db.from('rating_submissions').select('id',{count:'exact',head:true}).eq('status','approved'),
   db.from('rating_submissions').select('id',{count:'exact',head:true}).eq('status','pending'),
   db.from('telegram_admins').select('chat_id').eq('active',true).eq('notifications_enabled',true),
   db.rpc('uon_public_state')
  ]);

  const visitors=new Set((todayEvents||[]).map((x:any)=>x.session_id).filter(Boolean)).size;
  const yesterdayVisitors=new Set((yesterdayEvents||[]).map((x:any)=>x.session_id).filter(Boolean)).size;
  const diff=visitors-yesterdayVisitors;
  const percent=yesterdayVisitors?Math.round((diff/yesterdayVisitors)*100):(visitors?100:0);
  const trend=diff>0?`📈 +${diff} (+${percent}%)`:diff<0?`📉 ${diff} (${percent}%)`:'➖ بدون تغيير';

  const featureLabels:any={
   'assistant':'UON AI','ai':'UON AI','uon-ai':'UON AI','summaries':'الملخصات',
   'groups':'المجموعات','whatsapp':'المجموعات','gpa':'حاسبة المعدل','ratings':'التقييمات',
   'courses':'المقررات','projects':'المشاريع الطلابية','useful-sites':'المواقع والبرامج',
   'university-guide':'دليل الجامعة','schedule':'الجدول الدراسي','calendar':'التقويم الأكاديمي'
  };
  const features:any={},searches:any={};
  for(const event of todayEvents||[]){
   if(event.event_type==='feature_open'&&event.metadata?.feature){
    const key=String(event.metadata.feature);
    features[key]=(features[key]||0)+1;
   }
   if((event.event_type==='search'||event.event_type==='assistant_question')&&event.metadata?.query){
    const query=String(event.metadata.query).trim();
    searches[query]=(searches[query]||0)+1;
   }
  }

  const topFeatures=Object.entries(features).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)
   .map(([key,value],i)=>`${i+1}. ${featureLabels[key]||key}: ${value}`).join('\n')||'لا توجد بيانات';
  const topSearches=Object.entries(searches).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)
   .map(([key,value])=>`${key}: ${value}`).join('\n')||'لا توجد بيانات';
  const pendingTotal=(pendingSummaries||0)+(pendingGroups||0)+(pendingRatings||0)+(suggestions||0)+(reports||0);

  const text=`📊 تقرير UON Hub اليومي

👥 الزوار اليوم: ${visitors}
👤 الزوار أمس: ${yesterdayVisitors}
${trend}
🧭 أحداث الاستخدام: ${(todayEvents||[]).length}

📚 الملخصات: ${summaries||0} معتمد | ${pendingSummaries||0} معلق
💬 المجموعات: ${groups||0} معتمد | ${pendingGroups||0} معلق
⭐ التقييمات: ${ratings||0} معتمد | ${pendingRatings||0} معلق
💡 الاقتراحات المعلقة: ${suggestions||0}
🔗 بلاغات الروابط: ${reports||0}
🕓 إجمالي الطلبات المعلقة: ${pendingTotal}
⚠️ الأخطاء اليوم: ${errors||0}
🛠 الصيانة: ${state?.maintenance_enabled?'مفعلة 🔴':'متوقفة ✅'}

🔥 أكثر الأدوات استخدامًا
${topFeatures}

🔎 أكثر عمليات البحث
${topSearches}`;

  const recipients=body.chat_id?[{chat_id:String(body.chat_id)}]:(admins||[]);
  for(const admin of recipients)await tg(String(admin.chat_id),text);

  return new Response(JSON.stringify({ok:true,recipients:recipients.length}),{
   headers:{'content-type':'application/json'}
  });
 }catch(error){
  return new Response(JSON.stringify({ok:false,error:String(error?.message||error)}),{
   status:500,headers:{'content-type':'application/json'}
  });
 }
});
