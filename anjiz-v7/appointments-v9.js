(()=>{
  if(window.__anjizAppointmentsSafeLoaderV26)return;
  window.__anjizAppointmentsSafeLoaderV26=1;

  const STABLE_APPOINTMENTS='https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/c901e4101b97ec981dce9714fe42c2c6e7df7bfc/anjiz-v7/appointments-v9.js';
  const QR_LIB='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
  const QR_MAKE_LIB='https://raw.githubusercontent.com/davidshimjs/qrcodejs/master/qrcode.min.js';
  let activeScanner=null,fastScanner=null,fastBusy=false,lastFastId='',lastFastAt=0;

  function loadScript(src,id){
    return new Promise((resolve,reject)=>{
      if(id&&document.getElementById(id)){
        if(id==='anjiz-html5-qrcode-v26'&&window.Html5Qrcode)return resolve();
        const old=document.getElementById(id);
        old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return;
      }
      const s=document.createElement('script');if(id)s.id=id;s.src=src;s.async=true;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);
    });
  }
  async function loadFetchedScript(src,id,test){
    if(test&&test())return;
    const code=await fetch(src,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('library '+r.status);return r.text()});
    const blob=new Blob([code],{type:'text/javascript'}),url=URL.createObjectURL(blob);
    await new Promise((resolve,reject)=>{const s=document.createElement('script');if(id)s.id=id;s.src=url;s.onload=()=>{URL.revokeObjectURL(url);resolve()};s.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('library execution failed'))};document.head.appendChild(s)});
  }
  async function ensureQr(){if(!window.Html5Qrcode)await loadScript(QR_LIB,'anjiz-html5-qrcode-v26')}
  function normalizeScan(raw){
    const value=String(raw||'').trim();
    try{const u=new URL(value,location.href);for(const key of ['verifyUid','uid','id','user','verify']){const v=u.searchParams.get(key);if(v&&/^[A-Za-z0-9._-]{2,64}$/.test(v))return {id:v.toUpperCase(),url:value}}const m=(u.hash||'').match(/(?:uid|id|user|verify)=([A-Za-z0-9._-]{2,64})/i);if(m)return{id:m[1].toUpperCase(),url:value}}catch(e){}
    const m=value.match(/(?:ANJIZ\s*[:#|\-]\s*)?([A-Z]{1,5}\d{2,14})/i);return{id:(m?m[1]:value).toUpperCase(),url:/^https?:\/\//i.test(value)?value:''};
  }
  async function stopScanner(){const scanner=activeScanner;activeScanner=null;if(!scanner)return;try{if(scanner.isScanning)await scanner.stop()}catch(e){}try{await scanner.clear()}catch(e){}}
  window.stopAnjizScannerV26=async()=>{await stopScanner();try{closeModal()}catch(e){}};

  function clickSignInV26(){
    const pass=document.getElementById('loginPass');if(pass&&!pass.value)pass.value='anjiz';
    const btn=[...document.querySelectorAll('button')].find(b=>/^\s*sign\s*in\s*$/i.test(b.textContent||''));
    if(btn)setTimeout(()=>btn.click(),80);
  }
  async function applyResult(raw,fieldId){
    const result=normalizeScan(raw);await stopScanner();try{closeModal()}catch(e){}
    const target=document.getElementById(fieldId);if(target){target.value=result.id;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));target.focus()}
    if(fieldId==='loginId')clickSignInV26();
  }
  async function scanWithImage(file,fieldId){
    if(!file)return;try{await ensureQr();const tempId='anjizQrTempV26';let temp=document.getElementById(tempId);if(!temp){temp=document.createElement('div');temp.id=tempId;temp.style.display='none';document.body.appendChild(temp)}const reader=new Html5Qrcode(tempId),raw=await reader.scanFile(file,true);try{await reader.clear()}catch(e){}await applyResult(raw,fieldId)}catch(e){alert('The QR image could not be read. Try a clearer image or enter the University ID manually.')}
  }
  const scannerFunction=async function(fieldId='loginId'){
    try{await ensureQr()}catch(e){alert('QR scanner could not load. Check the internet connection and try again.');return}
    try{showModal(`<div><span class="section-label">ANJIZ QR SCANNER</span><h3>Scan Student ID / QR</h3><p class="muted">Point the rear camera at the ANJIZ QR or barcode.</p><div id="anjizQrReaderV26" style="width:100%;min-height:300px;border-radius:14px;overflow:hidden;background:#071f17;margin-top:12px"></div><div class="row" style="margin-top:12px"><label class="btn secondary" style="cursor:pointer">Choose QR Image<input id="anjizQrFileV26" type="file" accept="image/*" style="display:none"></label><button class="btn danger" onclick="stopAnjizScannerV26()">Close</button></div></div>`)}catch(e){return}
    const file=document.getElementById('anjizQrFileV26');if(file)file.onchange=()=>scanWithImage(file.files&&file.files[0],fieldId);
    try{activeScanner=new Html5Qrcode('anjizQrReaderV26');await activeScanner.start({facingMode:'environment'},{fps:12,qrbox:{width:235,height:235},aspectRatio:1},raw=>applyResult(raw,fieldId),()=>{})}catch(e){const box=document.getElementById('anjizQrReaderV26');if(box)box.innerHTML='<div class="notice warn" style="margin:12px">Camera access is unavailable here. Tap <b>Choose QR Image</b> and select or take a photo of the QR code.</div>'}
  };
  function installLoginScanner(){try{scanBarcodeToField=scannerFunction}catch(e){}window.scanBarcodeToField=scannerFunction;try{scanLoginId=()=>scannerFunction('loginId')}catch(e){}window.scanLoginId=()=>scannerFunction('loginId')}
  installLoginScanner();let scanInstall=0;const installTimer=setInterval(()=>{installLoginScanner();if(++scanInstall>120)clearInterval(installTimer)},100);

  function escV26(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function todayV26(){try{if(typeof localDateISO==='function')return localDateISO()}catch(e){}const d=new Date(),o=d.getTimezoneOffset();return new Date(d.getTime()-o*60000).toISOString().slice(0,10)}
  function timeV26(){return new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false})}
  function dayV26(date){try{if(typeof dayOf==='function')return dayOf(date)}catch(e){}return new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long'})}
  function getUserV26(uid){try{if(typeof user==='function')return user(uid)}catch(e){}try{return db.users.find(x=>x.uid===uid)}catch(e){return null}}
  function nextIdV26(arr){return Math.max(0,...(arr||[]).map(x=>Number(x.id)||0))+1}
  function minutesLateV26(now,start){if(!start||!/^\d\d:\d\d/.test(start))return 0;const [h,m]=now.split(':').map(Number),[sh,sm]=start.slice(0,5).split(':').map(Number);return Math.max(0,(h*60+m)-(sh*60+sm))}
  function expectedV26(u,date){
    if(['Student','Visitor'].includes(u.role)){try{const a=db.appointments.find(x=>x.studentUid===u.uid&&x.date===date&&x.status!=='Cancelled');if(a?.time)return a.time.slice(0,5)}catch(e){}}
    try{if(typeof scheduledDutyStart==='function'){const x=scheduledDutyStart(u.uid,date);if(x&&x!=='—')return String(x).slice(0,5)}}catch(e){}
    try{return db.settings?.lateAfter||''}catch(e){return''}
  }
  function beepV26(ok=true){try{const C=window.AudioContext||window.webkitAudioContext,c=new C(),o=c.createOscillator(),g=c.createGain();o.frequency.value=ok?880:260;g.gain.setValueAtTime(.08,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.12);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.12);setTimeout(()=>c.close(),250)}catch(e){}try{navigator.vibrate?.(ok?60:[80,50,80])}catch(e){}}
  function fastStatusV26(kind,title,body){const s=document.getElementById('anjizFastStatusV26');if(!s)return;const bg=kind==='ok'?'#e9f8ef':kind==='warn'?'#fff6df':'#fdeaea',fg=kind==='ok'?'#0a6b47':kind==='warn'?'#8a5a00':'#a32929';s.style.background=bg;s.style.color=fg;s.innerHTML=`<b style="font-size:17px;display:block">${escV26(title)}</b><span style="font-size:12px;display:block;margin-top:3px">${escV26(body)}</span>`}
  function recordFastAttendanceV26(uid){
    const u=getUserV26(uid);if(!u||u.active===false)return{ok:false,title:'Unknown ID',body:`${uid} was not found or is inactive.`};
    if(u.role==='Admin')return{ok:false,title:'Admin QR',body:'Admin attendance is not recorded in Fast Scan mode.'};
    const date=todayV26(),now=timeV26();db.attendance=db.attendance||[];
    let r=db.attendance.find(x=>x.uid===u.uid&&x.date===date);
    let action='CHECKED IN',extra='';
    if(r&&r.login&&r.login!=='—'&&(!r.logout||r.logout==='—')){r.logout=now;r.note=[r.note,'QR fast check-out'].filter(Boolean).join(' · ');action='CHECKED OUT'}
    else if(r&&r.logout&&r.logout!=='—'){return{ok:true,title:`${u.name} · ALREADY COMPLETE`,body:`${u.role} · ${r.login} → ${r.logout}`}}
    else{
      const expected=expectedV26(u,date),late=minutesLateV26(now,expected),status=late>0?'Late':'On time';
      if(r){r.login=now;r.logout='—';r.status=status;r.note=late?`QR fast check-in · ${late} minutes late`:'QR fast check-in'}
      else{r={id:nextIdV26(db.attendance),uid:u.uid,name:u.name,role:u.role,date,day:dayV26(date),login:now,logout:'—',status,note:late?`QR fast check-in · ${late} minutes late`:'QR fast check-in',supervisorComment:''};db.attendance.push(r)}
      if(['Student','Visitor'].includes(u.role)){
        const matches=(db.appointments||[]).filter(a=>a.studentUid===u.uid&&a.date===date&&a.status!=='Cancelled');
        const a=matches.find(x=>x.attendance!=='Present')||matches[0];
        if(a){a.attendance='Present';extra=` · ${a.serviceName||a.service||'Appointment'} marked Present`}else extra=' · Center check-in (no appointment matched today)';
      }
    }
    try{save()}catch(e){}try{audit(`QR ${action.toLowerCase()} · ${u.uid}`)}catch(e){}
    return{ok:true,title:`${u.name} · ${action}`,body:`${u.role} · ${now}${extra}`};
  }
  async function stopFastV26(){const q=fastScanner;fastScanner=null;if(!q)return;try{if(q.isScanning)await q.stop()}catch(e){}try{await q.clear()}catch(e){}}
  window.closeFastAttendanceV26=async()=>{await stopFastV26();document.getElementById('anjizFastOverlayV26')?.remove()};
  async function handleFastRawV26(raw){
    if(fastBusy)return;const id=normalizeScan(raw).id,now=Date.now();if(id===lastFastId&&now-lastFastAt<4500)return;lastFastId=id;lastFastAt=now;fastBusy=true;
    const res=recordFastAttendanceV26(id);beepV26(res.ok);fastStatusV26(res.ok?'ok':'bad',res.title,res.body);
    setTimeout(()=>{fastBusy=false;fastStatusV26('warn','Ready for next scan','Hold the next ANJIZ QR or barcode inside the frame.')},1400);
  }
  window.openFastAttendanceV26=async function(){
    document.getElementById('anjizFastOverlayV26')?.remove();
    const d=document.createElement('div');d.id='anjizFastOverlayV26';d.style.cssText='position:fixed;inset:0;z-index:1000000;background:#062c20;display:grid;grid-template-rows:auto minmax(0,1fr) auto;color:#fff;padding:max(16px,env(safe-area-inset-top)) 16px max(18px,env(safe-area-inset-bottom));box-sizing:border-box';
    d.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><small style="font-weight:900;letter-spacing:.12em;opacity:.75">ANJIZ FAST GATE</small><h2 style="margin:5px 0 0">Fast Attendance Scan</h2><span style="font-size:12px;opacity:.78">Student · Instructor · Peer‑Tutor · Trainee · Visitor</span></div><button onclick="closeFastAttendanceV26()" style="width:44px;height:44px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:#fff;border-radius:14px;font-size:25px">×</button></div><div style="display:grid;place-items:center;min-height:0;padding:18px 0"><div id="anjizFastReaderV26" style="width:min(520px,100%);min-height:330px;border-radius:22px;overflow:hidden;background:#021710;border:1px solid rgba(255,255,255,.15)"></div></div><div><div id="anjizFastStatusV26" style="background:#fff6df;color:#8a5a00;border-radius:16px;padding:13px 15px"><b style="font-size:17px;display:block">Starting scanner…</b><span style="font-size:12px;display:block;margin-top:3px">Allow camera access. The scanner stays open for the queue.</span></div><p style="font-size:11px;opacity:.7;text-align:center;margin:10px 0 0">1st scan = Check‑in · 2nd scan = Check‑out · duplicate scans are ignored for 4.5 seconds</p></div>`;document.body.appendChild(d);
    try{await ensureQr();fastScanner=new Html5Qrcode('anjizFastReaderV26');await fastScanner.start({facingMode:'environment'},{fps:15,qrbox:{width:245,height:245},aspectRatio:1},handleFastRawV26,()=>{});fastStatusV26('warn','Ready for next scan','Hold an ANJIZ QR or barcode inside the frame.')}catch(e){fastStatusV26('bad','Camera unavailable','Open this page in Safari and allow Camera access.');}
  };
  function installFastButton(){
    let role='';try{role=me?.role||''}catch(e){}
    let b=document.getElementById('anjizFastAttendanceBtnV26');
    if(role!=='admin'){b?.remove();return}
    if(b)return;b=document.createElement('button');b.id='anjizFastAttendanceBtnV26';b.type='button';b.onclick=()=>openFastAttendanceV26();b.innerHTML='⚡ Fast Attendance';b.style.cssText='position:fixed;right:18px;bottom:92px;z-index:9000;border:0;border-radius:999px;background:#0b6848;color:white;padding:12px 16px;font:800 12px system-ui;box-shadow:0 10px 28px rgba(0,0,0,.2);cursor:pointer';document.body.appendChild(b)
  }
  setInterval(installFastButton,650);

  function verificationUrlV26(uid){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('verifyUid',uid);return u.toString()}
  window.downloadMyQrV26=function(){const host=document.getElementById('anjizMyQrBoxV26');if(!host)return;const canvas=host.querySelector('canvas'),img=host.querySelector('img'),href=canvas?.toDataURL?.('image/png')||img?.src;if(!href)return;const a=document.createElement('a');a.href=href;a.download='ANJIZ-QR.png';document.body.appendChild(a);a.click();a.remove()};
  function installQrMakerV26(){
    if(window.__anjizQrMakerV26)return true;if(typeof window.openMyQrV24!=='function')return false;window.__anjizQrMakerV26=1;
    window.openMyQrV24=async function(){let who=null;try{who=me}catch(e){}if(!who)return;const verify=verificationUrlV26(who.uid);showModal(`<div style="text-align:center"><span class="section-label">ANJIZ DIGITAL ID</span><h3 style="margin:5px 0">My QR</h3><p class="muted">Scan for instant ANJIZ login or attendance.</p><div style="display:grid;place-items:center;min-height:270px"><div id="anjizMyQrBoxV26" style="width:260px;height:260px;max-width:100%;display:grid;place-items:center;background:#fff;border-radius:16px;padding:8px;box-sizing:border-box"><div class="muted">Generating QR…</div></div></div><b style="display:block;margin-top:8px">${escV26(who.name)}</b><span class="muted">${escV26(who.uid)} · ${escV26(who.sub||who.role||'')}</span><div class="row" style="justify-content:center;margin-top:14px;flex-wrap:wrap"><button class="btn primary" onclick="downloadMyQrV26()">Download QR</button><button class="btn secondary" onclick="navigator.clipboard?.writeText('${verify.replace(/'/g,"\\'")}');try{toast('Verification link copied')}catch(e){}">Copy Verification Link</button><button class="btn outline" onclick="closeModal()">Close</button></div></div>`);try{await loadFetchedScript(QR_MAKE_LIB,'anjiz-qrcode-maker-v26',()=>!!window.QRCode);const host=document.getElementById('anjizMyQrBoxV26');if(!host)return;host.innerHTML='';new QRCode(host,{text:verify,width:244,height:244,colorDark:'#0b5d3d',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}catch(e){const host=document.getElementById('anjizMyQrBoxV26');if(host)host.innerHTML='<div style="padding:20px;text-align:center"><b>QR generator unavailable</b><br><small class="muted">Use Copy Verification Link</small></div>'}}
    return true;
  }
  let qrTries=0;const qrTimer=setInterval(()=>{if(installQrMakerV26()||++qrTries>120)clearInterval(qrTimer)},150);

  fetch(STABLE_APPOINTMENTS,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('appointments '+r.status);return r.text()}).then(code=>{const blob=new Blob([code],{type:'text/javascript'}),url=URL.createObjectURL(blob),s=document.createElement('script');s.src=url;s.onload=()=>URL.revokeObjectURL(url);s.onerror=()=>URL.revokeObjectURL(url);document.head.appendChild(s)}).catch(e=>console.warn('ANJIZ appointments enhancement unavailable',e));
})();
