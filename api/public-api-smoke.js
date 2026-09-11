const EDGE='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/public-api-v67';
const SB='https://irkhvydgxpseflggbeqq.supabase.co';
const KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
async function call(body){
  const r=await fetch(EDGE,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  return{status:r.status,ok:r.ok,data};
}
async function direct(path){
  const r=await fetch(SB+path,{headers:{apikey:KEY},cache:'no-store'});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  return{status:r.status,ok:r.ok,data};
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  try{
    const contacts=await call({action:'contacts'});
    const invalidQuestion=await call({action:'submit_exam_question',session_id:'not-a-uuid',college:'Engineering',subject:'TEST101',text:'Smoke test question',type:'mcq'});
    const publicContactShape=await direct('/rest/v1/contact_numbers?select=label,phone,sort_order,is_visible&limit=1');
    const safeContacts=contacts.ok&&contacts.data?.ok&&Array.isArray(contacts.data?.rows);
    const validationWorks=invalidQuestion.status===400&&invalidQuestion.data?.code==='invalid_session';
    return res.status(200).json({ok:safeContacts&&validationWorks,contacts:{status:contacts.status,ok:contacts.ok,rows:safeContacts?contacts.data.rows.length:null,code:contacts.data?.code||null},question_validation:{status:invalidQuestion.status,code:invalidQuestion.data?.code||null,ok:validationWorks},public_contact_shape:{status:publicContactShape.status,ok:publicContactShape.ok,preview:publicContactShape.data}});
  }catch(error){return res.status(200).json({ok:false,error:String(error?.message||error)})}
}
