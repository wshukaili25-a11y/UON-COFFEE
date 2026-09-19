const PROXY='/api/schedule-parser';
// This transport affects only image parsing; it never patches global fetch.
export async function fetchScheduleParser(payload,{signal,fetcher=fetch,timeoutMs=75000}={}){
 const controller=new AbortController();
 const abort=()=>controller.abort();
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,timeoutMs);
 try{
  const body=JSON.stringify(payload);
  if(body.length>27_000_000)throw new Error('images_too_large');
  const response=await fetcher(PROXY,{method:'POST',headers:{'content-type':'application/json'},body,signal:controller.signal,cache:'no-store',credentials:'same-origin'});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error||(response.status===413?'images_too_large':response.status===504?'proxy_timeout':`http_${response.status}`));
  if(!data||!Array.isArray(data.courses))throw new Error('invalid_parser_response');
  return data;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
