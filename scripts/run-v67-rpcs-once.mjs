const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const PUBLIC_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const RUNNER=`${SUPABASE_URL}/functions/v1/uon-release-db-v67`;
const headers={apikey:PUBLIC_KEY,'Content-Type':'application/json'};

const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

let runnerResult=null;
for(let attempt=1;attempt<=8;attempt++){
  try{
    const r=await fetch(RUNNER,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
    const text=await r.text();
    let body;try{body=JSON.parse(text)}catch{body={raw:text.slice(0,1000)}}
    console.log(`UON_V67_RUNNER attempt=${attempt} status=${r.status} body=${JSON.stringify(body)}`);
    if(r.ok&&body?.ok===true){runnerResult=body;break;}
  }catch(error){
    console.log(`UON_V67_RUNNER attempt=${attempt} error=${String(error?.message||error)}`);
  }
  await sleep(3000);
}
if(!runnerResult)throw new Error('v67 runner did not complete successfully');

const contact=await fetch(`${SUPABASE_URL}/rest/v1/rpc/uon_public_contact_numbers`,{
  method:'POST',headers,body:'{}',cache:'no-store'
});
const contactText=await contact.text();
console.log(`UON_V67_CONTACT status=${contact.status} body=${contactText.slice(0,1000).replace(/\s+/g,' ')}`);
if(!contact.ok)throw new Error(`contact RPC verification failed: ${contact.status}`);

const question=await fetch(`${SUPABASE_URL}/rest/v1/rpc/uon_submit_exam_question_v2`,{
  method:'POST',headers,cache:'no-store',
  body:JSON.stringify({p_college:'',p_subject:'',p_text:'',p_session_id:null,p_answer:null,p_type:'mcq',p_year:null})
});
const questionText=await question.text();
console.log(`UON_V67_QUESTION status=${question.status} body=${questionText.slice(0,1000).replace(/\s+/g,' ')}`);
if(questionText.includes('PGRST202')||question.status===404)throw new Error('question RPC is still missing');
if(!/invalid_session|invalid_college|P0001/i.test(questionText)){
  throw new Error(`question RPC did not return expected validation response: ${question.status}`);
}

console.log(`UON_V67_RELEASE_OK state=${runnerResult.state||'unknown'} contact_rpc=${runnerResult.contact_rpc} question_rpc=${runnerResult.question_rpc} question_guard=${runnerResult.question_guard}`);
