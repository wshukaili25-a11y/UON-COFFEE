const ENDPOINT='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-schedule-image-parser';
const PROXY='/api/schedule-parser';
const originalFetch=window.fetch.bind(window);

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:(input?.url||'');
  if(url!==ENDPOINT)return originalFetch(input,init);
  let payload={};
  try{payload=JSON.parse(String(init?.body||'{}'))}catch{}
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),75000);
  try{
    return await originalFetch(PROXY,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload),
      signal:controller.signal,
      cache:'no-store',
      credentials:'same-origin'
    });
  }finally{
    clearTimeout(timer);
  }
};
