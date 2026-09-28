(()=>{if(window.__anjizResilientV27)return;window.__anjizResilientV27=1;
const reportUrl='https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/6f208a721d1621ceef38937815d122ab09c6ca31/anjiz-v7/reports-v12.js';
const root='https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/anjiz-system-v7/anjiz-v7/';
async function txt(u,n){const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(n+' '+r.status);return r.text()}
async function gunzip(t){const b=Uint8Array.from(atob(t.trim()),c=>c.charCodeAt(0));if(!('DecompressionStream'in window))throw new Error('Browser decompression unavailable');return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text()}
async function unpack(file,marker,label){const raw=await gunzip(await txt(root+file+'?v=20260928final',label)),i=raw.indexOf(marker);if(i<0)throw new Error(label+' validation failed');return{js:raw.slice(0,i),css:raw.slice(i+marker.length)}}
function style(id,css){if(!css||document.getElementById(id))return;const s=document.createElement('style');s.id=id;s.textContent=css;document.head.appendChild(s)}
async function run(code){if(!code)return;const b=new Blob([code],{type:'text/javascript'}),url=URL.createObjectURL(b);try{await new Promise((ok,no)=>{const s=document.createElement('script');s.src=url;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}finally{URL.revokeObjectURL(url)}}
async function loadPack(m){try{const p=await unpack(m.file,m.marker,m.label);style(m.style,p.css);await run(p.js);window[m.flag]=1;return true}catch(e){console.warn('ANJIZ optional module unavailable:',m.label,e);return false}}
(async()=>{try{await run(await txt(reportUrl,'reports core'));window.__reportsV12CoreLoaded=1}catch(e){console.warn('ANJIZ reports core unavailable',e)}
const mods=[
 {file:'timetable-v13.pack.b64',marker:'/*__ANJIZ_TIMETABLE_CSS_SPLIT__*/',label:'Timetable V13',style:'timetableV13-css',flag:'__timetableV13Loaded'},
 {file:'comms-v14.pack.b64',marker:'/*__ANJIZ_COMMS_CSS_SPLIT__*/',label:'Communications V14',style:'commsV14-css',flag:'__commsV14Loaded'},
 {file:'registration-v15.pack.b64',marker:'/*__ANJIZ_REGISTRATION_CSS_SPLIT__*/',label:'Registration V15',style:'registrationV15-css',flag:'__registrationV15Loaded'},
 {file:'instructor-v16.pack.b64',marker:'/*__ANJIZ_INSTRUCTOR_CSS_SPLIT__*/',label:'Instructor/Peer V16-V17',style:'instructorV16-css',flag:'__instructorV16Loaded'},
 {file:'student-v18.pack.b64',marker:'/*__ANJIZ_STUDENT_CSS_SPLIT__*/',label:'Student/Visitor V18',style:'studentV18-css',flag:'__studentV18Loaded'},
 {file:'student-v18-fix.pack.b64',marker:'/*__ANJIZ_STUDENT_FIX_CSS_SPLIT__*/',label:'Student record fix',style:'studentV18Fix-css',flag:'__studentV18FixLoaded'},
 {file:'demo-v19.pack.b64',marker:'/*__ANJIZ_DEMO_V19_CSS_SPLIT__*/',label:'Demo services V19',style:'demoV19-css',flag:'__demoV19Loaded'},
 {file:'qr-v20.pack.b64',marker:'/*__ANJIZ_QR_V20_CSS_SPLIT__*/',label:'QR identity V20',style:'qrV20-css',flag:'__qrV20Loaded'}];
for(const m of mods)await loadPack(m);
try{style('finalV27-css',await txt(root+'final-v27.css?v=20260928final','Final V27 CSS'));await run(await txt(root+'final-v27.js?v=20260928final','Final V27 JS'));window.__finalV27Loaded=1}catch(e){console.warn('ANJIZ final controls unavailable',e)}
window.__anjizLoadedModulesV27={reports:!!window.__reportsV12CoreLoaded,timetable:!!window.__timetableV13Loaded,communications:!!window.__commsV14Loaded,registration:!!window.__registrationV15Loaded,instructor:!!window.__instructorV16Loaded,student:!!window.__studentV18Loaded,demo:!!window.__demoV19Loaded,qr:!!window.__qrV20Loaded,final:!!window.__finalV27Loaded};
})()})();