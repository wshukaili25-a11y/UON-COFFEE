const nativeFetch=window.fetch.bind(window);
const supabaseHost='irkhvydgxpseflggbeqq.supabase.co';
const paths={
 '/rest/v1/summaries':'summaries',
 '/rest/v1/whatsapp_groups':'groups',
 '/rest/v1/rating_submissions':'ratings',
 '/rest/v1/student_projects':'projects'
};
let statsPromise=null;
function isStatsQuery(url){
 try{
  const u=new URL(typeof url==='string'?url:url.url,location.href);
  if(u.hostname!==supabaseHost)return null;
  const key=paths[u.pathname];if(!key)return null;
  const q=u.searchParams;
  if(q.get('select')!=='id')return null;
  if(key==='summaries'||key==='groups')return q.get('approved')==='eq.true'?key:null;
  return q.get('status')==='eq.approved'?key:null;
 }catch{return null}
}
async function loadStats(init){
 if(!statsPromise){
  const headers=new Headers(init?.headers||{});
  statsPromise=nativeFetch(`https://${supabaseHost}/rest/v1/rpc/uon_home_stats`,{
   method:'POST',headers,body:'{}',cache:'no-store'
  }).then(async response=>{
   if(!response.ok)throw new Error(`home stats HTTP ${response.status}`);
   return response.json();
  }).catch(error=>{statsPromise=null;throw error});
 }
 return statsPromise;
}
window.fetch=async function(input,init){
 const key=isStatsQuery(input);
 if(!key)return nativeFetch(input,init);
 try{
  const stats=await loadStats(init);
  const count=Math.max(0,Number(stats?.[key]??0));
  const rows=Array.from({length:count},(_,i)=>({id:i+1}));
  return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
 }catch{return nativeFetch(input,init)}
};
