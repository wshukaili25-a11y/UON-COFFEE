import {rpc,get,esc,toast,trackEvent,applyFeatureStates} from './core.js?v=44.0.0';

const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const CACHE_KEY='uonhub_tool_catalog_v44';
const CACHE_TTL=10*60*1000;
const ACTIVE_STATUSES=new Set(['active','maintenance','coming_soon','disabled']);

let catalog={items:[],version:44,updated_at:null};
let categories=[];
let refreshTimer=null;
let realtimeChannel=null;
let booted=false;

const lang=()=>localStorage.getItem('uon_language')==='en'||document.documentElement.lang?.startsWith('en')?'en':'ar';
const t=(ar,en)=>lang()==='en'?en:ar;

function safeText(value,fallback=''){return String(value??fallback).trim()}
function safeUrl(value){
 try{
  const url=new URL(String(value||'#'),location.origin);
  return ['http:','https:'].includes(url.protocol)?url.href:'#';
 }catch{return '#'}
}
function isExternal(value){
 try{return new URL(value,location.origin).origin!==location.origin}catch{return false}
}
function toolName(item){return lang()==='en'?safeText(item.name_en,item.name_ar):safeText(item.name_ar,item.name_en)}
function toolDescription(item){return lang()==='en'?safeText(item.description_en,item.description_ar):safeText(item.description_ar,item.description_en)}
function statusLabel(status){
 const map={
  active:[t('متاحة','Available'),''],
  maintenance:[t('تحت الصيانة','Maintenance'),'🛠️'],
  coming_soon:[t('قريبًا','Coming soon'),'⏳'],
  disabled:[t('متوقفة','Unavailable'),'⛔']
 };
 return map[status]||map.active;
}
function healthLabel(status){
 const map={healthy:[t('تعمل','Healthy'),'🟢'],degraded:[t('استجابة بطيئة','Degraded'),'🟡'],down:[t('تحتاج فحص','Down'),'🔴'],unknown:['','']};
 return map[status]||map.unknown;
}
function normalizeItem(item){
 const status=ACTIVE_STATUSES.has(item?.status)?item.status:'active';
 return {
  key:safeText(item?.key),category_id:safeText(item?.category_id),name_ar:safeText(item?.name_ar),name_en:safeText(item?.name_en),
  description_ar:safeText(item?.description_ar),description_en:safeText(item?.description_en),url:safeText(item?.url,'#'),
  icon:safeText(item?.icon,'🧰'),color:safeText(item?.color),status,is_visible:item?.is_visible!==false,is_platform:item?.is_platform===true,
  placement:['home_primary','home_secondary','tools_only','hidden'].includes(item?.placement)?item.placement:'tools_only',
  sort_order:Number(item?.sort_order)||100,maintenance_message:safeText(item?.maintenance_message),short_slug:safeText(item?.short_slug),
  health_status:safeText(item?.health_status,'unknown'),health_checked_at:item?.health_checked_at||null,version_no:Number(item?.version_no)||1,
  preview:item?.preview===true
 };
}
function validItems(items){return Array.isArray(items)?items.map(normalizeItem).filter(item=>item.key&&item.is_visible&&item.placement!=='hidden'):[]}

function readCache(){
 try{
  const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
  if(!cached||!Array.isArray(cached.items))return null;
  return cached;
 }catch{return null}
}
function writeCache(value){
 try{localStorage.setItem(CACHE_KEY,JSON.stringify({...value,cached_at:Date.now()}))}catch{}
}

async function loadPreview(){
 const token=new URLSearchParams(location.search).get('preview');
 if(!token||!/^[0-9a-f-]{36}$/i.test(token))return null;
 try{
  const snapshot=await rpc('uon_public_tool_preview',{p_token:token});
  if(!snapshot?.key)return null;
  return normalizeItem({...snapshot,preview:true,is_visible:true,placement:snapshot.placement==='hidden'?'tools_only':snapshot.placement});
 }catch(error){console.warn('Tool preview unavailable',error);return null}
}

export async function loadToolCatalog({force=false}={}){
 const cached=readCache();
 if(!force&&cached&&Date.now()-Number(cached.cached_at||0)<CACHE_TTL){
  catalog={...cached,items:validItems(cached.items)};
 }
 try{
  const [fresh,preview,cats]=await Promise.all([
   rpc('uon_public_tool_catalog',{p_college:localStorage.getItem('uon_college')||null}),
   loadPreview(),
   categories.length?Promise.resolve(categories):get('tools_categories','select=id,name,emoji,color,sort_order&order=sort_order.asc').catch(()=>[])
  ]);
  categories=Array.isArray(cats)?cats:[];
  const items=validItems(fresh?.items);
  if(preview){
   const index=items.findIndex(item=>item.key===preview.key);
   if(index>=0)items[index]=preview;else items.unshift(preview);
  }
  catalog={version:Number(fresh?.version)||44,updated_at:fresh?.updated_at||new Date().toISOString(),items};
  writeCache(catalog);
  return catalog;
 }catch(error){
  console.warn('Tool catalog load failed',error);
  if(catalog.items.length)return catalog;
  if(cached){catalog={...cached,items:validItems(cached.items)};return catalog}
  throw error;
 }
}

