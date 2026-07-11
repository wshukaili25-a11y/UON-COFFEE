(function(){
  const pageMap={
    'summaries.html':5,'tools.html':7,'schedule.html':9,'groups.html':10,'whatsapp.html':10,'marketplace.html':11,
    'features.html':6,'questions.html':12,'projects.html':13
  };
  function pageName(){return location.pathname.split('/').pop()||'index.html'}
  async function getSettings(keys){
    if (window.supabase) {
      const res = await window.supabase.from('settings').select('*').in('key', keys);
      return res.data || [];
    }
    if (window._sbURL && window._sbKEY) {
      const url = window._sbURL + '/rest/v1/settings?select=*&key=in.(' + keys.join(',') + ')';
      const r = await fetch(url, {headers:{apikey:window._sbKEY, Authorization:'Bearer '+window._sbKEY}});
      if (!r.ok) return [];
      return await r.json();
    }
    return [];
  }
  async function getStatus(id){
    if(!id) return 'active';
    try{
      const keys=['tool_'+id+'_status','tool_'+id+'_enabled'];
      const timeout=new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),4500));
      const data=await Promise.race([getSettings(keys),timeout]);
      const map={}; (data||[]).forEach(x=>map[x.key]=x.value);
      return map['tool_'+id+'_status'] || (map['tool_'+id+'_enabled']==='false'?'disabled':'active');
    }catch(e){ return 'active'; }
  }
  function blockPage(status){
    const label=status==='maintenance'?'الأداة تحت الصيانة حالياً':'الأداة غير متاحة حالياً';
    document.body.innerHTML='<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;background:#0a0e27;color:#e2e8f0;font-family:Tajawal,Arial,sans-serif;direction:rtl"><section style="max-width:520px;background:#1a1f3d;border:1px solid rgba(255,255,255,.08);border-radius:26px;padding:36px 26px"><div style="font-size:54px;margin-bottom:12px">☕</div><h1 style="margin:0 0 8px;font-size:1.7rem">Coming Soon</h1><p style="color:#a0aec0;line-height:1.8;margin:0 0 22px">'+label+'، تابعونا قريباً لتحديثات UoN Coffee.</p><a href="index.html" style="display:inline-block;background:#00d4ff;color:#0a0e27;text-decoration:none;padding:12px 20px;border-radius:14px;font-weight:900">الرجوع للرئيسية</a></section></main>';
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    const id=pageMap[pageName()]; if(!id) return;
    const status=await getStatus(id); if(status!=='active') blockPage(status);
  });
})();
