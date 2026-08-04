const LOG_KEY='uonhub_security_events_v1';
const MAX_LOG=100;
const BLOCKED_PROTOCOLS=new Set(['javascript:','data:','vbscript:','file:']);
const ALLOWED_FILE_TYPES=new Set(['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','image/jpeg','image/png','image/webp']);
const MAX_FILE_SIZE=25*1024*1024;
const SEVERITY={
 'blocked-link':'high','blocked-form':'high','blocked-file':'medium','scan-failed':'medium','security-guard-ready':'info'
};

function localLog(type,detail={}){
 try{const events=JSON.parse(localStorage.getItem(LOG_KEY)||'[]');events.unshift({type,detail,at:new Date().toISOString(),path:location.pathname});localStorage.setItem(LOG_KEY,JSON.stringify(events.slice(0,MAX_LOG)))}catch{}
}
async function remoteLog(type,detail={}){
 try{
  const {rpc}=await import('./core.js?v=48.0.0');
  await rpc('uon_record_security_event',{
   p_event_type:String(type).replace(/[^a-z0-9_.-]/gi,'-').toLowerCase().slice(0,80),
   p_severity:SEVERITY[type]||'low',
   p_source:'browser',
   p_page_path:location.pathname,
   p_details:{...detail,user_agent:navigator.userAgent.slice(0,220)}
  });
 }catch{}
}
function logEvent(type,detail={}){localLog(type,detail);void remoteLog(type,detail)}
function normalizeUrl(value){try{return new URL(value,location.href)}catch{return null}}
export function inspectUrl(value){
 const url=normalizeUrl(value);if(!url)return{safe:false,reason:'invalid-url'};
 if(BLOCKED_PROTOCOLS.has(url.protocol))return{safe:false,reason:'blocked-protocol'};
 if(!['http:','https:','mailto:','tel:'].includes(url.protocol))return{safe:false,reason:'unsupported-protocol'};
 if(url.username||url.password)return{safe:false,reason:'embedded-credentials'};
 return{safe:true,url};
}
function hardenLinks(root=document){root.querySelectorAll('a[href]').forEach(anchor=>{const result=inspectUrl(anchor.getAttribute('href'));if(!result.safe){anchor.removeAttribute('href');anchor.setAttribute('aria-disabled','true');anchor.classList.add('uon-unsafe-link');logEvent('blocked-link',{reason:result.reason,text:anchor.textContent?.trim().slice(0,120)||''});return}if(result.url.origin!==location.origin&&['http:','https:'].includes(result.url.protocol)){anchor.rel='noopener noreferrer external';if(anchor.target==='_blank')anchor.referrerPolicy='no-referrer'}})}
function protectDynamicContent(){const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)hardenLinks(node)})));observer.observe(document.documentElement,{childList:true,subtree:true});return observer}
function protectForms(){document.addEventListener('submit',event=>{const form=event.target;if(!(form instanceof HTMLFormElement))return;const action=inspectUrl(form.action||location.href);if(!action.safe||!['http:','https:'].includes(action.url.protocol)){event.preventDefault();logEvent('blocked-form',{reason:action.reason||'unsupported-action',form:form.id||form.name||'anonymous'})}},true)}
export async function hashFile(file){const buffer=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',buffer);return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}
export async function inspectFile(file){if(!(file instanceof File))return{safe:false,reason:'not-a-file'};if(file.size<=0||file.size>MAX_FILE_SIZE)return{safe:false,reason:'invalid-size'};if(!ALLOWED_FILE_TYPES.has(file.type))return{safe:false,reason:'unsupported-type'};const hash=await hashFile(file);return{safe:true,hash,size:file.size,type:file.type,name:file.name.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').slice(0,120)}}
function watchFileInputs(){document.addEventListener('change',async event=>{const input=event.target;if(!(input instanceof HTMLInputElement)||input.type!=='file'||!input.files?.length)return;for(const file of input.files){const result=await inspectFile(file).catch(()=>({safe:false,reason:'scan-failed'}));if(!result.safe){input.value='';logEvent('blocked-file',{name:file.name.slice(0,120),type:file.type||'unknown',size:file.size,reason:result.reason});input.dispatchEvent(new CustomEvent('uon:file-blocked',{bubbles:true,detail:result}));break}input.dispatchEvent(new CustomEvent('uon:file-scanned',{bubbles:true,detail:result}))}},true)}
export function bootSecurityGuard(){hardenLinks();protectDynamicContent();protectForms();watchFileInputs();window.UONSecurity={inspectUrl,inspectFile,hashFile,getEvents:()=>{try{return JSON.parse(localStorage.getItem(LOG_KEY)||'[]')}catch{return[]}},clearEvents:()=>localStorage.removeItem(LOG_KEY)};logEvent('security-guard-ready',{version:'48.0.0'})}
