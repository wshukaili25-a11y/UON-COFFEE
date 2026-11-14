// UON Hub email templates: one fixed, branded layout for every message.
export const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const SITE='https://www.uonhub.space';
const LOGO=SITE+'/assets/icons/uonhub-192-v75.png';
const C={green:'#0B3B2C',green2:'#0F5A41',gold:'#CFA038',cream:'#F6F2E7',line:'#E6DFC9',text:'#1C3A2E',muted:'#6B7F74'};
const FONT="Tajawal,'Segoe UI',Tahoma,Arial,sans-serif";
export const DAYS=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس'];
const TYPES={lecture:'محاضرة',lab:'مختبر / عملي',tutorial:'تمارين',workshop:'ورشة',other:'أخرى'};

export function validEmail(value){return typeof value==='string'&&value.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)}
export function cleanName(value){const name=String(value??'').replace(/\s+/g,' ').trim();return name.length>=2&&name.length<=80&&!/[\r\n<>{}\\]/.test(name)?name:null}
export function attachmentUrl(item,base){try{const u=new URL(item.url||item.link||item.pdf_url);return u.origin===new URL(base).origin&&u.pathname.startsWith('/storage/v1/object/public/summaries/')&&u.pathname.toLowerCase().endsWith('.pdf')&&!u.username&&!u.password?u.href:null}catch{return null}}

const clock=/^([01]\d|2[0-3]):([0-5]\d)$/;
const minutes=v=>{const m=clock.exec(v);return m?Number(m[1])*60+Number(m[2]):null};
export function formatClock(value){const total=minutes(value);if(total==null)return '';const h=Math.floor(total/60),m=String(total%60).padStart(2,'0');return `${h%12||12}:${m} ${h<12?'ص':'م'}`}
const text=(v,max)=>String(v??'').replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);

/** Validate a schedule sent by the browser. Returns {title,rows} or null. */
export function cleanSchedule(input){
 if(!input||typeof input!=='object'||!Array.isArray(input.rows))return null;
 if(input.rows.length<1||input.rows.length>80)return null;
 const rows=[];
 for(const r of input.rows){
  if(!r||typeof r!=='object')return null;
  const course=text(r.course,40),day=String(r.day||''),start=String(r.start||''),end=String(r.end||'');
  if(!course||!DAYS.includes(day)||minutes(start)==null||minutes(end)==null||minutes(end)<=minutes(start))return null;
  rows.push({course,day,start,end,room:text(r.room,30),teacher:text(r.teacher,80),type:TYPES[r.type]?r.type:'lecture'});
 }
 rows.sort((a,b)=>DAYS.indexOf(a.day)-DAYS.indexOf(b.day)||minutes(a.start)-minutes(b.start));
 return {title:text(input.title,60)||'جدولي الدراسي',rows};
}

export function scheduleStats(rows){
 const courses=new Set(rows.map(r=>r.course)).size,days=new Set(rows.map(r=>r.day)).size;
 const total=rows.reduce((s,r)=>s+minutes(r.end)-minutes(r.start),0);
 return {courses,days,hours:Math.round(total/6)/10};
}

function scheduleHtml(rows){
 const s=scheduleStats(rows);
 const stat=(n,l)=>`<td align="center" style="padding:12px 6px;background:${C.cream};border-radius:12px"><div style="font-size:22px;font-weight:800;color:${C.green}">${n}</div><div style="font-size:12px;color:${C.muted}">${l}</div></td>`;
 let html=`<table role="presentation" width="100%" cellspacing="6" style="margin:6px 0 14px"><tr>${stat(s.courses,'مواد')}${stat(s.days,'أيام')}${stat(s.hours,'ساعة أسبوعيًا')}</tr></table>`;
 for(const day of DAYS){
  const list=rows.filter(r=>r.day===day);
  html+=`<div style="margin:14px 0 6px;font-size:16px;font-weight:800;color:${C.green}">${day}<span style="display:inline-block;width:28px;height:3px;background:${C.gold};border-radius:2px;margin:0 8px;vertical-align:middle"></span></div>`;
  if(!list.length){html+=`<div style="padding:10px 14px;border:1px dashed ${C.line};border-radius:12px;color:${C.muted};font-size:13px">لا توجد محاضرات</div>`;continue}
  for(const r of list){
   const details=[TYPES[r.type],r.room?'القاعة '+r.room:'',r.teacher].filter(Boolean).map(escapeHtml).join(' · ');
   html+=`<table role="presentation" width="100%" style="margin:0 0 8px;border:1px solid ${C.line};border-radius:12px;border-right:5px solid ${C.gold}"><tr><td style="padding:10px 14px"><div style="font-size:15px;font-weight:800;color:${C.text}">${escapeHtml(r.course)}</div><div style="font-size:13px;color:${C.green2};font-weight:700" dir="rtl">${formatClock(r.start)} – ${formatClock(r.end)}</div>${details?`<div style="font-size:12px;color:${C.muted}">${details}</div>`:''}</td></tr></table>`;
  }
 }
 return html;
}

