
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const URL=Deno.env.get('SUPABASE_URL')!,KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const db=createClient(URL,KEY);
async function tg(chat_id:string,text:string){await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id,text})})}
Deno.serve(async()=>{
 try{
  const since=new Date(Date.now()-86400000).toISOString();
  const [{data:events},{data:requests},{data:errors},{data:admins}]=await Promise.all([
   db.from('usage_events').select('event_type,metadata,session_id').gte('created_at',since),
   db.from('feature_suggestions').select('id').eq('status','pending'),
   db.from('system_errors').select('id,message').gte('created_at',since),
   db.from('telegram_admins').select('chat_id').eq('active',true).eq('notifications_enabled',true)
  ]);
  const visitors=new Set((events||[]).map((x:any)=>x.session_id).filter(Boolean)).size;
  const courses:any={};(events||[]).filter((x:any)=>x.event_type==='course_view').forEach((x:any)=>{const c=x.metadata?.code;if(c)courses[c]=(courses[c]||0)+1});
  const top=Object.entries(courses).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k}: ${v}`).join('\n')||'لا توجد';
  const text=`📊 تقرير UON Hub اليومي\n\nالزوار التقريبيون: ${visitors}\nالأحداث: ${(events||[]).length}\nالطلبات المعلقة: ${(requests||[]).length}\nالأخطاء: ${(errors||[]).length}\n\nأكثر المواد استخدامًا:\n${top}`;
  for(const a of admins||[])await tg(a.chat_id,text);
  return new Response(JSON.stringify({ok:true}),{headers:{'content-type':'application/json'}});
 }catch(e){return new Response(JSON.stringify({ok:false,error:String(e)}),{status:500,headers:{'content-type':'application/json'}})}
});
