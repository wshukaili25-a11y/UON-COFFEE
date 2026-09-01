(()=>{
  if(window.__anjizAppointmentsSafeLoaderV25)return;
  window.__anjizAppointmentsSafeLoaderV25=1;

  const STABLE_APPOINTMENTS='https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/c901e4101b97ec981dce9714fe42c2c6e7df7bfc/anjiz-v7/appointments-v9.js';
  const QR_LIB='https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
  const QR_MAKE_LIB='https://raw.githubusercontent.com/davidshimjs/qrcodejs/master/qrcode.min.js';
  let activeScanner=null;

  function loadScript(src,id){
    return new Promise((resolve,reject)=>{
      if(id&&document.getElementById(id)){
        if(id==='anjiz-html5-qrcode-v24'&&window.Html5Qrcode)return resolve();
        const old=document.getElementById(id);
        old.addEventListener('load',resolve,{once:true});
        old.addEventListener('error',reject,{once:true});
        return;
      }
      const s=document.createElement('script');
      if(id)s.id=id;
      s.src=src;
      s.async=true;
      s.onload=resolve;
      s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  async function loadFetchedScript(src,id,test){
    if(test&&test())return;
    if(id&&document.getElementById(id)&&test&&test())return;
    const code=await fetch(src,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('library '+r.status);return r.text()});
    const blob=new Blob([code],{type:'text/javascript'}),url=URL.createObjectURL(blob);
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');if(id)s.id=id;s.src=url;
      s.onload=()=>{URL.revokeObjectURL(url);resolve()};
      s.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('library execution failed'))};
      document.head.appendChild(s);
    });
  }

  function normalizeScan(raw){
    const value=String(raw||'').trim();
    try{
      const u=new URL(value,location.href);
      for(const key of ['verifyUid','uid','id','user','verify']){
        const v=u.searchParams.get(key);
        if(v&&/^[A-Za-z0-9._-]{2,64}$/.test(v))return {id:v.toUpperCase(),url:value};
      }
      const m=(u.hash||'').match(/(?:uid|id|user|verify)=([A-Za-z0-9._-]{2,64})/i);
      if(m)return {id:m[1].toUpperCase(),url:value};
    }catch(e){}
    const m=value.match(/(?:ANJIZ\s*[:#|\-]\s*)?([A-Z]{1,5}\d{2,14})/i);
    return {id:(m?m[1]:value).toUpperCase(),url:/^https?:\/\//i.test(value)?value:''};
  }

  async function stopScanner(){
    const scanner=activeScanner;
    activeScanner=null;
    if(!scanner)return;
    try{if(scanner.isScanning)await scanner.stop()}catch(e){}
    try{await scanner.clear()}catch(e){}
  }

  window.stopAnjizScannerV24=async function(){
    await stopScanner();
    try{closeModal()}catch(e){}
  };

  async function applyResult(raw,fieldId){
    const result=normalizeScan(raw);
    await stopScanner();
    try{closeModal()}catch(e){}
    const target=document.getElementById(fieldId);
    if(target){
      target.value=result.id;
      target.dispatchEvent(new Event('input',{bubbles:true}));
      target.dispatchEvent(new Event('change',{bubbles:true}));
      target.focus();
    }
    if(fieldId==='loginId'){
      const p=document.getElementById('loginPass');
      if(p)p.focus();
    }
  }

  async function scanWithImage(file,fieldId){
    if(!file)return;
    try{
      if(!window.Html5Qrcode)await loadScript(QR_LIB,'anjiz-html5-qrcode-v24');
      const tempId='anjizQrTempV24';
      let temp=document.getElementById(tempId);
      if(!temp){temp=document.createElement('div');temp.id=tempId;temp.style.display='none';document.body.appendChild(temp)}
      const reader=new Html5Qrcode(tempId);
      const raw=await reader.scanFile(file,true);
      try{await reader.clear()}catch(e){}
      await applyResult(raw,fieldId);
    }catch(e){
      alert('The QR image could not be read. Try a clearer image or enter the University ID manually.');
    }
  }

  const scannerFunction=async function(fieldId){
    try{
      if(!window.Html5Qrcode)await loadScript(QR_LIB,'anjiz-html5-qrcode-v24');
    }catch(e){
      alert('QR scanner could not load. Check the internet connection and try again.');
      return;
    }

    try{
      showModal(`<div><span class="section-label">ANJIZ QR SCANNER</span><h3>Scan Student ID / QR</h3><p class="muted">Allow camera access, then point the rear camera at the ANJIZ QR code.</p><div id="anjizQrReaderV24" style="width:100%;min-height:300px;border-radius:14px;overflow:hidden;background:#071f17;margin-top:12px"></div><div class="row" style="margin-top:12px"><label class="btn secondary" style="cursor:pointer">Choose QR Image<input id="anjizQrFileV24" type="file" accept="image/*" style="display:none"></label><button class="btn danger" onclick="stopAnjizScannerV24()">Close</button></div></div>`);
    }catch(e){return}

    const file=document.getElementById('anjizQrFileV24');
    if(file)file.onchange=()=>scanWithImage(file.files&&file.files[0],fieldId);

    try{
      activeScanner=new Html5Qrcode('anjizQrReaderV24');
      await activeScanner.start(
        {facingMode:'environment'},
        {fps:10,qrbox:{width:230,height:230},aspectRatio:1},
        raw=>applyResult(raw,fieldId),
        ()=>{}
      );
    }catch(e){
      const box=document.getElementById('anjizQrReaderV24');
      if(box)box.innerHTML='<div class="notice warn" style="margin:12px">Camera access is unavailable here. Tap <b>Choose QR Image</b> and select or take a photo of the QR code.</div>';
    }
  };

  try{scanBarcodeToField=scannerFunction}catch(e){}
  window.scanBarcodeToField=scannerFunction;
  window.scanLoginId=function(){return scannerFunction('loginId')};

  function escV25(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function verificationUrlV25(uid){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('verifyUid',uid);return u.toString()}

  window.downloadMyQrV25=function(){
    const host=document.getElementById('anjizMyQrBoxV25');if(!host)return;
    const canvas=host.querySelector('canvas');const img=host.querySelector('img');
    const href=canvas?.toDataURL?.('image/png')||img?.src;if(!href)return;
    const a=document.createElement('a');a.href=href;a.download='ANJIZ-QR.png';document.body.appendChild(a);a.click();a.remove();
  };

  function installQrMakerV25(){
    if(window.__anjizQrMakerV25)return true;
    if(typeof window.openMyQrV24!=='function')return false;
    window.__anjizQrMakerV25=1;
    window.openMyQrV24=async function(){
      let who=null;try{who=me}catch(e){}if(!who)return;
      const verify=verificationUrlV25(who.uid);
      showModal(`<div style="text-align:center"><span class="section-label">ANJIZ DIGITAL ID</span><h3 style="margin:5px 0">My QR</h3><p class="muted">Scan to verify this ANJIZ identity.</p><div style="display:grid;place-items:center;min-height:270px"><div id="anjizMyQrBoxV25" style="width:260px;height:260px;max-width:100%;display:grid;place-items:center;background:#fff;border-radius:16px;padding:8px;box-sizing:border-box"><div class="muted">Generating QR…</div></div></div><b style="display:block;margin-top:8px">${escV25(who.name)}</b><span class="muted">${escV25(who.uid)} · ${escV25(who.sub||who.role||'')}</span><div class="row" style="justify-content:center;margin-top:14px;flex-wrap:wrap"><button class="btn primary" onclick="downloadMyQrV25()">Download QR</button><button class="btn secondary" onclick="navigator.clipboard?.writeText('${verify.replace(/'/g,"\\'")}');try{toast('Verification link copied')}catch(e){}">Copy Verification Link</button><button class="btn outline" onclick="closeModal()">Close</button></div></div>`);
      try{
        await loadFetchedScript(QR_MAKE_LIB,'anjiz-qrcode-maker-v25',()=>!!window.QRCode);
        const host=document.getElementById('anjizMyQrBoxV25');if(!host)return;host.innerHTML='';
        new QRCode(host,{text:verify,width:244,height:244,colorDark:'#0b5d3d',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
      }catch(e){
        const host=document.getElementById('anjizMyQrBoxV25');if(host)host.innerHTML='<div style="padding:20px;text-align:center"><b>QR generator unavailable</b><br><small class="muted">Use Copy Verification Link</small></div>';
      }
    };
    return true;
  }

  let qrInstallTries=0;
  const qrInstallTimer=setInterval(()=>{if(installQrMakerV25()||++qrInstallTries>100)clearInterval(qrInstallTimer)},150);

  fetch(STABLE_APPOINTMENTS,{cache:'no-store'})
    .then(r=>{if(!r.ok)throw new Error('appointments '+r.status);return r.text()})
    .then(code=>{
      const blob=new Blob([code],{type:'text/javascript'});
      const url=URL.createObjectURL(blob);
      const s=document.createElement('script');
      s.src=url;
      s.onload=()=>URL.revokeObjectURL(url);
      s.onerror=()=>URL.revokeObjectURL(url);
      document.head.appendChild(s);
    })
    .catch(e=>console.warn('ANJIZ appointments enhancement unavailable',e));
})();
