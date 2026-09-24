const STORE_KEY="uon_presidency_booking_demo_v1";
const SESSION_KEY="uon_presidency_demo_admin";
const DEMO_USER="ayman.demo";
const DEMO_PASS="uon2026";

const REASONS={
  "financial":{label:"الشؤون المالية",route:"دائرة الشؤون المالية",needsPrior:true},
  "registration":{label:"التسجيل والسجل الأكاديمي",route:"دائرة القبول والتسجيل",needsPrior:true},
  "academic":{label:"موضوع أكاديمي",route:"المرشد الأكاديمي / القسم / الكلية",needsPrior:true},
  "technical":{label:"مشكلة تقنية",route:"مركز نظم المعلومات",needsPrior:true},
  "student_service":{label:"خدمة طلابية",route:"الجهة المختصة بالخدمة",needsPrior:true},
  "proposal":{label:"مقترح تطوير",route:"مكتب الرئاسة",needsPrior:false},
  "complaint":{label:"ملاحظة أو شكوى عامة",route:"مكتب الرئاسة",needsPrior:false},
  "other":{label:"موضوع آخر",route:"مكتب الرئاسة",needsPrior:false}
};
const STATUS={
  pending:"بانتظار التأكيد",confirmed:"مؤكد",completed:"مكتمل",rejected:"مرفوض",
  no_show:"لم يحضر",cancelled:"ملغي"
};

function pad(n){return String(n).padStart(2,"0")}
function localDate(d){return [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join("-")}
function arDate(dateStr){
  const d=new Date(dateStr+"T12:00:00");
  return new Intl.DateTimeFormat("ar-OM",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(d);
}
function nowIso(){return new Date().toISOString()}
function randomRef(){return "PR-DEMO-"+Math.random().toString(36).slice(2,8).toUpperCase()}
function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(msg){
  let el=document.querySelector(".toast");
  if(!el){el=document.createElement("div");el.className="toast";document.body.appendChild(el)}
  el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200);
}
function businessDates(count=6){
  const out=[];const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+1);
  while(out.length<count){
    const day=d.getDay();
    if(day!==5&&day!==6) out.push(localDate(d));
    d.setDate(d.getDate()+1);
  }
  return out;
}
function baseState(){
  const dates=businessDates(7);
  return{
    settings:{officeName:"مكتب رئاسة الجامعة",slots:["09:00","09:30","10:00","10:30","11:00","11:30","12:00"],disabledSlots:[]},
    appointments:[
      {id:crypto.randomUUID(),ref:"PR-DEMO-A1B2C3",studentName:"طالب تجريبي 1",studentId:"20260001",college:"كلية الاقتصاد والإدارة ونظم المعلومات",phone:"96890000001",reason:"academic",notes:"مثال تجريبي لموعد تمت مراجعته.",date:dates[0],time:"09:30",status:"confirmed",urgent:false,priorReviewed:true,createdAt:nowIso(),demo:true},
      {id:crypto.randomUUID(),ref:"PR-DEMO-D4E5F6",studentName:"طالبة تجريبية 2",studentId:"20260002",college:"كلية العلوم والآداب",phone:"96890000002",reason:"proposal",notes:"مقترح تجريبي لتحسين تجربة الطلبة.",date:dates[0],time:"10:30",status:"pending",urgent:false,priorReviewed:false,createdAt:nowIso(),demo:true},
      {id:crypto.randomUUID(),ref:"PR-DEMO-G7H8J9",studentName:"طالب تجريبي 3",studentId:"20260003",college:"كلية الهندسة والعمارة",phone:"96890000003",reason:"complaint",notes:"حالة تجريبية عاجلة لشرح شكل التنبيه.",date:dates[1],time:"11:00",status:"pending",urgent:true,priorReviewed:false,createdAt:nowIso(),demo:true}
    ]
  }
}
function loadState(){
  try{const v=JSON.parse(localStorage.getItem(STORE_KEY)||"null");if(v&&v.appointments&&v.settings)return v}catch{}
  const s=baseState();saveState(s);return s;
}
function saveState(s){localStorage.setItem(STORE_KEY,JSON.stringify(s))}
function resetState(){localStorage.removeItem(STORE_KEY);saveState(baseState())}
function statusBadge(s){return '<span class="status '+escapeHtml(s)+'">'+escapeHtml(STATUS[s]||s)+'</span>'}
function bookedSet(state){return new Set(state.appointments.filter(a=>!["rejected","cancelled"].includes(a.status)).map(a=>a.date+"|"+a.time))}
function getReason(key){return REASONS[key]||REASONS.other}

