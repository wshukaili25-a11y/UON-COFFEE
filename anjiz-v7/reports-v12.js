(()=>{if(window.__anjizReportsTimetableCommsRegInstStudentDemoV19)return;window.__anjizReportsTimetableCommsRegInstStudentDemoV19=1;
const reportUrl='https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/6f208a721d1621ceef38937815d122ab09c6ca31/anjiz-v7/reports-v12.js';
const root='https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/anjiz-system-v7/anjiz-v7/';
async function text(u,n){return fetch(u,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(n+' '+r.status);return r.text()})}
async function gunzipB64(t){const b=Uint8Array.from(atob(t.trim()),c=>c.charCodeAt(0));return await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text()}
async function unpack(url,marker,label){const p=await text(url,label);const raw=await gunzipB64(p),i=raw.indexOf(marker);if(i<0)throw new Error(label+' validation failed');return{js:raw.slice(0,i),css:raw.slice(i+marker.length)}}
function style(id,css){if(!css||document.getElementById(id))return;const s=document.createElement('style');s.id=id;s.textContent=css;document.head.appendChild(s)}
(async()=>{try{
const [reportCode,tt,comm,reg,inst,sv,svfix,demo]=await Promise.all([
 text(reportUrl,'reports core'),
 unpack(root+'timetable-v13.pack.b64?v=20260901e','/*__ANJIZ_TIMETABLE_CSS_SPLIT__*/','timetable pack'),
 unpack(root+'comms-v14.pack.b64?v=20260901f','/*__ANJIZ_COMMS_CSS_SPLIT__*/','communications pack'),
 unpack(root+'registration-v15.pack.b64?v=20260901g','/*__ANJIZ_REGISTRATION_CSS_SPLIT__*/','registration pack'),
 unpack(root+'instructor-v16.pack.b64?v=20260901h','/*__ANJIZ_INSTRUCTOR_CSS_SPLIT__*/','instructor pack'),
 unpack(root+'student-v18.pack.b64?v=20260901i','/*__ANJIZ_STUDENT_CSS_SPLIT__*/','student visitor pack'),
 unpack(root+'student-v18-fix.pack.b64?v=20260901j','/*__ANJIZ_STUDENT_FIX_CSS_SPLIT__*/','student visitor record fix'),
 unpack(root+'demo-v19.pack.b64?v=20260901k','/*__ANJIZ_DEMO_V19_CSS_SPLIT__*/','demo services pack')
]);
style('timetableV13-css',tt.css);style('commsV14-css',comm.css);style('registrationV15-css',reg.css);style('instructorV16-css',inst.css);style('studentV18-css',sv.css);style('demoV19-css',demo.css);
const blob=new Blob([reportCode+'\n'+tt.js+'\n'+comm.js+'\n'+reg.js+'\n'+inst.js+'\n'+sv.js+'\n'+svfix.js+'\n'+demo.js],{type:'text/javascript'}),url=URL.createObjectURL(blob);
await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});URL.revokeObjectURL(url);
window.__reportsV12CoreLoaded=1;window.__timetableV13Loaded=1;window.__commsV14Loaded=1;window.__registrationV15Loaded=1;window.__instructorV16Loaded=1;window.__studentV18Loaded=1;window.__demoV19Loaded=1;
}catch(e){console.warn('ANJIZ V19 add-ons unavailable',e)}})()})();
