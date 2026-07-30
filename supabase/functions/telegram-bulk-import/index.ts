import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const db=createClient(URL,SERVICE);

const cors={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-admin-password',
 'Access-Control-Allow-Methods':'POST,OPTIONS'
};
const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{...cors,'content-type':'application/json'}
});

async function authorized(req:Request){
 const bearer=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(bearer&&bearer===SERVICE)return true;
 const password=req.headers.get('x-admin-password')||'';
 if(!password)return false;
 const {data,error}=await db.rpc('uon_admin_authorized',{p_password:password});
 return !error&&data===true;
}

async function telegramFileUrl(fileId:string){
 const response=await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
 const result=await response.json();
 if(!response.ok||!result.ok)throw new Error(result.description||'تعذر قراءة ملف Telegram');
 return `https://api.telegram.org/file/bot${TOKEN}/${result.result.file_path}`;
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{status:204,headers:cors});
 if(!(await authorized(req)))return reply({ok:false,error:'unauthorized'},401);
 try{
  const body=await req.json();
  const college=String(body.college||'');
  const subject=String(body.subject||'استيراد Telegram');
  const items=Array.isArray(body.items)?body.items:[];
  if(!items.length)return reply({ok:false,error:'items required'},400);

  let imported=0,skipped=0;
  const results:any[]=[];
  for(const item of items.slice(0,100)){
   try{
    const title=String(item.title||item.file_name||'ملف بدون اسم').slice(0,180);
    let url=String(item.url||'');
    if(!url&&item.file_id)url=await telegramFileUrl(String(item.file_id));
    if(!url)throw new Error('لا يوجد رابط أو file_id');

    const {data,error}=await db.from('summaries').insert({
     title,subject,college,course_code:item.course_code||null,
     url,link:url,
     description:item.description||'تم استيراده جماعيًا من Telegram — بانتظار موافقة المشرف',
     approved:false,
     resource_type:item.resource_type||'file',
     content_type:item.content_type||'summary'
    }).select('id').single();
    if(error)throw error;
    imported++;
    results.push({ok:true,id:data.id,title});
   }catch(error){
    skipped++;
    results.push({ok:false,title:item?.title||item?.file_name||'',error:String(error?.message||error)});
   }
  }
  return reply({ok:true,imported,skipped,results});
 }catch(error){
  return reply({ok:false,error:String(error?.message||error)},500);
 }
});
