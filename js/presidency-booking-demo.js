const STORE_KEY="uon_presidency_booking_demo_v2";
const SESSION_KEY="uon_presidency_demo_admin";
const DEMO_USER="ayman.demo";
const DEMO_PASS="uon2026";

const REASONS={
  financial:{label:"الشؤون المالية",route:"دائرة الشؤون المالية",needsPrior:true},
  registration:{label:"التسجيل والسجل الأكاديمي",route:"دائرة القبول والتسجيل",needsPrior:true},
  academic:{label:"موضوع أكاديمي",route:"المرشد الأكاديمي / القسم / الكلية",needsPrior:true},
  technical:{label:"مشكلة تقنية",route:"مركز نظم المعلومات",needsPrior:true},
  student_service:{label:"خدمة طلابية",route:"الجهة المختصة بالخدمة",needsPrior:true},
  proposal:{label:"مقترح تطوير",route:"مكتب رئاسة الجامعة",needsPrior:false},
  complaint:{label:"ملاحظة أو شكوى عامة",route:"مكتب رئاسة الجامعة",needsPrior:false},
  other:{label:"موضوع آخر",route:"مكتب رئاسة الجامعة",needsPrior:false}
};
const STATUS={
  pending:"بانتظار التأكيد",
  confirmed:"مؤكد",
  called:"تم الاستدعاء",
  transferred:"محوّل لجهة مختصة",
  completed:"مكتمل",
  rejected:"مرفوض",
  no_show:"لم يحضر",
  cancelled:"ملغي"
};

