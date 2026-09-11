const API='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/public-api-v67';
const KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const headers={apikey:KEY,'Content-Type':'application/json',Origin:'https://uonhub.space'};

async function call(body){
  const response=await fetch(API,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store'});
  const raw=await response.text();
  let data=null;
  try{data=raw?JSON.parse(raw):null}catch{}
  return {status:response.status,ok:response.ok,data,raw};
}

const contacts=await call({action:'contacts'});
const rows=Array.isArray(contacts.data?.rows)?contacts.data.rows:[];
console.log(`UON_POSTMERGE_CONTACTS status=${contacts.status} ok=${contacts.ok&&contacts.data?.ok===true} count=${rows.length} code=${contacts.data?.code||''}`);
if(!(contacts.ok&&contacts.data?.ok===true&&rows.length>0)){
  console.error(`UON_POSTMERGE_CONTACTS_FAIL ${contacts.raw.slice(0,500)}`);
  process.exitCode=1;
}

const validation=await call({action:'submit_exam_question',college:'Test College',subject:'TEST100',text:'Release validation only',session_id:'invalid-session',type:'essay'});
console.log(`UON_POSTMERGE_QUESTION_VALIDATION status=${validation.status} code=${validation.data?.code||''}`);
if(!(validation.status===400&&validation.data?.code==='invalid_session')){
  console.error(`UON_POSTMERGE_QUESTION_VALIDATION_FAIL ${validation.raw.slice(0,500)}`);
  process.exitCode=1;
}
