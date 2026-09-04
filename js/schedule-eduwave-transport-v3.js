const ENDPOINT='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-schedule-image-parser';
const originalFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:(input?.url||'');
  if(url!==ENDPOINT)return originalFetch(input,init);
  let payload={};
  try{payload=JSON.parse(String(init?.body||'{}'))}catch{}
  return originalFetch('/api/schedule-parser',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload),
    signal:init?.signal,
    cache:'no-store',
    credentials:'same-origin'
  });
};