function $(s,root=document){return root.querySelector(s)}
function $$(s,root=document){return [...root.querySelectorAll(s)]}
function pad(n){return String(n).padStart(2,"0")}
function localDate(d){return [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join("-")}
function nowIso(){return new Date().toISOString()}
function safeId(){return globalThis.crypto?.randomUUID?.()||("id-"+Date.now()+"-"+Math.random().toString(36).slice(2,9))}
function arDate(dateStr){
  const d=new Date(dateStr+"T12:00:00");
  return new Intl.DateTimeFormat("ar-OM",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(d);
}
function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function getReason(k){return REASONS[k]||REASONS.other}
function isBlockingStatus(s){return !["rejected","cancelled"].includes(s)}
function appointmentStamp(a){return new Date(a.date+"T"+a.time+":00").getTime()}
function isFutureAppointment(a){return isBlockingStatus(a.status)&&appointmentStamp(a)>=Date.now()-30*60*1000}
function uniqueRef(state){
  let ref;
  do{ref="PR-DEMO-"+Math.random().toString(36).slice(2,8).toUpperCase()}while(state.appointments.some(a=>a.ref===ref));
  return ref;
}
function toast(msg){
  let el=$(".toast");
  if(!el){el=document.createElement("div");el.className="toast";document.body.appendChild(el)}
  el.textContent=msg;el.classList.add("show");
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),2300);
}
async function copyText(text){
  try{await navigator.clipboard.writeText(text);toast("تم النسخ")}catch{
    const t=document.createElement("textarea");t.value=text;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();
    document.execCommand("copy");t.remove();toast("تم النسخ");
  }
}
function businessDates(count=6,includeToday=false){
  const out=[],d=new Date();d.setHours(12,0,0,0);if(!includeToday)d.setDate(d.getDate()+1);
  while(out.length<count){
    if([0,1,2,3,4].includes(d.getDay()))out.push(localDate(d));
    d.setDate(d.getDate()+1);
  }
  return out;
}
function seedDate(offset=0){
  const d=new Date();d.setHours(12,0,0,0);
  while(![0,1,2,3,4].includes(d.getDay()))d.setDate(d.getDate()+1);
  if(offset){
    let n=0;
    while(n<offset){d.setDate(d.getDate()+1);if([0,1,2,3,4].includes(d.getDay()))n++}
  }
  return localDate(d);
}
function baseState(){
  const today=seedDate(0),next=seedDate(1);
  return{
    settings:{
      officeName:"مكتب رئاسة الجامعة",
      workingDays:[0,1,2,3,4],
      slots:["09:00","09:30","10:00","10:30","11:00","11:30","12:00"],
      disabledSlots:[],
      slotMinutes:30,
      maxActivePerStudent:2
    },
    queue:{calledId:null,calledAt:null},
    appointments:[
      {id:safeId(),ref:"PR-DEMO-A1B2C3",studentName:"طالب تجريبي 1",studentId:"20260001",college:"كلية الاقتصاد والإدارة ونظم المعلومات",phone:"96890000001",reason:"academic",notes:"مثال تجريبي لموعد تمت مراجعته.",date:today,time:"09:30",status:"confirmed",urgent:false,priorReviewed:true,createdAt:nowIso(),demo:true},
      {id:safeId(),ref:"PR-DEMO-D4E5F6",studentName:"طالبة تجريبية 2",studentId:"20260002",college:"كلية العلوم والآداب",phone:"96890000002",reason:"proposal",notes:"مقترح تجريبي لتحسين تجربة الطلبة.",date:today,time:"10:30",status:"pending",urgent:false,priorReviewed:false,createdAt:nowIso(),demo:true},
      {id:safeId(),ref:"PR-DEMO-G7H8J9",studentName:"طالب تجريبي 3",studentId:"20260003",college:"كلية الهندسة والعمارة",phone:"96890000003",reason:"complaint",notes:"حالة تجريبية عاجلة لشرح شكل التنبيه.",date:next,time:"11:00",status:"pending",urgent:true,priorReviewed:false,createdAt:nowIso(),demo:true}
    ]
  };
}
function loadState(){
  try{
    const v=JSON.parse(localStorage.getItem(STORE_KEY)||"null");
    if(v?.appointments&&v?.settings){
      v.queue ||= {calledId:null,calledAt:null};
      v.settings.disabledSlots ||= [];
      return v;
    }
  }catch{}
  const s=baseState();saveState(s);return s;
}
function saveState(s){localStorage.setItem(STORE_KEY,JSON.stringify(s))}
function resetState(){localStorage.removeItem(STORE_KEY);const s=baseState();saveState(s);return s}
function bookedSet(state){
  return new Set(state.appointments.filter(a=>isBlockingStatus(a.status)).map(a=>a.date+"|"+a.time));
}
function statusBadge(s){return '<span class="status '+escapeHtml(s)+'">'+escapeHtml(STATUS[s]||s)+'</span>'}
function appointmentCard(a,opts={}){
  const {allowCancel=false,showStudent=false,showActions=false}=opts;
  return '<article class="appointment-card" data-id="'+escapeHtml(a.id)+'">'+
    '<div class="between row"><strong class="ref-code">'+escapeHtml(a.ref)+'</strong>'+statusBadge(a.status)+'</div>'+
    (showStudent?'<div class="student-line"><b>'+escapeHtml(a.studentName)+'</b><span>'+escapeHtml(a.studentId)+'</span></div>':'')+
    '<div><b>'+arDate(a.date)+' — '+escapeHtml(a.time)+'</b></div>'+
    '<div class="muted">'+escapeHtml(getReason(a.reason).label)+' · '+escapeHtml(a.college)+'</div>'+
    (a.urgent?'<div class="urgent-note">⚠️ الطالب صنّف الطلب كحالة عاجلة ويحتاج مراجعة المكتب.</div>':'')+
    (a.transferredTo?'<div class="route-box show"><strong>تم تحويل الطلب</strong><p style="margin:6px 0 0">الجهة: <b>'+escapeHtml(a.transferredTo)+'</b></p></div>':'')+
    (a.notes?'<div class="note-text">'+escapeHtml(a.notes)+'</div>':'')+
    (a.attachmentName?'<div class="file-chip">📎 '+escapeHtml(a.attachmentName)+' <small>(اسم ملف Demo فقط)</small></div>':'')+
    (allowCancel&&["pending","confirmed"].includes(a.status)?'<div><button type="button" class="btn small danger" data-cancel>إلغاء الموعد</button></div>':'')+
    (showActions?'<div class="actions">'+adminActions(a)+'</div>':'')+
    '</article>';
}
function adminActions(a){
  let out="";
  if(a.status==="pending"){
    out+='<button class="btn small primary" data-act="confirm">تأكيد</button>';
    out+='<button class="btn small" data-act="transfer">تحويل لجهة</button>';
    out+='<button class="btn small danger" data-act="cancel">إلغاء</button>';
    out+='<button class="btn small ghost" data-act="reject">رفض</button>';
  }
  if(a.status==="confirmed"){
    out+='<button class="btn small primary" data-act="call">استدعاء</button>';
    out+='<button class="btn small" data-act="transfer">تحويل لجهة</button>';
    out+='<button class="btn small danger" data-act="cancel">إلغاء</button>';
    out+='<button class="btn small ghost" data-act="no_show">لم يحضر</button>';
  }
  if(a.status==="called"){
    out+='<button class="btn small primary" data-act="complete">تمت المقابلة</button>';
    out+='<button class="btn small" data-act="transfer">تحويل لجهة</button>';
    out+='<button class="btn small danger" data-act="cancel">إلغاء</button>';
    out+='<button class="btn small ghost" data-act="no_show">لم يحضر</button>';
  }
  out+='<button class="btn small ghost" data-act="copy">نسخ الرقم</button>';
  return out;
}

