// Server-only adapter. No conversation text, tokens or model answers are stored.
export function sharedPageCache(db, background) {
 const table='uon_ai_official_page_cache';
 return {
  async get(url,signal){
   const timeout=AbortSignal.timeout(700);
   const {data,error}=await db.from(table).select('html,fetched_at').eq('url',url).gt('expires_at',new Date().toISOString()).abortSignal(signal?AbortSignal.any([signal,timeout]):timeout).maybeSingle();
   if(error||!data)return null;
   return {html:data.html,at:Date.parse(data.fetched_at)};
  },
  async set(url,entry){
   await background((async()=>{
    const expires=new Date(entry.at+300000).toISOString();
    await db.from(table).upsert({url,html:entry.html,fetched_at:new Date(entry.at).toISOString(),expires_at:expires},{onConflict:'url'}).abortSignal(AbortSignal.timeout(1500));
    await db.from(table).delete().lt('expires_at',new Date().toISOString()).abortSignal(AbortSignal.timeout(1500));
   })());
  }
 };
}
