import{rpc}from'./core.js?v=44.0.0';

const LEGACY_KEY='uon-v7-schedule';
const PROFILES_KEY='uon-v44-schedule-profiles';
const ACTIVE_KEY='uon-v44-active-schedule';
const SHARED_BACKUP_KEY='uon-v44-shared-backup';
const uid=()=>crypto.randomUUID();

function rowsFromLegacy(){try{const rows=JSON.parse(localStorage.getItem(LEGACY_KEY)||'[]');return Array.isArray(rows)?rows:[]}catch{return[]}}
function readStore(){
 try{
  const store=JSON.parse(localStorage.getItem(PROFILES_KEY)||'null');
  if(store&&Array.isArray(store.profiles)&&store.profiles.length)return store;
 }catch{}
 const now=new Date().toISOString();
 const profile={id:uid(),name:'جدول الفصل الحالي',rows:rowsFromLegacy(),createdAt:now,updatedAt:now};
 const store={version:1,profiles:[profile],settings:{reminderMinutes:0}};
 localStorage.setItem(PROFILES_KEY,JSON.stringify(store));localStorage.setItem(ACTIVE_KEY,profile.id);return store;
}
function saveStore(store){localStorage.setItem(PROFILES_KEY,JSON.stringify(store))}
function activeId(store=readStore()){const requested=localStorage.getItem(ACTIVE_KEY);return store.profiles.some(profile=>profile.id===requested)?requested:store.profiles[0]?.id}
function activeProfile(store=readStore()){return store.profiles.find(profile=>profile.id===activeId(store))||store.profiles[0]}
function syncActiveToLegacy(){const store=readStore();const profile=activeProfile(store);if(profile){localStorage.setItem(ACTIVE_KEY,profile.id);localStorage.setItem(LEGACY_KEY,JSON.stringify(profile.rows||[]))}return profile}
function syncLegacyToActive(){const store=readStore();const id=activeId(store);const profile=store.profiles.find(item=>item.id===id);if(!profile)return;profile.rows=rowsFromLegacy();profile.updatedAt=new Date().toISOString();saveStore(store)}
function uniqueName(store,name){const base=String(name||'جدول جديد').trim()||'جدول جديد';let output=base,index=2;while(store.profiles.some(profile=>profile.name===output))output=`${base} ${index++}`;return output}

const api={
 keys:{LEGACY_KEY,PROFILES_KEY,ACTIVE_KEY},
 read:readStore,
 save:saveStore,
 active(){return activeProfile(readStore())},
 sync:syncLegacyToActive,
 create(name,rows=[]){const store=readStore();const now=new Date().toISOString();const profile={id:uid(),name:uniqueName(store,name),rows:Array.isArray(rows)?rows:[],createdAt:now,updatedAt:now};store.profiles.push(profile);saveStore(store);return profile},
 rename(id,name){const store=readStore();const profile=store.profiles.find(item=>item.id===id);if(!profile)return null;profile.name=uniqueName({...store,profiles:store.profiles.filter(item=>item.id!==id)},name);profile.updatedAt=new Date().toISOString();saveStore(store);return profile},
 duplicate(id){const store=readStore();const source=store.profiles.find(item=>item.id===id);if(!source)return null;return this.create(`نسخة من ${source.name}`,structuredClone(source.rows||[]))},
 remove(id){const store=readStore();if(store.profiles.length<=1)return false;store.profiles=store.profiles.filter(item=>item.id!==id);saveStore(store);if(activeId(store)===id)localStorage.setItem(ACTIVE_KEY,store.profiles[0].id);return true},
 switch(id){syncLegacyToActive();const store=readStore();const target=store.profiles.find(item=>item.id===id);if(!target)return false;localStorage.setItem(ACTIVE_KEY,id);localStorage.setItem(LEGACY_KEY,JSON.stringify(target.rows||[]));location.reload();return true},
 setReminder(minutes){const store=readStore();store.settings={...(store.settings||{}),reminderMinutes:Number(minutes)||0};saveStore(store)},
 reminder(){return Number(readStore().settings?.reminderMinutes)||0}
};
window.UONScheduleProfiles=api;

const shareId=new URLSearchParams(location.search).get('share');
if(shareId&&/^[0-9a-f-]{36}$/i.test(shareId)){
 try{
  const shared=await rpc('uon_get_schedule_share',{p_id:shareId});
  if(shared?.payload?.rows&&Array.isArray(shared.payload.rows)){
   if(!sessionStorage.getItem(SHARED_BACKUP_KEY))sessionStorage.setItem(SHARED_BACKUP_KEY,localStorage.getItem(LEGACY_KEY)||'[]');
   localStorage.setItem(LEGACY_KEY,JSON.stringify(shared.payload.rows));
   sessionStorage.setItem('uon-v44-shared-schedule',JSON.stringify({id:shareId,title:shared.title||'جدول مشترك',rows:shared.payload.rows,expires_at:shared.expires_at}));
  }else syncActiveToLegacy();
 }catch(error){console.warn('Shared schedule unavailable',error);syncActiveToLegacy()}
}else{
 sessionStorage.removeItem('uon-v44-shared-schedule');
 syncActiveToLegacy();
}

window.addEventListener('pagehide',()=>{
 const backup=sessionStorage.getItem(SHARED_BACKUP_KEY);
 if(backup!==null){localStorage.setItem(LEGACY_KEY,backup);sessionStorage.removeItem(SHARED_BACKUP_KEY);sessionStorage.removeItem('uon-v44-shared-schedule')}
});
