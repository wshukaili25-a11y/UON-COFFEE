const KEY='uon_ai_client_v55';
const API_PATH='/functions/v1/uon-ai-chat';
function uuid(){try{return crypto.randomUUID()}catch{return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)})}}
function token(){let value='';try{value=localStorage.getItem(KEY)||''}catch{}if(!/^[0-9a-f-]{36}$/i.test(value)){value=uuid();try{localStorage.setItem(KEY,value)}catch{}}return value}
const CLIENT_TOKEN=token();
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init){try{const url=typeof input==='string'?input:input?.url||'';if(url.includes(API_PATH)&&init?.body&&typeof init.body==='string'){const body=JSON.parse(init.body);if(body&&typeof body==='object'&&!body.client_token){body.client_token=CLIENT_TOKEN;init={...init,body:JSON.stringify(body)}}}}catch{}return nativeFetch(input,init)};