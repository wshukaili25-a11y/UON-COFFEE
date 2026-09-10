const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const headers={apikey:SUPABASE_KEY,'Content-Type':'application/json'};

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false});
  const out={};
  for(const name of ['uon_public_contact_numbers','uon_submit_exam_question_v2']){
    try{
      const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
        method:'POST',headers,cache:'no-store',
        body:name==='uon_public_contact_numbers'?'{}':JSON.stringify({p_college:'',p_subject:'',p_text:'',p_session_id:null,p_answer:null,p_type:'mcq',p_year:null})
      });
      const text=await r.text();
      out[name]={status:r.status,exists:r.status!==404&& !text.includes('PGRST202'),preview:text.slice(0,180)};
    }catch(e){out[name]={status:0,exists:false,error:String(e?.message||e)}}
  }
  return res.status(200).json(out);
}
