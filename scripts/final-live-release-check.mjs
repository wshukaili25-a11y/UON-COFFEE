const url='https://irkhvydgxpseflggbeqq.supabase.co';
const key='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const headers={apikey:key,'Content-Type':'application/json'};

async function jsonPost(path,body={}){
  const r=await fetch(url+path,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store'});
  const text=await r.text();
  let data=null; try{data=text?JSON.parse(text):null}catch{data=text}
  return {status:r.status,ok:r.ok,data,text};
}

try{
  const state=await jsonPost('/rest/v1/rpc/uon_public_state',{});
  console.log(`UON_RELEASE state_status=${state.status} maintenance_enabled=${state.data?.maintenance_enabled===true}`);
}catch(e){console.log(`UON_RELEASE state_error=${String(e?.message||e)}`)}

try{
  const contact=await jsonPost('/rest/v1/rpc/uon_public_contact_numbers',{});
  const count=Array.isArray(contact.data)?contact.data.length:-1;
  console.log(`UON_RELEASE contact_rpc_status=${contact.status} ok=${contact.ok} rows=${count}`);
}catch(e){console.log(`UON_RELEASE contact_rpc_error=${String(e?.message||e)}`)}

try{
  const question=await jsonPost('/rest/v1/rpc/uon_submit_exam_question_v2',{
    p_college:'',p_subject:'',p_text:'',p_session_id:null,p_answer:null,p_type:'mcq',p_year:null
  });
  const safePreview=String(question.data?.message||question.data?.error||question.text||'').replace(/\s+/g,' ').slice(0,140);
  console.log(`UON_RELEASE question_rpc_status=${question.status} ok=${question.ok} preview=${safePreview}`);
}catch(e){console.log(`UON_RELEASE question_rpc_error=${String(e?.message||e)}`)}

try{
  const r=await fetch(url+'/functions/v1/telegram-admin-core',{method:'GET',headers:{apikey:key},cache:'no-store'});
  console.log(`UON_RELEASE telegram_core_status=${r.status}`);
}catch(e){console.log(`UON_RELEASE telegram_core_error=${String(e?.message||e)}`)}
