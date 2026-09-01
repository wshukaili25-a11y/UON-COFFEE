let appointmentViewState={month:'',date:'',service:'all',status:'all',search:''};
function apEnsureState(){
  const all=myAppointments().slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const today=localDateISO();
  if(!appointmentViewState.date){
    const todayHas=all.some(x=>x.date===today);
    const next=all.find(x=>x.date>=today)||all[0];
    appointmentViewState.date=todayHas?today:(next?.date||today);
  }
  if(!appointmentViewState.month)appointmentViewState.month=appointmentViewState.date.slice(0,7);
}
function apFiltered(){
  apEnsureState();
  const q=(appointmentViewState.search||'').trim().toLowerCase();
  return myAppointments().filter(x=>
    (appointmentViewState.service==='all'||x.service===appointmentViewState.service)&&
    (appointmentViewState.status==='all'||x.status===appointmentViewState.status)&&
    (!q||[x.student,x.serviceName,x.staff,x.studentUid,x.bookedBy].some(v=>String(v||'').toLowerCase().includes(q)))
  ).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
function apRefresh(){el('content').innerHTML=appointmentsPage()}
function apShiftMonth(delta){
  apEnsureState();const [y,m]=appointmentViewState.month.split('-').map(Number),d=new Date(y,m-1+delta,1);
  appointmentViewState.month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  appointmentViewState.date=`${appointmentViewState.month}-01`;apRefresh();
}
function apGoToday(){appointmentViewState.date=localDateISO();appointmentViewState.month=appointmentViewState.date.slice(0,7);apRefresh()}
function apSelectDate(date){appointmentViewState.date=date;appointmentViewState.month=date.slice(0,7);apRefresh()}
function apSetService(v){appointmentViewState.service=v;apRefresh()}
function apSetStatus(v){appointmentViewState.status=v;apRefresh()}
function apSetSearch(v){appointmentViewState.search=v;apRefresh()}
function apMonthLabel(ym){const [y,m]=ym.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})}
function apCalendar(){
  apEnsureState();const arr=apFiltered(),[y,m]=appointmentViewState.month.split('-').map(Number),first=new Date(y,m-1,1),count=new Date(y,m,0).getDate(),offset=first.getDay(),today=localDateISO();
  let cells='';for(let i=0;i<offset;i++)cells+='<div class="cal-cell cal-empty"></div>';
  for(let day=1;day<=count;day++){
    const date=`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,items=arr.filter(x=>x.date===date),selected=date===appointmentViewState.date;
    const services=[...new Set(items.map(x=>x.service))].slice(0,3);
    cells+=`<button class="cal-cell ${items.length?'has-events':''} ${selected?'selected':''} ${date===today?'today':''}" onclick="apSelectDate('${date}')"><span class="cal-day">${day}</span>${items.length?`<b class="cal-count">${items.length}</b><div class="cal-dots">${services.map(()=>'<i></i>').join('')}</div>`:''}</button>`;
  }
  return `<div class="calendar-shell"><div class="calendar-head"><button class="cal-nav" onclick="apShiftMonth(-1)" aria-label="Previous month">‹</button><div><span class="section-label">MONTH VIEW</span><h3>${apMonthLabel(appointmentViewState.month)}</h3></div><button class="cal-nav" onclick="apShiftMonth(1)" aria-label="Next month">›</button></div><div class="cal-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<span>${x}</span>`).join('')}</div><div class="cal-grid">${cells}</div></div>`
}
function apDayView(){
  apEnsureState();const date=appointmentViewState.date,items=apFiltered().filter(x=>x.date===date).sort((a,b)=>a.time.localeCompare(b.time));
  return `<div class="day-shell"><div class="toolbar"><div><span class="section-label">DAY VIEW</span><h3>${dayOf(date)} · ${date}</h3></div><span class="day-total">${items.length} appointment${items.length===1?'':'s'}</span></div><div class="day-list">${items.length?items.map(a=>{let su=user(a.studentUid),canMark=['admin','instructor','peer'].includes(me.role);return `<article class="day-appt"><div class="time-rail"><b>${esc(a.time.split('-')[0])}</b><span>${esc(a.time.split('-')[1]||'')}</span></div><div class="appt-body"><div class="appt-title"><div><b>${esc(a.student)}${su?.disability?' ★':''}</b><span>${esc(a.serviceName)}</span></div>${statusBadge(a.status)}</div><div class="appt-meta"><span>Assigned: <b>${esc(a.staff)}</b></span><span>Attendance: ${statusBadge(a.attendance)}</span></div><div class="appt-actions"><button class="btn outline" onclick="showAppointmentDetails(${a.id})">Details</button>${canMark&&a.status!=='Conducted'?`<button class="btn secondary" onclick="markAppointment(${a.id},'Present')">Present</button><button class="btn danger" onclick="markAppointment(${a.id},'Absent')">Absent</button>`:''}</div></div></article>`}).join(''):`<div class="empty-state"><b>No appointments on this day</b><span>Select another date from the calendar or create a new booking.</span>${['admin','peer','student'].includes(me.role)?'<button class="btn primary" onclick="openPage(\'book\')">New booking</button>':''}</div>`}</div></div>`
}
function apListTable(arr){
  return table(['Student','Service','Day / Date','Time','Assigned','Status','Attendance',''],arr.map(a=>{let su=user(a.studentUid);return[`${esc(a.student)}${su?.disability?' ★':''}`,esc(a.serviceName),`${esc(a.day||dayOf(a.date))}<br><span class="muted">${esc(a.date)}</span>`,esc(a.time),esc(a.staff),statusBadge(a.status),statusBadge(a.attendance),`<button class="btn outline" onclick="showAppointmentDetails(${a.id})">Details</button>`]}),r=>r[0].includes('★')?'star':'')
}
function showAppointmentDetails(id){
  const a=db.appointments.find(x=>x.id===id);if(!a)return;const su=user(a.studentUid),staff=user(a.staffUid),canMark=['admin','instructor','peer'].includes(me.role);
  showModal(`<div class="appt-modal-head"><div><span class="section-label">ANJIZ APPOINTMENT</span><h3>${esc(a.serviceName)}</h3></div>${statusBadge(a.status)}</div><div class="detail-grid"><div><small>Student / Visitor</small><b>${esc(a.student)}${su?.disability?' ★':''}</b><span>${esc(a.studentUid)}</span></div><div><small>Day & Date</small><b>${esc(a.day||dayOf(a.date))}</b><span>${esc(a.date)}</span></div><div><small>Time</small><b>${esc(a.time)}</b></div><div><small>Assigned Staff</small><b>${esc(a.staff)}</b><span>${esc(staff?.role||'')}</span></div><div><small>Attendance</small>${statusBadge(a.attendance)}</div><div><small>Booked By</small><b>${esc(a.bookedBy||'—')}</b></div></div><div class="row" style="margin-top:16px"><button class="btn outline" onclick="closeModal()">Close</button>${canMark&&a.status!=='Conducted'?`<button class="btn secondary" onclick="closeModal();markAppointment(${a.id},'Present')">Mark Present</button><button class="btn danger" onclick="closeModal();markAppointment(${a.id},'Absent')">Mark Absent</button>`:''}</div>`)
}
function appointmentsPage(){
  apEnsureState();const arr=apFiltered(),conducted=arr.filter(x=>x.status==='Conducted').length,present=arr.filter(x=>x.attendance==='Present').length,upcoming=arr.filter(x=>x.status!=='Conducted').length;
  const serviceOptions=SERVICES.map(s=>`<option value="${s.id}" ${appointmentViewState.service===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
  return `<div class="appt-page-head"><div><span class="section-label">SCHEDULING & ATTENDANCE</span><h3>${me.role==='admin'?'ANJIZ Appointments':'My ANJIZ Appointments'}</h3><p>Calendar, day schedule and appointment records in one view.</p></div><div class="row">${['admin','peer','student'].includes(me.role)?'<button class="btn primary" onclick="openPage(\'book\')">＋ New booking</button>':''}<button class="btn outline" onclick="exportAppointments()">Export Excel</button></div></div>${cards([['Filtered appointments',arr.length,'Current view'],['Upcoming',upcoming,'Not yet conducted'],['Conducted',conducted,'Completed sessions'],['Present',present,'Attendance recorded']])}<div class="panel appt-filter-panel"><div class="appt-filters"><div class="field"><label>Service / Program</label><select onchange="apSetService(this.value)"><option value="all">All services</option>${serviceOptions}</select></div><div class="field"><label>Status</label><select onchange="apSetStatus(this.value)"><option value="all" ${appointmentViewState.status==='all'?'selected':''}>All statuses</option><option value="Confirmed" ${appointmentViewState.status==='Confirmed'?'selected':''}>Confirmed</option><option value="Conducted" ${appointmentViewState.status==='Conducted'?'selected':''}>Conducted</option></select></div><div class="field ap-search"><label>Search</label><div class="search-inline"><input value="${esc(appointmentViewState.search)}" placeholder="Student, ID, staff…" onkeydown="if(event.key==='Enter')apSetSearch(this.value)"><button class="btn outline" onclick="apSetSearch(this.previousElementSibling.value)">Search</button></div></div><div class="field"><label>Calendar</label><button class="btn outline full" onclick="apGoToday()">Today</button></div></div></div><div class="appt-layout"><div class="panel ap-calendar-panel">${apCalendar()}</div><div class="panel ap-day-panel">${apDayView()}</div></div><div class="panel" style="margin-top:12px"><div class="toolbar"><div><span class="section-label">ALL RECORDS</span><h3>Appointment List</h3></div><span class="muted">${arr.length} result${arr.length===1?'':'s'}</span></div>${arr.length?apListTable(arr):'<div class="empty-state"><b>No appointments match these filters</b><span>Clear or change the filters to view more records.</span></div>'}</div>`
}

;(()=>{if(window.__anjizAddonBridgeV16)return;window.__anjizAddonBridgeV16=1;
const root='https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/anjiz-system-v7/anjiz-v7/';
async function t(name){return fetch(root+name+'?v=20260901v16',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(name+' '+r.status);return r.text()})}
function css(id,txt){if(document.getElementById(id))return;const s=document.createElement('style');s.id=id;s.textContent=txt;document.head.appendChild(s)}
(async()=>{try{
const [bjs,bcss,ajs,acss,rjs,rcss]=await Promise.all([t('booking-v10.js'),t('booking-v10.css'),t('attendance-v11.js'),t('attendance-v11.css'),t('reports-v12.js'),t('reports-v12.css')]);
css('bookingV10-css',bcss);css('attendanceV11-css',acss);css('reportsV12-css',rcss);
const blob=new Blob([bjs+'\n'+ajs+'\n'+rjs],{type:'text/javascript'}),url=URL.createObjectURL(blob);
await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});URL.revokeObjectURL(url);
window.__anjizAddonBridgeV16Ready=1;
}catch(e){console.warn('ANJIZ optional modules unavailable',e)}})()})();
