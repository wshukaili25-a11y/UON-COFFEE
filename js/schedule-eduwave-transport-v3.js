const ENDPOINT='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-schedule-image-parser';
const PUBLIC_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const originalFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:(input?.url||'');
  if(url!==ENDPOINT)return originalFetch(input,init);
  let payload={};
  try{payload=JSON.parse(String(init?.body||'{}'))}catch{}
  payload.public_key=PUBLIC_KEY;
  const next={...init,method:'POST',body:JSON.stringify(payload),headers:undefined,credentials:'omit',cache:'no-store'};
  return originalFetch(url,next);
};
