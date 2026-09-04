import {rpc} from './core.js?v=66.0.0';

const SCHEDULE_KEY='uon-v7-schedule';
const SESSION_KEY='uon_ai_session_v46';
const CLIENT_KEY='uon_ai_client_v55';
let timer=null,lastPayload='';

function uuid(){try{return crypto.randomUUID()}catch{return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)})}}
function sessionId(){let id='';try{id=sessionStorage.getItem(SESSION_KEY)||''}catch{}if(!/^[0-9a-f-]{36}$/i.test(id)){id=uuid();try{sessionStorage.setItem(SESSION_KEY,id)}catch{}}return id}
function clientToken(){let id='';try{id=localStorage.getItem(CLIENT_KEY)||''}catch{}if(!/^[0-9a-f-]{36}$/i.test(id)){id=uuid();try{localStorage.setItem(CLIENT_KEY,id)}catch{}}return id}
function rows(){try{const value=JSON.parse(localStorage.getItem(SCHEDULE_KEY)||'[]');return Array.isArray(value)?value.slice(0,80):[]}catch{return[]}}
function safeRows(){return rows().map(x=>({course:String(x.course||'').slice(0,40),day:String(x.day||''),start:String(x.start||''),end:String(x.end||''),room:String(x.room||'').slice(0,50),teacher:String(x.teacher||'').slice(0,100),type:String(x.type||'lecture').slice(0,20)})).filter(x=>x.course&&x.day&&x.start&&x.end)}
async function sync(){const schedule=safeRows(),payload=JSON.stringify(schedule);if(payload===lastPayload)return;try{await rpc('uon_ai_sync_schedule',{p_session_id:sessionId(),p_client_token:clientToken(),p_schedule:schedule});lastPayload=payload;document.dispatchEvent(new CustomEvent('uon:schedule-ai-synced',{detail:{classes:schedule.length}}))}catch(error){console.warn('UON AI schedule sync skipped',error)}}
function queue(){clearTimeout(timer);timer=setTimeout(sync,500)}
const week=document.querySelector('#week');if(week)new MutationObserver(queue).observe(week,{childList:true,subtree:true,characterData:true});
window.addEventListener('storage',event=>{if(event.key===SCHEDULE_KEY)queue()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')queue()});
setTimeout(sync,800);
