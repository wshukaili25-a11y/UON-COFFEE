const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
try{
  const r=await fetch(`${SUPABASE_URL}/rest/v1/`,{headers:{apikey:SUPABASE_KEY},cache:'no-store'});
  const text=await r.text();
  console.log(`UON_RPC_PROBE_STATUS ${r.status}`);
  if(!r.ok){ console.log(`UON_RPC_PROBE_ERROR ${text.slice(0,300).replace(/\s+/g,' ')}`); process.exit(0); }
  const spec=JSON.parse(text);
  const paths=Object.keys(spec?.paths||{}).filter(p=>/\/(rpc\/)?[^/]*(sql|exec|query|migration|meta|admin)[^/]*$/i.test(p)).sort();
  for(const p of paths) console.log(`UON_RPC_PATH ${p}`);
  console.log(`UON_RPC_PROBE_COUNT ${paths.length}`);
}catch(error){
  console.log(`UON_RPC_PROBE_ERROR ${String(error?.message||error).slice(0,200)}`);
}