function button(href,label){return `<table role="presentation" style="margin:18px 0 6px"><tr><td style="background:${C.green};border-radius:12px"><a href="${href}" style="display:inline-block;padding:13px 26px;color:#fff;text-decoration:none;font-weight:800;font-size:15px;font-family:${FONT}">${label}</a></td></tr></table>`}

function layout({preheader,heading,name,content,subscribed=false}){
 return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${C.cream};font-family:${FONT};color:${C.text}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" style="background:${C.cream}"><tr><td align="center" style="padding:26px 12px">
<table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid ${C.line}">
<tr><td style="background:${C.green};padding:22px 26px"><table role="presentation" width="100%"><tr>
<td style="font-family:${FONT}"><div style="font-size:12px;color:${C.gold};font-weight:700;letter-spacing:.3px">منصة طلاب جامعة نزوى</div><div style="font-size:26px;font-weight:900;color:#ffffff" dir="ltr">UON Hub</div></td>
<td width="52" align="left"><img src="${LOGO}" width="48" height="48" alt="UON Hub" style="display:block;border-radius:50%;border:2px solid ${C.gold}"></td>
</tr></table></td></tr>
<tr><td style="height:4px;background:${C.gold};line-height:4px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px 26px 8px;line-height:1.9;font-size:15px">
<h1 style="margin:0 0 10px;font-size:23px;color:${C.green}">${escapeHtml(heading)}</h1>
<p style="margin:0 0 12px;font-size:16px">هلا <strong>${escapeHtml(name)}</strong> 👋</p>
${content}
</td></tr>
<tr><td style="padding:8px 26px 26px"><div style="border-top:1px solid ${C.line};padding-top:16px;font-size:14px;line-height:1.9">بالتوفيق في دراستك،<br><strong style="color:${C.green}">فريق UON Hub</strong><br><span style="color:${C.muted}">كل ما يحتاجه طالب جامعة نزوى في مكان واحد</span></div></td></tr>
<tr><td style="background:${C.cream};padding:16px 26px;font-size:11px;line-height:1.8;color:${C.muted}">وصلتك هذه الرسالة لأنك طلبتها من موقع UON Hub وأكدت بريدك برمز التحقق.${subscribed?' واخترت الاشتراك في إعلانات UON Hub، وتقدر تلغيه من الرابط أعلاه.':' لن نرسل لك رسائل أخرى.'}<br>UON Hub مشروع طلابي مستقل وغير تابع رسميًا لجامعة نزوى. حقوق المحتوى لأصحابه.<br><a href="${SITE}" style="color:${C.green2}">uonhub.space</a> · <a href="https://www.instagram.com/uonhub/" style="color:${C.green2}">@uonhub</a></td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * kind: 'otp' | 'summary' | 'schedule'
 * subject: what is being sent ('summary' or 'schedule') for the OTP message.
 */
/** Exact wording shown next to the opt-in box; stored with each consent record. */
export const MARKETING_CONSENT='أوافق على وصول إعلانات وتحديثات UON Hub إلى بريدي، وأقدر ألغي الاشتراك في أي وقت.';
function unsubscribeHtml(url){return url?`<p style="margin:16px 0 0;color:${C.muted};font-size:12px">اشتركت في إعلانات UON Hub. ما تبغاها؟ <a href="${escapeHtml(url)}" style="color:${C.muted}">إلغاء الاشتراك</a></p>`:''}
export function emailTemplate({kind,name,title,otp,id,subject='summary',schedule,hasImage=false,unsubscribe=''}){
 // Backward compatible call shape: {name,title,otp} or {name,title,id}.
 if(!kind)kind=otp?'otp':'summary';
 const what=subject==='schedule'?'جدولك الدراسي':`ملف «${escapeHtml(title)}»`;
 if(kind==='otp'){
  const content=`<p style="margin:0 0 6px">رمز التحقق لإرسال ${what} إلى بريدك:</p>
<table role="presentation" style="margin:14px 0"><tr><td style="background:${C.cream};border:2px dashed ${C.gold};border-radius:16px;padding:14px 28px"><div dir="ltr" style="font-size:36px;letter-spacing:10px;font-weight:900;color:${C.green};font-family:'Courier New',monospace">${escapeHtml(otp)}</div></td></tr></table>
<p style="margin:0;color:${C.muted};font-size:13px">الرمز صالح لمدة 10 دقائق ولمرة واحدة. إذا لم تطلبه، تجاهل هذه الرسالة ولا تشاركه مع أحد.</p>`;
  return {subject:`${otp} رمز التحقق | UON Hub`,html:layout({preheader:`رمزك ${otp} صالح 10 دقائق`,heading:'رمز تأكيد بريدك',name,content}),text:`هلا ${name}\nرمز التحقق: ${otp}\nصالح 10 دقائق ولمرة واحدة. لا تشاركه.\n— فريق UON Hub`};
 }
 if(kind==='schedule'){
  const {rows,title:scheduleTitle}=schedule;
  const content=`<p style="margin:0 0 6px">هذا <strong>${escapeHtml(scheduleTitle)}</strong> كما رتبته في UON Hub.${hasImage?' أرفقنا لك نسخة صورة أيضًا، احفظها في هاتفك.':''}</p>${scheduleHtml(rows)}${button(SITE+'/schedule.html','افتح جدولك في UON Hub')}${unsubscribeHtml(unsubscribe)}`;
  const plain=DAYS.map(d=>{const l=rows.filter(r=>r.day===d);return l.length?d+'\n'+l.map(r=>`- ${r.course}: ${formatClock(r.start)} – ${formatClock(r.end)}${r.room?' · '+r.room:''}`).join('\n'):''}).filter(Boolean).join('\n\n');
  return {subject:`🗓️ ${scheduleTitle} | UON Hub`,html:layout({preheader:'جدولك الدراسي جاهز',heading:'جدولك الدراسي جاهز',name,content,subscribed:Boolean(unsubscribe)}),text:`هلا ${name}\n\n${plain}\n\n${SITE}/schedule.html${unsubscribe?'\nإلغاء الاشتراك في الإعلانات: '+unsubscribe:''}\n— فريق UON Hub`};
 }
 const href=`${SITE}/summary-viewer.html?id=${encodeURIComponent(id)}`;
 const content=`<p style="margin:0 0 6px">أرفقنا لك ملف <strong>«${escapeHtml(title)}»</strong> بصيغة PDF في هذه الرسالة. نتمنى لك مذاكرة موفقة.</p>${button(href,'افتح الملف في UON Hub')}<p style="margin:10px 0 0;color:${C.muted};font-size:13px">تجد المزيد من الملخصات والاختبارات السابقة لموادك في صفحة الملخصات على الموقع.</p>${unsubscribeHtml(unsubscribe)}`;
 return {subject:`📚 ${title} | UON Hub`,html:layout({preheader:'ملخصك مرفق في الرسالة',heading:'ملخصك جاهز للمذاكرة',name,content,subscribed:Boolean(unsubscribe)}),text:`هلا ${name}\nملف ${title} مرفق.\n${href}${unsubscribe?'\nإلغاء الاشتراك في الإعلانات: '+unsubscribe:''}\n— فريق UON Hub`};
}

/** Accept a base64 PNG made by the browser (schedule image). Returns base64 or null. */
export function cleanPng(b64,maxBytes=1572864){
 if(typeof b64!=='string'||b64.length<100||b64.length>Math.ceil(maxBytes/3)*4+4||!/^[A-Za-z0-9+/]+=*$/.test(b64))return null;
 try{const head=atob(b64.slice(0,12));return head.charCodeAt(0)===0x89&&head.slice(1,4)==='PNG'?b64:null}catch{return null}
}
