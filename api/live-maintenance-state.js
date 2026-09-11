const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/uon_public_state`,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
      body:'{}',
      cache:'no-store'
    });
    const text=await r.text();
    let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
    return res.status(200).json({ok:r.ok,status:r.status,maintenance_enabled:data?.maintenance_enabled===true,state:data});
  }catch(error){
    return res.status(200).json({ok:false,status:0,error:String(error?.message||error)});
  }
}
