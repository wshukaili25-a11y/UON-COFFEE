import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';
import { $, setupNav, toast, enforceUonMaintenance, watchUonMaintenance } from './core.js?v=64.1.0';

const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const API=`${SUPABASE_URL}/functions/v1/uon-google-account-v64`;
const CALENDAR_SCOPE='https://www.googleapis.com/auth/calendar.events.readonly';
const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});
let currentSession=null;
let currentConnection=null;
let capturing=false;
const fmt=new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function safeDate(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):fmt.format(d)}
function setBusy(active){document.body.classList.toggle('google-loading',active)}
function empty(el,text){if(!el)return;el.replaceChildren();const d=document.createElement('div');d.className='google-empty';d.textContent=text;el.appendChild(d)}
function friendlyError(e){const m=String(e?.message||e||'');if(/provider is not enabled|unsupported provider/i.test(m))return'ربط Google جاهز في UON Hub لكن Google OAuth غير مفعّل في إعدادات Supabase Auth للحين.';if(/redirect|callback/i.test(m))return'إعداد رابط الرجوع من Google يحتاج مراجعة في Google Cloud وSupabase Auth.';return m||'تعذر تنفيذ العملية'}
async function session(){const{data,error}=await supabase.auth.getSession();if(error)throw error;currentSession=data.session||null;return currentSession}
async function api(action,body={}){const s=await session();if(!s?.access_token)throw new Error('اربط Google أولًا');const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${s.access_token}`},body:JSON.stringify({action,...body}),cache:'no-store'});const data=await r.json().catch(()=>({}));if(!r.ok||data?.error)throw new Error(data?.error||`HTTP ${r.status}`);return data}
function renderStatus(connection){currentConnection=connection||null;const active=connection?.status==='active';const pill=$('#googleStatusPill'),account=$('#googleAccount'),text=$('#googleStatusText');if(pill){pill.className=`google-status-pill${active?' active':connection?.status==='error'?' error':''}`;pill.textContent=active?'مربوط':connection?.status==='revoked'?'مفصول':'غير مربوط'}if(account)account.textContent=active?(connection.google_email||'حساب Google مربوط'):'ما فيه حساب Google نشط حاليًا';if(text)text.textContent=active?'الربط خاص بحسابك. تقدر تعرض المواعيد وملفات Drive المسموح بها من الأزرار تحت.':'الربط اختياري. UON Hub يظل يشتغل طبيعي إذا ما ربطت حسابك.';$('#googleConnectBtn').hidden=active;$('#googleRefreshBtn').hidden=!active;$('#googleDisconnectBtn').hidden=!active;const calendar=active&&connection.calendar_read_enabled===true,drive=active&&connection.drive_file_enabled===true;$('#googleCalendarLoad').disabled=!calendar;$('#googleDriveLoad').disabled=!drive;if(!calendar)empty($('#googleCalendarList'),active?'صلاحية Calendar غير متاحة في هذا الربط.':'اربط Google أولًا لعرض المواعيد.');if(!drive)empty($('#googleDriveList'),active?'صلاحية Drive غير متاحة في هذا الربط.':'اربط Google أولًا لعرض الملفات المتاحة للتطبيق.')}
async function loadStatus(){const s=await session();if(!s){renderStatus(null);return}try{const data=await api('status');renderStatus(data.connection)}catch(e){console.warn(e);renderStatus(null)}}
async function captureProviderSession(s){if(capturing||!s?.provider_token)return false;capturing=true;try{setBusy(true);const data=await api('connect',{provider_token:s.provider_token,provider_refresh_token:s.provider_refresh_token||''});renderStatus(data.connection);history.replaceState({},document.title,location.pathname);try{await supabase.auth.refreshSession()}catch{}toast('تم ربط Google بشكل آمن');return true}catch(e){toast(friendlyError(e),true);return false}finally{setBusy(false);capturing=false}}
async function connect(){setBusy(true);try{const redirectTo=`${location.origin}/google-connect.html`;const{error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo,scopes:`${CALENDAR_SCOPE} ${DRIVE_SCOPE}`,queryParams:{access_type:'offline',prompt:'consent',include_granted_scopes:'true'}}});if(error)throw error}catch(e){setBusy(false);toast(friendlyError(e),true)}}
async function disconnect(){if(!confirm('تفصل Google وتحذف التوكنات المخزنة من UON Hub؟'))return;setBusy(true);try{await api('disconnect');await supabase.auth.signOut({scope:'local'});currentSession=null;renderStatus(null);empty($('#googleCalendarList'),'تم فصل Google.');empty($('#googleDriveList'),'تم فصل Google.');toast('تم فصل Google وحذف التوكنات من Vault')}catch(e){toast(friendlyError(e),true)}finally{setBusy(false)}}
async function loadCalendar(){setBusy(true);try{const data=await api('calendar-upcoming'),list=$('#googleCalendarList');if(!data.events?.length){empty(list,'ما فيه مواعيد قادمة ضمن النتائج الحالية.');return}list.replaceChildren();for(const event of data.events){const a=document.createElement('a');a.className='google-item';a.href=event.url||'#';a.target=event.url?'_blank':'_self';a.rel='noopener noreferrer';const strong=document.createElement('strong');strong.textContent=event.summary||'موعد';const small=document.createElement('small');small.textContent=[safeDate(event.start),event.location].filter(Boolean).join(' · ');a.append(strong,small);list.appendChild(a)}}catch(e){empty($('#googleCalendarList'),`تعذر تحميل التقويم: ${friendlyError(e)}`)}finally{setBusy(false)}}
async function loadDrive(){setBusy(true);try{const data=await api('drive-files'),list=$('#googleDriveList');if(!data.files?.length){empty(list,'ما فيه ملفات Drive مصرح بها للتطبيق حاليًا. استخدم/اختر ملفًا مع UON Hub أولًا.');return}list.replaceChildren();for(const file of data.files){const a=document.createElement('a');a.className='google-item';a.href=file.url||'#';a.target=file.url?'_blank':'_self';a.rel='noopener noreferrer';const strong=document.createElement('strong');strong.textContent=file.name||'ملف Google Drive';const small=document.createElement('small');small.textContent=[file.mime_type,safeDate(file.modified_at)].filter(Boolean).join(' · ');a.append(strong,small);list.appendChild(a)}}catch(e){empty($('#googleDriveList'),`تعذر تحميل Drive: ${friendlyError(e)}`)}finally{setBusy(false)}}

setupNav();
$('#googleConnectBtn')?.addEventListener('click',()=>void connect());
$('#googleRefreshBtn')?.addEventListener('click',()=>void loadStatus());
$('#googleDisconnectBtn')?.addEventListener('click',()=>void disconnect());
$('#googleCalendarLoad')?.addEventListener('click',()=>void loadCalendar());
$('#googleDriveLoad')?.addEventListener('click',()=>void loadDrive());

supabase.auth.onAuthStateChange((event,s)=>{currentSession=s||null;if((event==='SIGNED_IN'||event==='INITIAL_SESSION')&&s?.provider_token)queueMicrotask(()=>void captureProviderSession(s));});

async function init(){try{await enforceUonMaintenance()}catch{}try{watchUonMaintenance()}catch{}try{const s=await session();if(s?.provider_token)await captureProviderSession(s);await loadStatus()}catch(e){console.warn('google-connect init',e);renderStatus(null)}}
void init();
