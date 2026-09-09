const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const PUBLIC_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';

async function rpc(name,body){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'apikey':PUBLIC_KEY,
      'authorization':`Bearer ${PUBLIC_KEY}`
    },
    body:JSON.stringify(body||{}),
    signal:AbortSignal.timeout(8000)
  });
  const text=await response.text();
  let payload=null;
  try{payload=JSON.parse(text)}catch{payload={raw:text.slice(0,500)}}
  return {status:response.status,ok:response.ok,payload};
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  try{
    const contacts=await rpc('uon_public_contact_numbers',{});
    const questions=await rpc('uon_submit_exam_question_v2',{
      p_college:'',
      p_subject:'',
      p_text:'',
      p_session_id:null,
      p_answer:null,
      p_type:'mcq',
      p_year:null
    });
    const summarize=(result)=>({
      status:result.status,
      ok:result.ok,
      code:result.payload?.code||null,
      message:String(result.payload?.message||result.payload?.error||'').slice(0,180),
      rows:Array.isArray(result.payload)?result.payload.length:null
    });
    return res.status(200).json({contacts:summarize(contacts),questions:summarize(questions)});
  }catch(error){
    return res.status(502).json({error:error?.name==='TimeoutError'?'probe_timeout':'probe_failed'});
  }
}
