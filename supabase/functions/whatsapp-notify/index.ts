import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';
const URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(URL,SERVICE);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-admin-password','Access-Control-Allow-Methods':'POST,OPTIONS'};
const response=(b:any,s=200)=>new Response(typeof b==='string'?b:JSON.stringify(b),{status:s,headers:{...cors,'content-type':'application/json'}});
async function authorized(req:Request){
 const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(bearer&&bearer===SERVICE)return true;
 const password=req.headers.get('x-admin-password')||'';
 if(!password)return false;
 const {data,error}=await db.rpc('uon_admin_authorized',{p_password:password});
 return !error&&data===true;
}
const TOKEN=Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const PHONE_ID=Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
const TEMPLATE=Deno.env.get('WHATSAPP_TEMPLATE_NAME')||'uon_hub_notification';
const LANG=Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE')||'ar';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return response({ok:false,error:'method not allowed'},405);
 if(!(await authorized(req)))return response({ok:false,error:'unauthorized'},401);
 try{
  if(!TOKEN||!PHONE_ID)throw new Error('WhatsApp secrets missing');
  const p=await req.json().catch(()=>({}));
  const message=String(p.message||'').trim().slice(0,900);
  const to=String(p.to||Deno.env.get('WHATSAPP_ADMIN_PHONE')||'').replace(/\D/g,'');
  if(!to)throw new Error('recipient missing');
  if(message.length<2)throw new Error('message missing');
  const payload={messaging_product:'whatsapp',to,type:'template',template:{name:TEMPLATE,language:{code:LANG},components:[{type:'body',parameters:[{type:'text',text:message}]}]}};
  const r=await fetch(`https://graph.facebook.com/v23.0/${PHONE_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${TOKEN}`,'content-type':'application/json'},body:JSON.stringify(payload)});
  const j=await r.json();
  await db.from('notification_log').insert({channel:'whatsapp',event_type:String(p.type||'manual').slice(0,80),destination:to,status:r.ok?'sent':'failed',error:r.ok?null:JSON.stringify(j),payload});
  if(!r.ok)throw new Error(JSON.stringify(j));
  return response({ok:true,result:j});
 }catch(e){return response({ok:false,error:String(e?.message||e)},500)}
});
