import { programmeFields } from './programme.mjs';
import { normalize, searchTokens } from './conversation.mjs';
const ROOT='https://www.unizwa.edu.om/';
export function officialURL(value){try{const u=new URL(value,ROOT);return u.protocol==='https:'&&u.hostname==='www.unizwa.edu.om'&&!u.port&&!u.username&&!u.password&&/^\/(?:index|program_details|profile_details|search)\.php$/.test(u.pathname)?u.href:null;}catch{return null;}}
export function textFromHTML(html){return html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<\/t[dh]>/gi,' | ').replace(/<\/(?:tr|p|div)>|<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):' ';}).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();}
export function searchTerm(question){
 const q=normalize(question);
 for(const [pattern,term] of [[/رياضيات|mathematics/,'Mathematics'],[/تمريض|nursing/,'Nursing'],[/صيدل|pharmacy/,'Pharmacy'],[/محاسب|accounting/,'Accounting']])if(pattern.test(q))return term;
 const stop=new Set(['رسوم','تكلفة','تكلفه','تخصص','تخصصات','سعر','كم','ابحث','بحث','حاليا','الحالي','الان','جامعة','نزوى','fees','tuition','cost','search']);
 return String(question).replace(/[^\p{L}\s]/gu,' ').split(/\s+/).filter(x=>x.length>2&&!stop.has(normalize(x))).sort((a,b)=>b.length-a.length)[0]?.slice(0,60)||'';
}
function encodeSearch(term){const decoder=new TextDecoder('windows-1256'),map=new Map();for(let i=0;i<256;i++)map.set(decoder.decode(new Uint8Array([i])),i);return [...term].map(c=>{const n=map.get(c);return n===undefined?encodeURIComponent(c):'%'+n.toString(16).padStart(2,'0');}).join('');}
export function searchLinks(html,question){
 const terms=searchTokens(question),out=[];
 for(const block of html.split(/<li\b[^>]*class=['"]?searchli['"]?[^>]*>/i).slice(1)){
  const a=block.match(/<a\s+href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/i);if(!a)continue;
  const url=officialURL(a[1]||a[2]||a[3]),title=textFromHTML(a[4]);if(!url||!title)continue;
  const n=normalize(title),score=terms.filter(t=>n.includes(t)).length;
  if(score)out.push({url,title,score});
 }
 const best=Math.max(0,...out.map(x=>x.score));
 return [...new Map(out.filter(x=>x.score===best).map(x=>[x.url,x])).values()].slice(0,2);
}
// Only public official HTML is cached. Keep original fetch time and never use
// an expired entry after a fetch failure. Bound memory per edge isolate.
const pageCache=new Map();
const PAGE_TTL=5*60*1000;
const PAGE_CACHE_LIMIT=16;
async function cachedHTML(url,signal){
 if(signal?.aborted)throw Error('request_cancelled');
 const now=Date.now(),entry=pageCache.get(url);
 if(entry&&now-entry.at<PAGE_TTL)return {...entry,cached:true};
 pageCache.delete(url);
 const html=await fetchHTML(url,signal);
 const result={html,at:Date.now()};
 if(pageCache.size>=PAGE_CACHE_LIMIT)pageCache.delete(pageCache.keys().next().value);
 pageCache.set(url,result);
 return {...result,cached:false};
}
async function fetchHTML(url,signal){
 const r=await fetch(url,{signal,redirect:'error',headers:{'accept':'text/html'}});if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))throw Error('source_unavailable');
 const reader=r.body.getReader();const chunks=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>800000){await reader.cancel();throw Error('source_too_large');}chunks.push(value);}}finally{reader.releaseLock();}
 const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
 const charset=/charset=([\w-]+)/i.exec(r.headers.get('content-type')||'')?.[1]||'utf-8';return new TextDecoder(charset).decode(data);
}
export async function liveUniversitySearch(question,signal){
 const term=searchTerm(question);if(!term)return [];
 const timeout=AbortSignal.timeout(6500),combined=signal?AbortSignal.any([timeout,signal]):timeout;
 try{
  const {html}=await cachedHTML(ROOT+'search.php?kw='+encodeSearch(term),combined);
  const candidates=searchLinks(html,question);
  const results=await Promise.allSettled(candidates.map(async x=>{
   const fetched=await cachedHTML(x.url,combined);
   let page=fetched.html;
   page=page.split(/<!--\s*End of header\s*-->/i).at(-1).split(/<footer\b|<div[^>]*class=['"](?:footer|sitemap)/i)[0];
   const description=textFromHTML(page).slice(0,6000);if(description.length<50)return null;
   return {type:'بحث مباشر في موقع الجامعة',title:x.title,description,programme_fields:programmeFields(page,textFromHTML),url:x.url,official:true,live:true,cached:fetched.cached,checked_at:new Date(fetched.at).toISOString(),score:0};
  }));return results.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[]);
 }catch{return [];}
}