function initStudent(){
  let state=loadState(),selectedDate="",selectedTime="";
  const form=$("#bookingForm"),reason=$("#reason"),routeBox=$("#routeBox"),priorWrap=$("#priorWrap"),prior=$("#priorReviewed");
  const slotsEl=$("#slots"),summary=$("#bookingSummary"),demoFill=$("#fillDemoStudent"),trackForm=$("#trackForm"),trackResult=$("#trackResult");
  const formEl=name=>form?.elements?.namedItem(name);

  function renderRoute(){
    if(!reason?.value){routeBox?.classList.remove("show");if(priorWrap)priorWrap.hidden=true;if(prior)prior.checked=false;return}
    const r=getReason(reason.value);
    routeBox.innerHTML=r.needsPrior
      ? '<strong>توجيه قبل الحجز</strong><p>يفضّل أن يبدأ هذا الطلب لدى <b>'+escapeHtml(r.route)+'</b>. إذا راجعت الجهة ولم تُحل المشكلة، أكد ذلك لإكمال الحجز مع مكتب الرئاسة.</p>'
      : '<strong>المسار المقترح</strong><p>يمكن رفع هذا الطلب مباشرة إلى <b>'+escapeHtml(r.route)+'</b>.</p>';
    routeBox.classList.add("show");priorWrap.hidden=!r.needsPrior;if(!r.needsPrior)prior.checked=false;
  }
  function renderSlots(){
    state=loadState();
    const booked=bookedSet(state),dates=businessDates(7);
    slotsEl.innerHTML=dates.map(date=>{
      let available=0;
      const buttons=state.settings.slots.map(time=>{
        const disabled=booked.has(date+"|"+time)||state.settings.disabledSlots.includes(time);
        if(!disabled)available++;
        const selected=selectedDate===date&&selectedTime===time;
        return '<button type="button" class="slot '+(disabled?'busy ':'')+(selected?'selected':'')+'" data-date="'+date+'" data-time="'+time+'" '+(disabled?'disabled':'')+'>'+time+'</button>';
      }).join("");
      const badge=available?'<span class="status confirmed">'+available+' متاح</span>':'<span class="status rejected">ممتلئ</span>';
      return '<div class="slot-day"><div class="slot-day-head"><strong>'+arDate(date)+'</strong>'+badge+'</div><div class="slots">'+buttons+'</div></div>';
    }).join("");
    $$(".slot:not(:disabled)",slotsEl).forEach(btn=>btn.addEventListener("click",()=>{
      selectedDate=btn.dataset.date;selectedTime=btn.dataset.time;renderSlots();
      $("#selectedSlotText").textContent=arDate(selectedDate)+" — "+selectedTime;
      $("#selectedSlotBox").hidden=false;
    }));
  }
  reason?.addEventListener("change",renderRoute);
  demoFill?.addEventListener("click",()=>{
    formEl("studentName").value="طالب تجريبي";
    formEl("studentId").value="20261234";
    formEl("college").value="كلية الاقتصاد والإدارة ونظم المعلومات";
    formEl("phone").value="96890000000";
    formEl("reason").value="proposal";
    formEl("notes").value="هذا طلب تجريبي لتجربة نظام حجز مواعيد مكتب رئاسة الجامعة.";
    renderRoute();toast("تمت تعبئة بيانات تجريبية");
  });
  form?.addEventListener("submit",e=>{
    e.preventDefault();
    const fd=new FormData(form),studentId=String(fd.get("studentId")||"").trim(),phone=String(fd.get("phone")||"").replace(/\s+/g,"");
    if(!/^\d{6,12}$/.test(studentId)){toast("تأكد من الرقم الجامعي التجريبي");formEl("studentId").focus();return}
    if(!/^\d{8,12}$/.test(phone)){toast("تأكد من رقم الهاتف التجريبي");formEl("phone").focus();return}
    const r=getReason(fd.get("reason"));
    if(r.needsPrior&&!prior.checked){toast("أكد أنك راجعت الجهة المختصة أولًا");prior.focus();return}
    if(!selectedDate||!selectedTime){toast("اختر موعدًا متاحًا");slotsEl.scrollIntoView({behavior:"smooth",block:"center"});return}
    state=loadState();
    if(bookedSet(state).has(selectedDate+"|"+selectedTime)){toast("هذا الموعد حُجز بالفعل، اختر موعدًا آخر");renderSlots();return}
    const activeCount=state.appointments.filter(a=>a.studentId===studentId&&isFutureAppointment(a)&&["pending","confirmed","called"].includes(a.status)).length;
    if(activeCount>=state.settings.maxActivePerStudent){toast("للتجربة: يوجد لهذا الرقم الحد الأقصى من المواعيد النشطة");return}
    const item={
      id:safeId(),ref:uniqueRef(state),studentName:String(fd.get("studentName")||"").trim(),studentId,
      college:String(fd.get("college")||""),phone,reason:String(fd.get("reason")||"other"),notes:String(fd.get("notes")||"").trim(),
      date:selectedDate,time:selectedTime,status:"pending",urgent:fd.get("urgent")==="on",priorReviewed:prior.checked,
      attachmentName:formEl("attachment")?.files?.[0]?.name||"",createdAt:nowIso(),demo:true
    };
    state.appointments.push(item);saveState(state);
    summary.innerHTML='<div class="between row"><div><div class="eyebrow">تم إرسال طلب الحجز</div><h3 class="success-title">رقم الحجز</h3><div class="summary-code">'+escapeHtml(item.ref)+'</div></div>'+statusBadge(item.status)+'</div>'+
      '<div class="kv"><span>الموعد</span><b>'+arDate(item.date)+' — '+escapeHtml(item.time)+'</b><span>السبب</span><b>'+escapeHtml(getReason(item.reason).label)+'</b><span>الطالب</span><b>'+escapeHtml(item.studentName)+'</b></div>'+
      '<div class="demo-notice" style="margin-top:14px">احتفظ برقم الحجز مع رقمك الجامعي لمتابعة الطلب. هذا حجز Demo فقط وليس موعدًا رسميًا.</div>'+
      '<div class="row" style="margin-top:14px"><button class="btn small" type="button" id="copyRef">نسخ رقم الحجز</button><button class="btn small ghost" type="button" id="trackNew">متابعة الحجز</button><button class="btn small ghost" type="button" id="newBooking">حجز آخر</button></div>';
    summary.classList.add("show");
    $("#copyRef",summary).onclick=()=>copyText(item.ref);
    $("#trackNew",summary).onclick=()=>{
      trackForm.elements.namedItem("trackRef").value=item.ref;
      trackForm.elements.namedItem("trackStudentId").value=item.studentId;
      $("#track").scrollIntoView({behavior:"smooth"});trackForm.requestSubmit();
    };
    $("#newBooking",summary).onclick=()=>{summary.classList.remove("show");window.scrollTo({top:0,behavior:"smooth"})};
    form.reset();selectedDate="";selectedTime="";$("#selectedSlotBox").hidden=true;renderRoute();renderSlots();
  });
  trackForm?.addEventListener("submit",e=>{
    e.preventDefault();state=loadState();
    const ref=String(trackForm.elements.namedItem("trackRef").value||"").trim().toUpperCase();
    const sid=String(trackForm.elements.namedItem("trackStudentId").value||"").trim();
    const a=state.appointments.find(x=>x.ref.toUpperCase()===ref&&x.studentId===sid);
    trackResult.innerHTML=a?appointmentCard(a,{allowCancel:true}):'<div class="empty">لم نجد حجزًا مطابقًا. تأكد من رقم الحجز والرقم الجامعي.</div>';
    const cancel=$("[data-cancel]",trackResult);
    if(cancel)cancel.onclick=()=>{
      if(!confirm("إلغاء الموعد التجريبي؟"))return;
      a.status="cancelled";
      if(state.queue?.calledId===a.id)state.queue={calledId:null,calledAt:null};
      saveState(state);trackResult.innerHTML=appointmentCard(a);toast("تم إلغاء الموعد التجريبي");renderSlots();
    };
  });
  window.addEventListener("storage",renderSlots);
  renderRoute();renderSlots();
}

