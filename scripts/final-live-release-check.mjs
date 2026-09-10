const url='https://irkhvydgxpseflggbeqq.supabase.co';
const key='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const headers={apikey:key,'Content-Type':'application/json'};

async function jsonPost(path,body={}){
  const r=await fetch(url+path,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store'});
  const text=await r.text();
  let data=null; try{data=text?JSON.parse(text):null}catch{data=text}
  return {status:r.status,ok:r.ok,data};
}

try{
  const state=await jsonPost('/rest/v1/rpc/uon_public_state',{});
  console.log(`UON_RELEASE state_status=${state.status} maintenance_enabled=${state.data?.maintenance_enabled===true}`);
}catch(e){console.log(`UON_RELEASE state_error=${String(e?.message||e)}`)}

try{
  const r=await fetch(url+'/rest/v1/',{headers:{apikey:key},cache:'no-store'});
  const text=await r.text();
  console.log(`UON_RELEASE openapi_status=${r.status}`);
  console.log(`UON_RELEASE contact_rpc=${text.includes('/rpc/uon_public_contact_numbers')?'present':'missing'}`);
  console.log(`UON_RELEASE question_rpc=${text.includes('/rpc/uon_submit_exam_question_v2')?'present':'missing'}`);
}catch(e){console.log(`UON_RELEASE openapi_error=${String(e?.message||e)}`)}

try{
  const r=await fetch(url+'/functions/v1/telegram-admin-core',{method:'GET',headers:{apikey:key},cache:'no-store'});
  console.log(`UON_RELEASE telegram_core_status=${r.status}`);
}catch(e){console.log(`UON_RELEASE telegram_core_error=${String(e?.message||e)}`)}
