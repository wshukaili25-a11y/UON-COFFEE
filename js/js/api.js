
import {SUPABASE_URL,SUPABASE_KEY} from './config.js';
const baseHeaders={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'};
export async function api(table,{method='GET',query='',body,prefer}={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const headers={...baseHeaders};if(prefer)headers.Prefer=prefer;
  const res=await fetch(`${SUPABASE_URL}/rest/v1/${table}${query?`?${query}`:''}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
  const text=await res.text();const data=text?JSON.parse(text):null;
  if(!res.ok)throw new Error(data?.message||data?.error||`HTTP ${res.status}`);return data;
 }finally{clearTimeout(timer)}
}
export const get=(table,query='')=>api(table,{query});
export const insert=(table,body)=>api(table,{method:'POST',body,prefer:'return=representation'});
export const update=(table,query,body)=>api(table,{method:'PATCH',query,body,prefer:'return=representation'});
export const remove=(table,query)=>api(table,{method:'DELETE',query});
export async function rpc(name,body){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:baseHeaders,body:JSON.stringify(body),signal:controller.signal});
  const text=await res.text();const data=text?JSON.parse(text):null;if(!res.ok)throw new Error(data?.message||`HTTP ${res.status}`);return data;
 }finally{clearTimeout(timer)}
}

export async function notifyPending(table,id){
 try{
  const res=await fetch(`${SUPABASE_URL}/functions/v1/telegram-admin`,{
   method:'POST',headers:{...baseHeaders},body:JSON.stringify({source:'web-submit',table,id})
  });
  if(!res.ok)console.warn('Telegram notification failed',await res.text());
 }catch(error){console.warn('Telegram notification unavailable',error)}
}
