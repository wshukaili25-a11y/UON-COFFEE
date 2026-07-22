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
  const since=new Date(Date.now()-86400000).toISOString();

  const [
   {data:events},{count:suggestions},{count:reports},{count:errors},
   {count:summaries},{count:groups},{count:ratings},{data:admins}
  ]=await Promise.all([
   db.from('usage_events').select('event_type,metadata,session_id').gte('created_at',since),
   db.from('feature_suggestions').select('id',{count:'exact',head:true}).eq('status','pending'),
   db.from('broken_link_reports').select('id',{count:'exact',head:true}).eq('status','pending'),
   db.from('system_errors').select('id',{count:'exact',head:true}).gte('created_at',since),
   db.from('summaries').select('id',{count:'exact',head:true}).eq('approved',true),
   db.from('whatsapp_groups').select('id',{count:'exact',head:true}).eq('approved',true),
   db.from('rating_submissions').select('id',{count:'exact',head:true}).eq('status','approved'),
   db.from('telegram_admins').select('chat_id').eq('active',true).eq('notifications_enabled',true)
  ]);

  const visitors=new Set((events||[]).map((x:any)=>x.session_id).filter(Boolean)).size;
  const courses:any={},searches:any={};

  for(const event of events||[]){
   if(event.event_type==='course_view'&&event.metadata?.code){
    const code=String(event.metadata.code).toUpperCase();
    courses[code]=(courses[code]||0)+1;
   }
   if((event.event_type==='search'||event.event_type==='assistant_question')&&event.metadata?.query){
    const query=String(event.metadata.query).trim();
    searches[query]=(searches[query]||0)+1;
   }
  }

  const topCourses=Object.entries(courses).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)
   .map(([key,value])=>`${key}: ${value}`).join('\n')||'لا توجد بيانات';
  const topSearches=Object.entries(searches).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)
   .map(([key,value])=>`${key}: ${value}`).join('\n')||'لا توجد بيانات';

  const text=`📊 تقرير UON Hub اليومي

👥 الزوار التقريبيون: ${visitors}
🧭 أحداث الاستخدام: ${(events||[]).length}
📚 الملخصات المعتمدة: ${summaries||0}
💬 المجموعات المعتمدة: ${groups||0}
⭐ التقييمات المعتمدة: ${ratings||0}
💡 الاقتراحات المعلقة: ${suggestions||0}
🔗 بلاغات الروابط: ${reports||0}
⚠️ الأخطاء خلال 24 ساعة: ${errors||0}

🔥 أكثر المواد:
${topCourses}

🔎 أكثر عمليات البحث:
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