function primaryCard(item){
 const [statusText,statusIcon]=statusLabel(item.status);
 const unavailable=item.status!=='active';
 const preview=item.preview?`<span class="uon44-preview-chip">${t('معاينة','Preview')}</span>`:'';
 return `<a class="h37-service uon44-primary-card${unavailable?' feature-unavailable':''}" href="${esc(safeUrl(item.url))}" data-feature="${esc(item.key)}" data-status="${esc(item.status)}" data-tool-key="${esc(item.key)}"${isExternal(item.url)?' target="_blank" rel="noopener"':''}>
  <span class="h37-service-icon">${esc(item.icon)}</span>
  <strong>${esc(toolName(item))}</strong>
  <small>${esc(toolDescription(item))}</small>
  ${preview}${unavailable?`<span class="uon44-state-chip ${esc(item.status)}">${statusIcon} ${esc(statusText)}</span>`:''}
 </a>`;
}
function secondaryCard(item){
 const [statusText,statusIcon]=statusLabel(item.status);
 const unavailable=item.status!=='active';
 return `<a class="uon44-secondary-card${unavailable?' feature-unavailable':''}" href="${esc(safeUrl(item.url))}" data-feature="${esc(item.key)}" data-status="${esc(item.status)}" data-tool-key="${esc(item.key)}"${isExternal(item.url)?' target="_blank" rel="noopener"':''}>
  <span>${esc(item.icon)}</span><strong>${esc(toolName(item))}</strong>
  ${unavailable?`<small>${statusIcon} ${esc(statusText)}</small>`:''}
 </a>`;
}
function toolCard(item){
 const [statusText,statusIcon]=statusLabel(item.status);
 const [healthText,healthIcon]=healthLabel(item.health_status);
 const external=isExternal(item.url);
 const href=item.status==='active'?safeUrl(item.url):'#';
 return `<article class="card feature-card uon44-tool-card${item.status!=='active'?' feature-unavailable':''}" data-feature="${esc(item.key)}" data-status="${esc(item.status)}" data-category="${esc(item.category_id)}" data-tool-key="${esc(item.key)}">
  <div class="uon44-tool-card-head"><span class="tool-icon">${esc(item.icon)}</span><div class="uon44-card-badges">${item.preview?`<span class="uon44-preview-chip">${t('معاينة','Preview')}</span>`:''}${healthText?`<span class="uon44-health ${esc(item.health_status)}" title="${esc(healthText)}">${healthIcon}</span>`:''}</div></div>
  <h3>${esc(toolName(item))}</h3><p>${esc(toolDescription(item))}</p>
  <div class="uon44-card-actions">
   ${item.status==='active'?`<a class="btn primary" href="${esc(href)}"${external?' target="_blank" rel="noopener"':''}>${t('فتح','Open')}</a>`:`<button class="btn" type="button" data-unavailable="${esc(item.status)}">${statusIcon} ${esc(statusText)}</button>`}
   <button class="uon44-report-btn" type="button" data-report-tool="${esc(item.key)}" aria-label="${t('إبلاغ عن مشكلة','Report a problem')}">⚑</button>
  </div>
 </article>`;
}

function installPreviewBanner(){
 const preview=catalog.items.find(item=>item.preview);
 document.querySelector('#uon44PreviewBanner')?.remove();
 if(!preview)return;
 const banner=document.createElement('div');
 banner.id='uon44PreviewBanner';banner.className='uon44-preview-banner';
 banner.innerHTML=`<span>👁️ ${t('أنت تشاهد معاينة غير منشورة لأداة','You are viewing an unpublished preview of')} <b>${esc(toolName(preview))}</b></span><a href="${esc(location.pathname)}">${t('إنهاء المعاينة','Exit preview')}</a>`;
 document.body.prepend(banner);
}

async function bindFeatureStates(root){
 await applyFeatureStates(root);
 root.querySelectorAll('[data-tool-key]').forEach(card=>{
  const item=catalog.items.find(row=>row.key===card.dataset.toolKey);
  if(!item||item.status==='active')return;
  card.addEventListener('click',event=>{
   if(event.target.closest('[data-report-tool]'))return;
   event.preventDefault();
   const message=item.maintenance_message||statusLabel(item.status)[0];
   toast(`${toolName(item)}: ${message}`,true);
  },true);
 });
 root.querySelectorAll('[data-report-tool]').forEach(button=>button.addEventListener('click',event=>{
  event.preventDefault();event.stopPropagation();
  document.dispatchEvent(new CustomEvent('uon:report-tool',{detail:{key:button.dataset.reportTool}}));
 }));
 root.querySelectorAll('a[data-tool-key]').forEach(link=>link.addEventListener('click',()=>trackEvent('feature_open',{feature:link.dataset.toolKey,source:location.pathname,catalog_version:catalog.version})));
}

