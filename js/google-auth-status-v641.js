const DEFAULT_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const DEFAULT_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';

export async function getGoogleAuthStatus({supabaseUrl=DEFAULT_URL,publishableKey=DEFAULT_KEY,signal}={}){
  try{
    const response=await fetch(`${supabaseUrl}/auth/v1/settings`,{headers:{apikey:publishableKey},cache:'no-store',signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)return{checked:true,enabled:false,available:false,error:`settings_http_${response.status}`};
    return{checked:true,enabled:data?.external?.google===true,available:true,error:null};
  }catch(error){
    return{checked:false,enabled:false,available:false,error:String(error?.message||error||'settings_unavailable')};
  }
}

export function googleAuthStatusText(status,{compact=false}={}){
  if(status?.enabled)return compact?'Google جاهز':'Google OAuth جاهز للربط.';
  if(status?.checked&&status?.available)return compact?'Google قيد الإعداد':'ربط Google قيد الإعداد حاليًا. الموقع وباقي أدوات UON Hub تظل شغالة طبيعي.';
  return compact?'حالة Google غير متاحة':'تعذر التحقق من حالة Google الآن. جرّب لاحقًا؛ باقي UON Hub ما يتأثر.';
}

export async function applyGoogleAuthGates(root=document){
  const status=await getGoogleAuthStatus();
  root.querySelectorAll('[data-google-auth-gate]').forEach(el=>{
    el.dataset.googleAuthEnabled=status.enabled?'true':'false';
    el.classList.toggle('is-disabled',!status.enabled);
    el.setAttribute('aria-disabled',status.enabled?'false':'true');
    if(el.matches('a')&&!status.enabled){el.dataset.googleHref=el.getAttribute('href')||'';el.removeAttribute('href');}
    if(el.matches('button'))el.disabled=!status.enabled;
    const ready=el.getAttribute('data-google-ready-label');
    const pending=el.getAttribute('data-google-pending-label');
    if(status.enabled&&ready)el.textContent=ready;
    if(!status.enabled&&pending)el.textContent=pending;
    el.title=googleAuthStatusText(status);
  });
  root.querySelectorAll('[data-google-auth-status]').forEach(el=>{
    el.textContent=googleAuthStatusText(status,{compact:el.hasAttribute('data-compact')});
    el.dataset.state=status.enabled?'ready':status.checked?'pending':'unknown';
  });
  return status;
}