function initStudent(){
  let state=loadState(),selectedDate="",selectedTime="";
  const form=document.querySelector("#bookingForm");
  const reason=document.querySelector("#reason");
  const routeBox=document.querySelector("#routeBox");
  const priorWrap=document.querySelector("#priorWrap");
  const prior=document.querySelector("#priorReviewed");
  const slotsEl=document.querySelector("#slots");
  const summary=document.querySelector("#bookingSummary");
  const demoFill=document.querySelector("#fillDemoStudent");
  const trackForm=document.querySelector("#trackForm");
  const trackResult=document.querySelector("#trackResult");

  function renderRoute(){
    const r=getReason(reason.value);
    if(!reason.value){routeBox.classList.remove("show");priorWrap.hidden=true;return}
    routeBox.innerHTML=r.needsPrior
      ? '<strong>توجيه ذكي قبل الحجز</strong><p>هذا النوع من الطلبات يُفضّل أن يبدأ لدى <b>'+escapeHtml(r.route)+'</b>. إذا راجعت الجهة ولم تُحل المشكلة، فعّل الخيار أدناه لإكمال الحجز.</p>'
      : '<strong>المسار المقترح</strong><p>يمكن إرسال هذا الطلب مباشرة إلى <b>'+escapeHtml(r.route)+'</b>.</p>';
    routeBox.classList.add("show");priorWrap.hidden=!r.needsPrior;
  }
  function renderSlots(){
    state=loadState();const booked=bookedSet(state);const dates=businessDates(7);
    slotsEl.innerHTML=dates.map(date=>{
      const buttons=state.settings.slots.map(time=>{
        const key=date+"|"+time;const disabled=booked.has(key)||state.settings.disabledSlots.includes(time);
        const selected=selectedDate===date&&selectedTime===time;
        return '<button type="button" class="slot '+(disabled?'busy ':'')+(selected?'selected':'')+'" data-date="'+date+'" data-time="'+time+'" '+(disabled?'disabled':'')+'>'+time+'</button>'
      }).join("");
      return '<div class="slot-day"><div class="slot-day-head"><strong>'+arDate(date)+'</strong><span class="status confirmed">متاح للحجز</span></div><div class="slots">'+buttons+'</div></div>'
    }).join("");
    slotsEl.querySelectorAll(".slot:not(:disabled)").forEach(btn=>btn.addEventListener("click",()=>{
      selectedDate=btn.dataset.date;selectedTime=btn.dataset.time;renderSlots();
    }));
  }
  reason?.addEventListener("change",renderRoute);
  demoFill?.addEventListener("click",()=>{
    form.studentName.value="طالب تجريبي";
    form.studentId.value="20261234";
    form.college.value="كلية الاقتصاد والإدارة ونظم المعلومات";
    form.phone.value="96890000000";
    form.reason.value="proposal";
    form.notes.value="هذا طلب تجريبي لتجربة نظام حجز مواعيد مكتب الرئاسة.";
    renderRoute();toast("تم تعبئة بيانات تجريبية");
  });
  form?.addEventListener("submit",e=>{
    e.preventDefault();
    const fd=new FormData(form);const r=getReason(fd.get("reason"));
    if(r.needsPrior&&!prior.checked){toast("راجع الجهة المختصة أولًا أو أكد أنك راجعتها");prior.focus();return}
    if(!selectedDate||!selectedTime){toast("اختر موعدًا متاحًا");slotsEl.scrollIntoView({behavior:"smooth",block:"center"});return}
    state=loadState();if(bookedSet(state).has(selectedDate+"|"+selectedTime)){toast("هذا الموعد حُجز للتو، اختر موعدًا آخر");renderSlots();return}
    const item={
      id:crypto.randomUUID(),ref:randomRef(),studentName:fd.get("studentName").trim(),studentId:fd.get("studentId").trim(),
      college:fd.get("college"),phone:fd.get("phone").trim(),reason:fd.get("reason"),notes:fd.get("notes").trim(),
      date:selectedDate,time:selectedTime,status:"pending",urgent:fd.get("urgent")==="on",priorReviewed:prior.checked,
      attachmentName:form.attachment?.files?.[0]?.name||"",createdAt:nowIso(),demo:true
    };
    state.appointments.push(item);saveState(state);
    summary.innerHTML='<div class="between row"><div><div class="eyebrow">تم إنشاء طلب تجريبي</div><h3 style="margin-top:10px">رقم الحجز</h3><div class="summary-code">'+item.ref+'</div></div>'+statusBadge(item.status)+'</div>'+
      '<div class="kv"><span>الموعد</span><b>'+arDate(item.date)+' — '+item.time+'</b><span>السبب</span><b>'+escapeHtml(getReason(item.reason).label)+'</b><span>الطالب</span><b>'+escapeHtml(item.studentName)+'</b></div>'+
      '<div class="row" style="margin-top:14px"><button class="btn small" type="button" id="copyRef">نسخ رقم الحجز</button><button class="btn small ghost" type="button" id="newBooking">حجز آخر</button></div>';
    summary.classList.add("show");
    summary.querySelector("#copyRef").onclick=async()=>{await navigator.clipboard?.writeText(item.ref);toast("تم نسخ رقم الحجز")};
    summary.querySelector("#newBooking").onclick=()=>{summary.classList.remove("show");form.reset();selectedDate="";selectedTime="";renderRoute();renderSlots();window.scrollTo({top:0,behavior:"smooth"})};
    form.reset();selectedDate="";selectedTime="";renderRoute();renderSlots();
  });
  trackForm?.addEventListener("submit",e=>{
    e.preventDefault();state=loadState();
    const ref=trackForm.trackRef.value.trim().toUpperCase(),sid=trackForm.trackStudentId.value.trim();
    const a=state.appointments.find(x=>x.ref.toUpperCase()===ref&&x.studentId===sid);
    trackResult.innerHTML=a?appointmentCard(a,true):'<div class="empty">لم نجد حجزًا مطابقًا للبيانات التجريبية المدخلة.</div>';
    const cancel=trackResult.querySelector("[data-cancel]");
    if(cancel)cancel.onclick=()=>{a.status="cancelled";saveState(state);trackResult.innerHTML=appointmentCard(a,true);toast("تم إلغاء الموعد التجريبي");renderSlots()};
  });
  renderRoute();renderSlots();
}
function appointmentCard(a,allowCancel=false){
  return '<div class="appointment-card"><div class="between row"><strong>'+escapeHtml(a.ref)+'</strong>'+statusBadge(a.status)+'</div>'+
    '<div><b>'+arDate(a.date)+' — '+escapeHtml(a.time)+'</b></div><div style="color:var(--muted)">'+escapeHtml(getReason(a.reason).label)+' · '+escapeHtml(a.college)+'</div>'+
    (a.notes?'<div>'+escapeHtml(a.notes)+'</div>':'')+
    (allowCancel&&["pending","confirmed"].includes(a.status)?'<div><button type="button" class="btn small danger" data-cancel>إلغاء الموعد</button></div>':'')+'</div>';
}

