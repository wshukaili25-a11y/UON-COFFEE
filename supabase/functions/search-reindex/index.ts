
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'content-type':'application/json'}});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const sources:any={
 summaries:{title:'title',body:['subject','college','description'],url:'url',filter:{approved:true}},
 whatsapp_groups:{title:'subject',body:['course_code','college'],url:'link',filter:{approved:true}},
 student_projects:{title:'title',body:['major','description','owner_name'],url:'url',filter:{status:'approved'}},
 university_programs:{title:'name_ar',body:['name_en','college','degree'],url:'official_url',filter:{active:true}},
 tools_items:{title:'name',body:['description'],url:'url',filter:{status:'active'}}
};

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{status:204,headers:cors});
 try{
  let indexed=0;
  await db.from('search_index').delete().neq('id',0);

  for(const [table,def] of Object.entries(sources) as any){
   let query=db.from(table).select('*');
   for(const [key,value] of Object.entries(def.filter))query=query.eq(key,value);

   const {data,error}=await query;
   if(error)throw error;

   for(const item of data||[]){
    const row={
     source_table:table,
     source_id:String(item.id),
     title:item[def.title]||'',
     body:def.body.map((key:string)=>item[key]||'').join(' '),
     url:item[def.url]||'',
     active:true,
     updated_at:new Date().toISOString()
    };
    const {error:upsertError}=await db.from('search_index').upsert(row,{onConflict:'source_table,source_id'});
    if(upsertError)throw upsertError;
    indexed++;
   }
  }

  return reply({ok:true,indexed});
 }catch(error){
  return reply({ok:false,error:String(error?.message||error)},500);
 }
});
