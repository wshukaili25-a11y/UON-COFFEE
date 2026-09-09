const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const TABLES=['ai_supervisor_settings','ai_supervisor_reviews','moderation_assignments','moderation_decisions','university_programs','university_guide_syncs'];

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  const results={};
  for(const table of TABLES){
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`,{
        headers:{apikey:SUPABASE_KEY},cache:'no-store'
      });
      const text=await r.text();
      let body;
      try{body=JSON.parse(text)}catch{body=text.slice(0,500)}
      results[table]={status:r.status,ok:r.ok,body};
    }catch(error){
      results[table]={status:0,ok:false,error:String(error?.message||error)};
    }
  }
  res.status(200).json({ok:true,results});
}