function initAdmin(){
  let state=loadState(),activeFilter="all";
  const login=document.querySelector("#adminLogin");
  const app=document.querySelector("#adminApp");
  const loginForm=document.querySelector("#adminLoginForm");
  function authenticated(){return sessionStorage.getItem(SESSION_KEY)==="1"}
  function showApp(){
    login.hidden=true;app.hidden=false;renderAdmin();
  }
  function showLogin(){login.hidden=false;app.hidden=true}
  if(authenticated())showApp();else showLogin();
  loginForm?.addEventListener("submit",e=>{
    e.preventDefault();
    if(loginForm.username.value.trim()===DEMO_USER&&loginForm.password.value===DEMO_PASS){
      sessionStorage.setItem(SESSION_KEY,"1");showApp();toast("تم دخول حساب Demo");
    }else toast("بيانات حساب Demo غير صحيحة");
  });
  document.querySelector("#demoAutoLogin")?.addEventListener("click",()=>{loginForm.username.value=DEMO_USER;loginForm.password.value=DEMO_PASS;loginForm.requestSubmit()});
  document.querySelector("#logoutAdmin")?.addEventListener("click",()=>{sessionStorage.removeItem(SESSION_KEY);showLogin()});
  document.querySelector("#resetDemo")?.addEventListener("click",()=>{if(confirm("إعادة كل بيانات الحجز التجريبية للوضع الافتراضي؟")){resetState();renderAdmin();toast("تمت إعادة بيانات Demo")}});
  document.querySelector("#exportCsv")?.addEventListener("click",exportCsv);
  document.querySelector("#menuBtn")?.addEventListener("click",()=>document.querySelector("#sidebar").classList.toggle("open"));
  document.querySelectorAll("[data-section]").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll("[data-section]").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
    document.querySelectorAll(".section").forEach(x=>x.classList.remove("active"));document.querySelector("#sec-"+btn.dataset.section).classList.add("active");
    document.querySelector("#sidebar").classList.remove("open");
  }));
  document.querySelector("#statusFilter")?.addEventListener("change",e=>{activeFilter=e.target.value;renderAppointments()});
  document.querySelector("#adminSearch")?.addEventListener("input",renderAppointments);
  document.querySelector("#walkinForm")?.addEventListener("submit",e=>{
    e.preventDefault();state=loadState();const f=e.currentTarget,fd=new FormData(f);
    const d=new Date();let date=localDate(d);let time=pad(d.getHours())+":"+pad(Math.floor(d.getMinutes()/5)*5);
    state.appointments.push({id:crypto.randomUUID(),ref:randomRef(),studentName:fd.get("studentName").trim(),studentId:fd.get("studentId").trim(),
      college:fd.get("college"),phone:"",reason:fd.get("reason"),notes:"استقبال بدون موعد — Demo",date,time,status:"confirmed",urgent:fd.get("urgent")==="on",
      priorReviewed:true,createdAt:nowIso(),demo:true,walkin:true});
    saveState(state);f.reset();renderAdmin();toast("تمت إضافة استقبال مباشر تجريبي");
  });
  function renderAdmin(){
    state=loadState();renderStats();renderAppointments();renderCategories();renderSlotSettings();renderUpcoming();
  }
  function renderStats(){
    const upcoming=state.appointments.filter(a=>!["completed","rejected","cancelled","no_show"].includes(a.status));
    const pending=state.appointments.filter(a=>a.status==="pending").length;
    const confirmed=state.appointments.filter(a=>a.status==="confirmed").length;
    const urgent=upcoming.filter(a=>a.urgent).length;
    document.querySelector("#stats").innerHTML=[
      ["المواعيد القادمة",upcoming.length],["بانتظار التأكيد",pending],["مؤكدة",confirmed],["حالات عاجلة",urgent]
    ].map(([t,v])=>'<div class="card stat"><strong>'+v+'</strong><span>'+t+'</span></div>').join("");
  }
  function renderAppointments(){
    state=loadState();const q=(document.querySelector("#adminSearch")?.value||"").trim().toLowerCase();
    const list=state.appointments.filter(a=>(activeFilter==="all"||a.status===activeFilter)&&(!q||[a.studentName,a.studentId,a.ref,a.college,getReason(a.reason).label].join(" ").toLowerCase().includes(q)))
      .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    const box=document.querySelector("#appointmentsList");
    box.innerHTML=list.length?list.map(a=>'<div class="admin-appt" data-id="'+a.id+'"><div class="between row"><div><strong>'+escapeHtml(a.studentName)+'</strong> <span style="color:var(--muted)">('+escapeHtml(a.studentId)+')</span></div>'+
      statusBadge(a.status)+'</div><div class="meta">'+escapeHtml(a.ref)+' · '+arDate(a.date)+' · '+escapeHtml(a.time)+'<br>'+escapeHtml(a.college)+' · '+escapeHtml(getReason(a.reason).label)+
      (a.urgent?' · <b style="color:#ffd3d3">عاجل</b>':'')+(a.walkin?' · استقبال مباشر':'')+'</div>'+
      (a.notes?'<p>'+escapeHtml(a.notes)+'</p>':'')+'<div class="actions">'+
      (a.status==="pending"?'<button class="btn small primary" data-act="confirm">تأكيد</button><button class="btn small danger" data-act="reject">رفض</button>':'')+
      (a.status==="confirmed"?'<button class="btn small primary" data-act="complete">تمت المقابلة</button><button class="btn small danger" data-act="no_show">لم يحضر</button>':'')+
      '<button class="btn small ghost" data-act="copy">نسخ الرقم</button></div></div>').join(""):'<div class="empty">لا توجد حجوزات مطابقة.</div>';
    box.querySelectorAll("[data-act]").forEach(btn=>btn.addEventListener("click",()=>{
      const id=btn.closest("[data-id]").dataset.id;const a=state.appointments.find(x=>x.id===id);if(!a)return;
      const act=btn.dataset.act;if(act==="copy"){navigator.clipboard?.writeText(a.ref);toast("تم نسخ الرقم");return}
      const map={confirm:"confirmed",reject:"rejected",complete:"completed",no_show:"no_show"};a.status=map[act]||a.status;saveState(state);renderAdmin();toast("تم تحديث حالة الموعد");
    }));
  }
  function renderCategories(){
    const counts={};state.appointments.forEach(a=>counts[a.reason]=(counts[a.reason]||0)+1);
    const max=Math.max(1,...Object.values(counts));
    document.querySelector("#categoryStats").innerHTML=Object.entries(REASONS).map(([k,r])=>{
      const c=counts[k]||0;return '<div class="category-row"><div class="between row"><span>'+escapeHtml(r.label)+'</span><b>'+c+'</b></div><div class="bar"><span style="width:'+((c/max)*100)+'%"></span></div></div>'
    }).join("");
  }
  function renderSlotSettings(){
    const box=document.querySelector("#slotSettings");
    box.innerHTML=state.settings.slots.map(t=>'<button class="btn small '+(!state.settings.disabledSlots.includes(t)?'on':'')+'" data-time="'+t+'">'+t+'</button>').join("");
    box.querySelectorAll("[data-time]").forEach(b=>b.onclick=()=>{
      state=loadState();const t=b.dataset.time,arr=state.settings.disabledSlots;const i=arr.indexOf(t);if(i>=0)arr.splice(i,1);else arr.push(t);
      saveState(state);renderSlotSettings();toast("تم تحديث توفر الفترة التجريبية");
    });
  }
  function renderUpcoming(){
    const list=state.appointments.filter(a=>["pending","confirmed"].includes(a.status)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,5);
    document.querySelector("#upcomingList").innerHTML=list.length?list.map(a=>appointmentCard(a,false)).join(""):'<div class="empty">لا توجد مواعيد قادمة.</div>';
  }
  function exportCsv(){
    state=loadState();const rows=[["reference","student_name","student_id","college","reason","date","time","status","urgent"]];
    state.appointments.forEach(a=>rows.push([a.ref,a.studentName,a.studentId,a.college,getReason(a.reason).label,a.date,a.time,STATUS[a.status]||a.status,a.urgent?"yes":"no"]));
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="presidency-booking-demo.csv";a.click();URL.revokeObjectURL(url);toast("تم تصدير بيانات Demo");
  }
}
const page=document.body.dataset.demoPage;
if(page==="student")initStudent();
if(page==="admin")initAdmin();