export async function renderHomeTools(){
 const modern=document.querySelector('.h37-services');
 const legacy=document.querySelector('.v18-primary-tools');
 const primaryRoot=modern||legacy;
 if(!primaryRoot)return false;
 const primary=catalog.items.filter(item=>item.placement==='home_primary').sort((a,b)=>a.sort_order-b.sort_order);
 const secondary=catalog.items.filter(item=>item.placement==='home_secondary').sort((a,b)=>a.sort_order-b.sort_order);
 primaryRoot.innerHTML=primary.length?primary.map(primaryCard).join(''):`<div class="empty">${t('لا توجد خدمات ظاهرة حاليًا','No visible services right now')}</div>`;
 let secondaryRoot=document.querySelector('#uon44SecondaryTools');
 if(!secondaryRoot){
  const section=document.createElement('section');section.className='uon44-secondary-section';
  section.innerHTML=`<div class="h37-container"><div class="h37-head"><div><h2>${t('خدمات أخرى','More services')}</h2><p>${t('أدوات سريعة يحتاجها الطالب.','Quick tools for students.')}</p></div></div><div id="uon44SecondaryTools" class="uon44-secondary-grid"></div></div>`;
  const homeSection=primaryRoot.closest('section');homeSection?.insertAdjacentElement('afterend',section);
  secondaryRoot=section.querySelector('#uon44SecondaryTools');
 }
 if(secondaryRoot)secondaryRoot.innerHTML=secondary.map(secondaryCard).join('');
 document.querySelectorAll('.v18-secondary-tools').forEach(root=>root.closest('section')?.remove());
 await bindFeatureStates(primaryRoot);
 if(secondaryRoot)await bindFeatureStates(secondaryRoot);
 installPreviewBanner();
 return true;
}

function categoryName(id){const row=categories.find(category=>category.id===id);return row?.name||id||t('عام','General')}
export async function renderToolsPage(){
 const target=document.querySelector('#items');
 if(!target)return false;
 const search=document.querySelector('#search');
 const category=document.querySelector('#category');
 if(category){
  const used=[...new Set(catalog.items.filter(item=>item.placement==='tools_only'||item.is_platform).map(item=>item.category_id).filter(Boolean))];
  category.innerHTML=`<option value="">${t('كل التصنيفات','All categories')}</option>`+used.map(id=>`<option value="${esc(id)}">${esc(categoryName(id))}</option>`).join('');
 }
 const render=async()=>{
  const query=safeText(search?.value).toLocaleLowerCase(lang()==='en'?'en':'ar');
  const categoryId=safeText(category?.value);
  const rows=catalog.items.filter(item=>{
   if(categoryId&&item.category_id!==categoryId)return false;
   const haystack=`${toolName(item)} ${toolDescription(item)} ${item.key}`.toLocaleLowerCase(lang()==='en'?'en':'ar');
   return !query||haystack.includes(query);
  }).sort((a,b)=>Number(b.is_platform)-Number(a.is_platform)||a.sort_order-b.sort_order||toolName(a).localeCompare(toolName(b)));
  target.innerHTML=rows.length?rows.map(toolCard).join(''):`<div class="empty uon44-tools-empty">${t('لا توجد أدوات مطابقة','No matching tools')}</div>`;
  await bindFeatureStates(target);
 };
 search?.addEventListener('input',render);
 category?.addEventListener('change',render);
 await render();
 installPreviewBanner();
 return true;
}

async function refreshViews(){
 try{
  await loadToolCatalog({force:true});
  await renderHomeTools();
  await renderToolsPage();
  document.dispatchEvent(new CustomEvent('uon:tool-catalog-updated',{detail:{version:catalog.version,updated_at:catalog.updated_at}}));
 }catch(error){console.warn('Tool catalog refresh failed',error)}
}

async function installRealtime(){
 if(realtimeChannel)return;
 try{
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const client=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  realtimeChannel=client.channel('uon-tools-v44').on('postgres_changes',{event:'*',schema:'public',table:'tool_registry'},()=>{
   clearTimeout(refreshTimer);refreshTimer=setTimeout(refreshViews,350);
  }).subscribe();
 }catch(error){console.warn('Realtime tools unavailable; focus refresh remains active',error)}
}

export async function bootUnifiedTools(){
 if(booted)return catalog;
 booted=true;
 injectStyles();
 try{
  await loadToolCatalog();
  await renderHomeTools();
  await renderToolsPage();
  installRealtime();
  window.addEventListener('focus',()=>{
   const cached=readCache();
   if(!cached||Date.now()-Number(cached.cached_at||0)>60000)refreshViews();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshViews()});
 }catch(error){
  console.error(error);toast(t('تعذر تحميل الأدوات حاليًا','Could not load tools right now'),true);
 }
 return catalog;
}

function injectStyles(){
 if(document.querySelector('#uon44ToolRegistryStyle'))return;
 const link=document.createElement('link');link.id='uon44ToolRegistryStyle';link.rel='stylesheet';link.href='/css/tool-registry-v44.css?v=44.0.0';document.head.append(link);
}

export function getToolCatalog(){return catalog}
