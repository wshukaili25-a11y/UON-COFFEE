const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false});
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/uon_public_state`,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
      body:'{}',
      cache:'no-store'
    });
    const text=await r.text();
    let data=null;try{data=JSON.parse(text)}catch{data=text}
    if(!r.ok)return res.status(200).json({ok:false,status:r.status,error:data});
    const value=data&&typeof data==='object'?data:{};
    return res.status(200).json({
      ok:true,
      status:r.status,
      keys:Object.keys(value).sort(),
      has_contacts:Array.isArray(value.contacts)||Array.isArray(value.contact_numbers)||Array.isArray(value.public_contacts),
      contact_keys:Object.keys(value).filter(k=>/contact|phone|support/i.test(k)).sort()
    });
  }catch(error){
    return res.status(200).json({ok:false,status:0,error:String(error?.message||error)});
  }
}
