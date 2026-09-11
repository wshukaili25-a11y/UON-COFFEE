const EDGE='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/public-api-v67';
const KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
async function call(body){
  const r=await fetch(EDGE,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  return{status:r.status,ok:r.ok,data};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const contacts=await call({action:'contacts'});
    const invalidQuestion=await call({action:'submit_exam_question',session_id:'not-a-uuid',college:'Engineering',subject:'TEST101',text:'Smoke test question',type:'mcq'});
    const safeContacts=contacts.ok&&contacts.data?.ok&&Array.isArray(contacts.data?.rows);
    const validationWorks=invalidQuestion.status===400&&invalidQuestion.data?.code==='invalid_session';
    return res.status(200).json({ok:safeContacts&&validationWorks,contacts:{status:contacts.status,ok:contacts.ok,rows:safeContacts?contacts.data.rows.length:null},question_validation:{status:invalidQuestion.status,code:invalidQuestion.data?.code||null,ok:validationWorks}});
  }catch(error){return res.status(200).json({ok:false,error:String(error?.message||error)})}
}
