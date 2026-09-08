const SB='https://irkhvydgxpseflggbeqq.supabase.co';
const KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const H={apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'};
async function call(name,url,init={}){
 try{
  const r=await fetch(url,{...init,headers:{...H,...(init.headers||{})},cache:'no-store'});
  const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}
  return{name,status:r.status,ok:r.ok,body:typeof body==='string'?body.slice(0,500):body};
 }catch(error){return{name,status:0,ok:false,body:String(error?.message||error)}}
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');
 if(req.method!=='GET')return res.status(405).json({ok:false});
 const fakeUuid='00000000-0000-4000-8000-000000000001';
 const checks=[];
 for(const table of ['whatsapp_groups','feature_suggestions','exam_questions']){
  checks.push(await call(`notify:${table}`,`${SB}/functions/v1/public-submit-notify`,{method:'POST',body:JSON.stringify({table,id:fakeUuid})}));
 }
 checks.push(await call('question_rpc',`${SB}/rest/v1/rpc/uon_submit_exam_question_v2`,{method:'POST',body:JSON.stringify({p_college:'__probe__',p_subject:'TEST999',p_text:'release probe only',p_session_id:fakeUuid,p_answer:null,p_type:'mcq',p_year:null})}));
 checks.push(await call('question_legacy_invalid_type',`${SB}/rest/v1/exam_questions`,{method:'POST',body:JSON.stringify({votes:'__uon_release_probe_invalid_integer__'})}));
 checks.push(await call('contact_rpc',`${SB}/rest/v1/rpc/uon_public_contact_numbers`,{method:'POST',body:'{}'}));
 return res.status(200).json({ok:true,checked_at:new Date().toISOString(),checks});
}
