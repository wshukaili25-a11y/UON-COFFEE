import{toast}from'./core.js?v=43.1.0';
const KEY='uon_ai_schedule_applied_v1';
if(sessionStorage.getItem(KEY)==='1'){
 sessionStorage.removeItem(KEY);
 queueMicrotask(()=>toast(document.documentElement.lang?.startsWith('en')?'UON AI schedule applied successfully':'تمت إضافة جدول UON AI بنجاح'));
}