function initAdmin(){
  let state=loadState(),activeFilter="all";
  const login=$("#adminLogin"),app=$("#adminApp"),loginForm=$("#adminLoginForm");
  const auth=()=>sessionStorage.getItem(SESSION_KEY)==="1";
  function showApp(){login.hidden=true;app.hidden=false;renderAdmin()}
  function showLogin(){login.hidden=false;app.hidden=true}
  if(auth())showApp();else showLogin();

  loginForm?.addEventListener("submit",e=>{
    e.preventDefault();
    const u=String(loginForm.elements.namedItem("username").value||"").trim();
    const p=String(loginForm.elements.namedItem("password").value||"");
    if(u===DEMO_USER&&p===DEMO_PASS){sessionStorage.setItem(SESSION_KEY,"1");showApp();toast("تم دخول حساب Demo")}
    else toast("بيانات حساب Demo غير صحيحة");
  });
  $("#demoAutoLogin")?.addEventListener("click",()=>{
    loginForm.elements.namedItem("username").value=DEMO_USER;
    loginForm.elements.namedItem("password").value=DEMO_PASS;
    loginForm.requestSubmit();
  });
  $("#logoutAdmin")?.addEventListener("click",()=>{sessionStorage.removeItem(SESSION_KEY);showLogin()});
  $("#resetDemo")?.addEventListener("click",()=>{if(confirm("إعادة كل بيانات Demo للوضع الافتراضي؟")){state=resetState();renderAdmin();toast("تمت إعادة بيانات Demo")}});
  $("#exportCsv")?.addEventListener("click",exportCsv);
  $("#menuBtn")?.addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#sidebarClose")?.addEventListener("click",()=>$("#sidebar").classList.remove("open"));
  $$("[data-section]").forEach(btn=>btn.addEventListener("click",()=>{
    $$("[data-section]").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
    $$(".section").forEach(x=>x.classList.remove("active"));$("#sec-"+btn.dataset.section)?.classList.add("active");
    $("#sidebar").classList.remove("open");
  }));
  $("#statusFilter")?.addEventListener("change",e=>{activeFilter=e.target.value;renderAppointments()});
  $("#adminSearch")?.addEventListener("input",renderAppointments);
  $("#callNext")?.addEventListener("click",callNext);
  $("#queueCompleteCurrent")?.addEventListener("click",completeCurrent);

  $("#walkinForm")?.addEventListener("submit",e=>{
    e.preventDefault();state=loadState();const f=e.currentTarget,fd=new FormData(f),d=new Date();
    const date=localDate(d),time=pad(d.getHours())+":"+pad(Math.floor(d.getMinutes()/5)*5);
    state.appointments.push({
      id:safeId(),ref:uniqueRef(state),studentName:String(fd.get("studentName")||"").trim(),studentId:String(fd.get("studentId")||"").trim(),
      college:String(fd.get("college")||""),phone:"",reason:String(fd.get("reason")||"other"),notes:"استقبال مباشر — Demo",
      date,time,status:"confirmed",urgent:fd.get("urgent")==="on",priorReviewed:true,createdAt:nowIso(),demo:true,walkin:true
    });
    saveState(state);f.reset();renderAdmin();toast("تمت إضافة استقبال مباشر");
  });

  function renderAdmin(){
    state=loadState();renderStats();renderAppointments();renderCategories();renderSlotSettings();renderUpcoming();renderQueue();
  }
  function renderStats(){
    const upcoming=state.appointments.filter(a=>isFutureAppointment(a)&&["pending","confirmed","called"].includes(a.status));
    const today=localDate(new Date());
    const todayCount=state.appointments.filter(a=>a.date===today&&["pending","confirmed","called","completed"].includes(a.status)).length;
    const pending=state.appointments.filter(a=>a.status==="pending"&&isFutureAppointment(a)).length;
    const urgent=upcoming.filter(a=>a.urgent).length;
    $("#stats").innerHTML=[
      ["مواعيد اليوم",todayCount],["بانتظار التأكيد",pending],["قادمة",upcoming.length],["تحتاج مراجعة عاجلة",urgent]
    ].map(([t,v])=>'<div class="card stat"><strong>'+v+'</strong><span>'+t+'</span></div>').join("");
  }
  function renderAppointments(){
    state=loadState();const box=$("#appointmentsList");if(!box)return;
    const q=String($("#adminSearch")?.value||"").trim().toLowerCase();
    const list=state.appointments.filter(a=>(activeFilter==="all"||a.status===activeFilter)&&(!q||[a.studentName,a.studentId,a.ref,a.college,getReason(a.reason).label].join(" ").toLowerCase().includes(q)))
      .sort((a,b)=>appointmentStamp(a)-appointmentStamp(b));
    box.innerHTML=list.length?list.map(a=>appointmentCard(a,{showStudent:true,showActions:true})).join(""):'<div class="empty">لا توجد حجوزات مطابقة.</div>';
    bindAdminActions(box);
  }
  function bindAdminActions(root){
    $$("[data-act]",root).forEach(btn=>btn.addEventListener("click",()=>{
      state=loadState();const id=btn.closest("[data-id]")?.dataset.id,a=state.appointments.find(x=>x.id===id);if(!a)return;
      const act=btn.dataset.act;
      if(act==="copy"){copyText(a.ref);return}
      if(act==="transfer"){
        const suggested=getReason(a.reason).route;
        const destination=prompt("حوّل الطلب إلى أي جهة؟",a.transferredTo||suggested);
        if(!destination||!destination.trim())return;
        a.status="transferred";
        a.transferredTo=destination.trim();
        a.transferredAt=nowIso();
        if(state.queue?.calledId===a.id)state.queue={calledId:null,calledAt:null};
      }else if(act==="cancel"){
        if(!confirm("إلغاء هذا الموعد؟"))return;
        a.status="cancelled";
        a.cancelledAt=nowIso();
        if(state.queue?.calledId===a.id)state.queue={calledId:null,calledAt:null};
      }else if(act==="call"){
        state.appointments.forEach(x=>{if(x.status==="called"&&x.id!==a.id)x.status="confirmed"});
        a.status="called";state.queue={calledId:a.id,calledAt:nowIso()};
      }else{
        const map={confirm:"confirmed",reject:"rejected",complete:"completed",no_show:"no_show"};
        a.status=map[act]||a.status;
        if(state.queue?.calledId===a.id&&["completed","no_show","rejected"].includes(a.status))state.queue={calledId:null,calledAt:null};
      }
      saveState(state);renderAdmin();toast("تم تحديث حالة الموعد");
    }));
  }
  function renderCategories(){
    const box=$("#categoryStats");if(!box)return;
    const counts={};state.appointments.forEach(a=>counts[a.reason]=(counts[a.reason]||0)+1);
    const max=Math.max(1,...Object.values(counts));
    box.innerHTML=Object.entries(REASONS).map(([k,r])=>{
      const c=counts[k]||0;
      return '<div class="category-row"><div class="between row"><span>'+escapeHtml(r.label)+'</span><b>'+c+'</b></div><div class="bar"><span style="width:'+((c/max)*100)+'%"></span></div></div>';
    }).join("");
  }
  function renderSlotSettings(){
    const box=$("#slotSettings");if(!box)return;
    box.innerHTML=state.settings.slots.map(t=>'<button class="btn small '+(!state.settings.disabledSlots.includes(t)?'on':'')+'" data-time="'+t+'">'+t+'</button>').join("");
    $$("[data-time]",box).forEach(b=>b.onclick=()=>{
      state=loadState();const t=b.dataset.time,arr=state.settings.disabledSlots,i=arr.indexOf(t);
      if(i>=0)arr.splice(i,1);else arr.push(t);
      saveState(state);renderSlotSettings();toast(arr.includes(t)?"تم إيقاف الفترة":"تم تفعيل الفترة");
    });
  }
  function renderUpcoming(){
    const box=$("#upcomingList");if(!box)return;
    const list=state.appointments.filter(a=>isFutureAppointment(a)&&["pending","confirmed","called"].includes(a.status))
      .sort((a,b)=>appointmentStamp(a)-appointmentStamp(b)).slice(0,5);
    box.innerHTML=list.length?list.map(a=>appointmentCard(a,{showStudent:true,showActions:true})).join(""):'<div class="empty">لا توجد مواعيد قادمة.</div>';
    bindAdminActions(box);
  }
  function renderQueue(){
    const today=localDate(new Date());
    const current=state.appointments.find(a=>a.id===state.queue?.calledId&&a.status==="called");
    const list=state.appointments.filter(a=>a.date===today&&["pending","confirmed","called"].includes(a.status)).sort((a,b)=>a.time.localeCompare(b.time));
    const currentBox=$("#currentQueue");
    if(currentBox)currentBox.innerHTML=current
      ? '<div class="queue-current-number">'+escapeHtml(current.ref)+'</div><strong>'+escapeHtml(current.studentName)+'</strong><span>'+escapeHtml(current.time)+' · '+escapeHtml(getReason(current.reason).label)+'</span>'
      : '<div class="empty">لا يوجد طالب مستدعى حاليًا.</div>';
    const listBox=$("#todayQueueList");
    if(listBox){listBox.innerHTML=list.length?list.map(a=>appointmentCard(a,{showStudent:true,showActions:true})).join(""):'<div class="empty">لا توجد مواعيد في طابور اليوم.</div>';bindAdminActions(listBox)}
    const count=$("#queueCount");if(count)count.textContent=String(list.length);
  }
  function callNext(){
    state=loadState();const today=localDate(new Date());
    const existing=state.appointments.find(a=>a.id===state.queue?.calledId&&a.status==="called");
    if(existing){toast("يوجد طالب مستدعى حاليًا");return}
    const next=state.appointments.filter(a=>a.date===today&&a.status==="confirmed").sort((a,b)=>a.time.localeCompare(b.time))[0];
    if(!next){toast("لا يوجد موعد مؤكد جاهز للاستدعاء");return}
    next.status="called";state.queue={calledId:next.id,calledAt:nowIso()};saveState(state);renderAdmin();toast("تم استدعاء الطالب التالي");
  }
  function completeCurrent(){
    state=loadState();const a=state.appointments.find(x=>x.id===state.queue?.calledId&&x.status==="called");
    if(!a){toast("لا يوجد طالب مستدعى حاليًا");return}
    a.status="completed";state.queue={calledId:null,calledAt:null};saveState(state);renderAdmin();toast("تم إنهاء المقابلة");
  }
  function exportCsv(){
    state=loadState();const rows=[["reference","student_name","student_id","college","reason","date","time","status","urgent","walk_in"]];
    state.appointments.forEach(a=>rows.push([a.ref,a.studentName,a.studentId,a.college,getReason(a.reason).label,a.date,a.time,STATUS[a.status]||a.status,a.urgent?"yes":"no",a.walkin?"yes":"no"]));
    const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(",")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download="presidency-booking-demo.csv";link.click();URL.revokeObjectURL(url);toast("تم تصدير بيانات Demo");
  }
  window.addEventListener("storage",renderAdmin);
}

