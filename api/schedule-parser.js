const ENDPOINT='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-schedule-image-parser';
const PUBLIC_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  try{
    let body=req.body;
    if(typeof body==='string')body=JSON.parse(body||'{}');
    if(!body||typeof body!=='object')body={};
    body.public_key=PUBLIC_KEY;

    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),70000);
    try{
      const response=await fetch(ENDPOINT,{
        method:'POST',
        headers:{
          'content-type':'application/json',
          'apikey':PUBLIC_KEY,
          'origin':'https://uonhub.space'
        },
        body:JSON.stringify(body),
        signal:controller.signal
      });
      const text=await response.text();
      res.status(response.status);
      res.setHeader('Content-Type','application/json; charset=utf-8');
      return res.send(text||JSON.stringify({error:'empty_response'}));
    }finally{
      clearTimeout(timer);
    }
  }catch(error){
    console.error('schedule parser proxy failed',error);
    const timedOut=error?.name==='AbortError';
    return res.status(timedOut?504:502).json({error:timedOut?'proxy_timeout':'proxy_failed'});
  }
}
