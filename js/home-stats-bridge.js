const nativeFetch=window.fetch.bind(window);
const supabaseHost='irkhvydgxpseflggbeqq.supabase.co';
const paths={
 '/rest/v1/summaries':'summaries',
 '/rest/v1/whatsapp_groups':'groups',
 '/rest/v1/rating_submissions':'ratings',
 '/rest/v1/student_projects':'projects'
};
let statsPromise=null;
function parsed(input){try{return new URL(typeof input==='string'?input:input.url,location.href)}catch{return null}}
function isStatsQuery(input){
 const u=parsed(input);if(!u||u.hostname!==supabaseHost)return null;
 const key=paths[u.pathname];if(!key)return null;
 const q=u.searchParams;
 if(q.get('select')!=='id')return null;
 if(key==='summaries'||key==='groups')return q.get('approved')==='eq.true'?key:null;
 return q.get('status')==='eq.approved'?key:null;
}
function isPopularQuery(input){
 const u=parsed(input);if(!u||u.hostname!==supabaseHost||u.pathname!=='/rest/v1/usage_events')return false;
 const q=u.searchParams;
 return q.get('select')==='event_type,metadata'&&Number(q.get('limit')||0)>=1000&&q.has('created_at');
}
function rpcHeaders(init){return new Headers(init?.headers||{})}
async function loadStats(init){
 if(!statsPromise){
  statsPromise=nativeFetch(`https://${supabaseHost}/rest/v1/rpc/uon_home_stats`,{method:'POST',headers:rpcHeaders(init),body:'{}',cache:'no-store'})
   .then(async response=>{if(!response.ok)throw new Error(`home stats HTTP ${response.status}`);return response.json()})
   .catch(error=>{statsPromise=null;throw error});
 }
 return statsPromise;
}
async function loadPopular(init){
 const response=await nativeFetch(`https://${supabaseHost}/rest/v1/rpc/uon_home_popular`,{
  method:'POST',headers:rpcHeaders(init),body:JSON.stringify({p_days:7,p_limit:6}),cache:'no-store'
 });
 if(!response.ok)throw new Error(`home popular HTTP ${response.status}`);
 const rows=await response.json();
 // Preserve the shape expected by home.js while transferring only six aggregated rows.
 const synthetic=[];
 for(const row of Array.isArray(rows)?rows:[]){
  const count=Math.max(0,Math.min(5000,Number(row?.uses)||0));
  for(let i=0;i<count;i++)synthetic.push({event_type:String(row?.label||'')});
 }
 return synthetic;
}
window.fetch=async function(input,init){
 const key=isStatsQuery(input);
 if(key){
  try{
   const stats=await loadStats(init);
   const count=Math.max(0,Number(stats?.[key]??0));
   return new Response(JSON.stringify(Array.from({length:count},(_,i)=>({id:i+1}))),{status:200,headers:{'Content-Type':'application/json'}});
  }catch{return nativeFetch(input,init)}
 }
 if(isPopularQuery(input)){
  try{
   const rows=await loadPopular(init);
   return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  }catch{return nativeFetch(input,init)}
 }
 return nativeFetch(input,init);
};
