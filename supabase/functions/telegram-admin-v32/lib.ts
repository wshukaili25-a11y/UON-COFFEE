// @ts-ignore Remote ESM import is resolved by Supabase Edge Runtime.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.8';
declare const Deno:any;

export const TOKEN=Deno.env.get('TELEGRAM_BOT_TOKEN')!;
export const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
export const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const SECRET=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')!;
export const OLD_FUNCTION=`${SUPABASE_URL}/functions/v1/telegram-admin`;
export const SELF_FUNCTION=`${SUPABASE_URL}/functions/v1/telegram-admin-v32`;
export const db=createClient(SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});

export type Admin={id:string;chat_id:string;name:string;role:string;permissions:any;active:boolean};
export type Conversation={chat_id:string;state:string;data:any};
export type Choice={mode:'create'|'edit';course_id?:string;page?:number;code?:string;name_ar?:string;name_en?:string|null;college_id?:string;college_ar?:string;college_en?:string;department_id?:string;department_ar?:string;department_en?:string;program_ids?:string[];requirement_type?:string};

export const requirements:Record<string,string>={university:'متطلب جامعة',college:'متطلب كلية',major:'متطلب تخصص',elective:'اختياري'};
export const json=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}});

export async function telegram(method:string,body:any){
 const r=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
 const text=await r.text();let p:any={};try{p=JSON.parse(text)}catch{p={description:text}}
 if(!r.ok||p.ok===false)throw new Error(p.description||text||`${method} failed`);return p.result;
}
export const send=(chatId:string,text:string,k?:any[][])=>telegram('sendMessage',{chat_id:chatId,text,reply_markup:k?{inline_keyboard:k}:undefined});
export async function edit(chatId:string,messageId:number,text:string,k:any[][]){try{return await telegram('editMessageText',{chat_id:chatId,message_id:messageId,text,reply_markup:{inline_keyboard:k}})}catch(e){if(/message is not modified/i.test(String((e as Error).message)))return null;throw e}}
export async function ack(id:string,text?:string,show_alert=false){try{await telegram('answerCallbackQuery',{callback_query_id:id,text,show_alert})}catch{}}

export async function forward(raw:string,req:Request){
 const r=await fetch(OLD_FUNCTION,{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':req.headers.get('x-telegram-bot-api-secret-token')||SECRET},body:raw,signal:AbortSignal.timeout(15000)});
 return new Response(await r.text(),{status:r.status,headers:{'content-type':r.headers.get('content-type')||'application/json'}});
}
export async function getAdmin(id:string):Promise<Admin|null>{const {data,error}=await db.from('telegram_admins').select('id,chat_id,name,role,permissions,active').eq('chat_id',id).eq('active',true).maybeSingle();if(error)throw error;return data as Admin|null}
export const canCourses=(a:Admin|null)=>!!a&&(a.role==='owner'||a.role==='admin'||a.permissions?.all===true||a.permissions?.courses===true);
export async function getConv(chatId:string):Promise<Conversation|null>{const {data,error}=await db.from('telegram_conversations').select('*').eq('chat_id',chatId).maybeSingle();if(error)throw error;return data as Conversation|null}
export async function setConv(chatId:string,state:string,data:Choice){const {error}=await db.from('telegram_conversations').upsert({chat_id:chatId,state,data,updated_at:new Date().toISOString()});if(error)throw error}
export async function clearConv(chatId:string){const {error}=await db.from('telegram_conversations').delete().eq('chat_id',chatId);if(error)throw error}
export function audit(a:Admin,action:string,id:string,details:any={}){db.from('bot_audit_log').insert({admin_chat_id:String(a.chat_id),admin_name:a.name||'',action,target_type:'courses',target_id:String(id||''),details,success:true}).then(()=>{})}