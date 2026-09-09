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
    signal:AbortSignal.timeout(10000)
  });
  const text=await response.text();
  let payload=null;
  try{payload=JSON.parse(text)}catch{payload={raw:text.slice(0,300)}}
  return {status:response.status,ok:response.ok,payload};
}

const contacts=await rpc('uon_public_contact_numbers',{});
const questions=await rpc('uon_submit_exam_question_v2',{
  p_college:'',p_subject:'',p_text:'',p_session_id:null,p_answer:null,p_type:'mcq',p_year:null
});

function line(label,result){
  const code=result.payload?.code||'';
  const message=String(result.payload?.message||result.payload?.error||'').replace(/\s+/g,' ').slice(0,160);
  const rows=Array.isArray(result.payload)?result.payload.length:'-';
  console.log(`[release-probe] ${label} status=${result.status} ok=${result.ok} code=${code||'-'} rows=${rows} message=${message||'-'}`);
}

line('contacts',contacts);
line('questions',questions);
