export const SAVED_SUMMARIES_KEY='uon_saved_summaries_v1';
export function readSavedSummaries(storage){
 try{
  const data=JSON.parse(storage.getItem(SAVED_SUMMARIES_KEY));
  if(data?.version!==1||!Array.isArray(data.ids))return new Set();
  return new Set(data.ids.filter(id=>typeof id==='string'&&id.length>0&&id.length<=200));
 }catch{return new Set()}
}
export function toggleSavedSummary(storage,id){
 const key=String(id||'');if(!key||key.length>200)throw new Error('invalid_summary_id');
 const ids=readSavedSummaries(storage);
 if(ids.has(key))ids.delete(key);else ids.add(key);
 storage.setItem(SAVED_SUMMARIES_KEY,JSON.stringify({version:1,ids:[...ids]}));
 return ids;
}
