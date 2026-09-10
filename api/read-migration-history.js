export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  try{
    const r=await fetch('https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-migration-history-read-v67',{cache:'no-store'});
    const text=await r.text();
    let body;
    try{body=JSON.parse(text)}catch{body={raw:text.slice(0,10000)}}
    return res.status(200).json({upstream_status:r.status,upstream_ok:r.ok,body});
  }catch(error){
    return res.status(200).json({upstream_status:0,upstream_ok:false,error:String(error?.message||error)});
  }
}
