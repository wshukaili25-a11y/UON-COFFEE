(()=>{
 const nativeFetch=window.fetch.bind(window);
 const TTL=2500;
 let cached=null,cachedAt=0,inflight=null;
 const isPublicState=input=>{
  const url=typeof input==='string'?input:input?.url||'';
  return url.includes('/rest/v1/rpc/uon_public_state');
 };
 window.fetch=(input,init)=>{
  if(!isPublicState(input))return nativeFetch(input,init);
  const now=Date.now();
  if(cached&&now-cachedAt<TTL)return Promise.resolve(cached.clone());
  if(inflight)return inflight.then(r=>r.clone());
  inflight=nativeFetch(input,init).then(r=>{
   if(r.ok){cached=r.clone();cachedAt=Date.now()}
   return r;
  }).finally(()=>{inflight=null});
  return inflight.then(r=>r.clone());
 };
})();