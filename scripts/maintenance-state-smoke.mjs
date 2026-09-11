const URL='https://irkhvydgxpseflggbeqq.supabase.co/rest/v1/rpc/uon_public_state';
const KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const response=await fetch(URL,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{}
console.log(`UON_MAINTENANCE_STATE status=${response.status} enabled=${data?.maintenance_enabled===true}`);
if(!response.ok){console.error(`UON_MAINTENANCE_STATE_FAIL ${raw.slice(0,500)}`);process.exitCode=1}
