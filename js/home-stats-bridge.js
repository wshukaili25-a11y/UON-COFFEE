const nativeFetch=window.fetch.bind(window);
const supabaseHost='irkhvydgxpseflggbeqq.supabase.co';
const paths={
 '/rest/v1/summaries':'summaries',
 '/rest/v1/whatsapp_groups':'groups',
 '/rest/v1/rating_submissions':'ratings',
 '/rest/v1/student_projects':'projects'
};
let statsPromise=null;
let latestPromise=null;
function parsed(input){try{return new URL(typeof input==='string'?input:input.url,location.href)}catch{return null}}
function isStatsQuery(input){
 const u=parsed(input);if(!u||u.hostname!==supabaseHost)return null;
 const key=paths[u.pathname];if(!key)return null;
 const q=u.searchParams;
 if(q.get('select')!=='id')return null;
 if(key==='summaries'||key==='groups')return q.get('approved')==='eq.true'?key:null;
 return q.get('status')==='eq.approved'?key:null;
}
function latestQueryKey(input){
 const u=parsed(input);if(!u||u.hostname!==supabaseHost)return null;
 const q=u.searchParams;
 if(q.get('order')!=='created_at.desc'||Number(q.get('limit')||0)!==5)return null;
 if(u.pathname==='/rest/v1/summaries'&&q.get('approved')==='eq.true'&&q.get('select')==='id,title,course_code,subject,created_at')return 'summary';
 if(u.pathname==='/rest/v1/whatsapp_groups'&&q.get('approved')==='eq.true'&&q.get('select')==='id,subject,course_code,created_at')return 'group';
 if(u.pathname==='/rest/v1/student_projects'&&q.get('status')==='eq.approved'&&q.get('select')==='id,title,major,created_at')return 'project';
 return null;
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
async function loadLatest(init){
 if(!latestPromise){
  latestPromise=nativeFetch(`https://${supabaseHost}/rest/v1/rpc/uon_home_latest`,{
   method:'POST',headers:rpcHeaders(init),body:JSON.stringify({p_limit:15}),cache:'no-store'
  }).then(async response=>{
   if(!response.ok)throw new Error(`home latest HTTP ${response.status}`);
   return response.json();
  }).catch(error=>{latestPromise=null;throw error});
 }
 return latestPromise;
}
async function loadPopular(init){
 const response=await nativeFetch(`https://${supabaseHost}/rest/v1/rpc/uon_home_popular`,{
  method:'POST',headers:rpcHeaders(init),body:JSON.stringify({p_days:7,p_limit:6}),cache:'no-store'
 });
 if(!response.ok)throw new Error(`home popular HTTP ${response.status}`);
 const rows=await response.json();
 const synthetic=[];
 for(const row of Array.isArray(rows)?rows:[]){
  const count=Math.max(0,Math.min(5000,Number(row?.uses)||0));
  for(let i=0;i<count;i++)synthetic.push({event_type:String(row?.label||'')});
 }
 return synthetic;
}
function latestRowsFor(key,rows){
 const list=(Array.isArray(rows)?rows:[]).filter(row=>row?.item_type===key).slice(0,5);
 if(key==='summary')return list.map(row=>({id:row.item_id,title:row.title,course_code:row.course_code,subject:row.subject,created_at:row.created_at}));
 if(key==='group')return list.map(row=>({id:row.item_id,subject:row.subject,course_code:row.course_code,created_at:row.created_at}));
 return list.map(row=>({id:row.item_id,title:row.title,major:row.major,created_at:row.created_at}));
}
window.fetch=async function(input,init){
 const statsKey=isStatsQuery(input);
 if(statsKey){
  try{
   const stats=await loadStats(init);
   const count=Math.max(0,Number(stats?.[statsKey]??0));
   return new Response(JSON.stringify(Array.from({length:count},(_,i)=>({id:i+1}))),{status:200,headers:{'Content-Type':'application/json'}});
  }catch{return nativeFetch(input,init)}
 }
 const latestKey=latestQueryKey(input);
 if(latestKey){
  try{
   const rows=latestRowsFor(latestKey,await loadLatest(init));
   return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
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
