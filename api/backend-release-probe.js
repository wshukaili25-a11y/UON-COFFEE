const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const HEADERS={apikey:KEY,'Content-Type':'application/json'};

async function post(path,body){
  try{
    const response=await fetch(`${SUPABASE_URL}${path}`,{
      method:'POST',headers:HEADERS,body:JSON.stringify(body||{}),cache:'no-store'
    });
    const text=await response.text();
    let payload=text;
    try{payload=JSON.parse(text)}catch{}
    return {status:response.status,ok:response.ok,payload};
  }catch(error){
    return {status:0,ok:false,error:String(error?.message||error)};
  }
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});

  const contacts=await post('/rest/v1/rpc/uon_public_contact_numbers',{});
  const questions=await post('/rest/v1/rpc/uon_submit_exam_question_v2',{
    p_college:'',p_subject:'',p_text:'',p_session_id:null,p_answer:null,p_type:'mcq',p_year:null
  });

  let telegram;
  try{
    const response=await fetch(`${SUPABASE_URL}/functions/v1/telegram-admin-core`,{
      method:'POST',headers:{...HEADERS},body:'{}',cache:'no-store'
    });
    const text=await response.text();
    telegram={status:response.status,ok:response.ok,body:text.slice(0,500)};
  }catch(error){
    telegram={status:0,ok:false,error:String(error?.message||error)};
  }

  const missing=(value)=>value?.status===404 && JSON.stringify(value?.payload||'').includes('PGRST202');
  return res.status(200).json({
    ok:true,
    contacts:{...contacts,missing:missing(contacts)},
    questions:{...questions,missing:missing(questions)},
    telegram,
    checked_at:new Date().toISOString()
  });
}