function initQueue(){
  const current=$("#publicCurrent"),upcoming=$("#publicQueueList"),stamp=$("#queueUpdatedAt");
  function render(){
    const state=loadState(),today=localDate(new Date());
    const called=state.appointments.find(a=>a.id===state.queue?.calledId&&a.status==="called");
    current.innerHTML=called
      ? '<div class="public-ticket">'+escapeHtml(called.ref)+'</div><div class="queue-callout">يرجى التوجه إلى مكتب الاستقبال</div>'
      : '<div class="public-ticket dim">—</div><div class="muted">لا يوجد رقم مستدعى حاليًا</div>';
    const list=state.appointments.filter(a=>a.date===today&&a.status==="confirmed").sort((a,b)=>a.time.localeCompare(b.time)).slice(0,5);
    upcoming.innerHTML=list.length?list.map(a=>'<div class="public-queue-row"><strong>'+escapeHtml(a.ref)+'</strong><span>'+escapeHtml(a.time)+'</span></div>').join(""):'<div class="empty">لا توجد مواعيد مؤكدة بانتظار الاستدعاء.</div>';
    stamp.textContent=new Intl.DateTimeFormat("ar-OM",{hour:"numeric",minute:"2-digit"}).format(new Date());
  }
  render();window.addEventListener("storage",render);setInterval(render,15000);
}

const page=document.body.dataset.demoPage;
if(page==="student")initStudent();
if(page==="admin")initAdmin();
if(page==="queue")initQueue();
