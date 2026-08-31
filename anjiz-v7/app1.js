const STORE='anjiz_v7_requirements';
const ACCOUNTS={
 'admin@anjiz.demo':{pw:'anjiz',uid:'A001',name:'أ. سلوى العنقودية',role:'admin',sub:'ANJIZ Supervisor',email:'admin@anjiz.demo'},
 'instructor@anjiz.demo':{pw:'anjiz',uid:'I101',name:'Dr. Asma',role:'instructor',sub:'FI Instructor',email:'instructor@anjiz.demo'},
 'student@anjiz.demo':{pw:'anjiz',uid:'S001',name:'Demo Student',role:'student',sub:'Student',email:'student@anjiz.demo'},
 'visitor@anjiz.demo':{pw:'anjiz',uid:'V001',name:'Demo Visitor',role:'student',sub:'Visitor',email:'visitor@anjiz.demo'},
 'peer@anjiz.demo':{pw:'anjiz',uid:'P001',name:'Peer Tutor Ahmed',role:'peer',sub:'Peer-Tutor',email:'peer@anjiz.demo'},
 'trainee@anjiz.demo':{pw:'anjiz',uid:'T001',name:'Trainee Sara',role:'peer',sub:'Trainee',email:'trainee@anjiz.demo'}
};
const SERVICES=[
 {id:'eng',name:'FI Remedial Support (ENGLISH)',rule:'two'},
 {id:'math',name:'FI Remedial Support (MATH & DL)',rule:'one'},
 {id:'conv',name:'Conversation',rule:'one'},
 {id:'work',name:'Workshops',rule:'one'},
 {id:'read',name:'Reading Club',rule:'one'},
 {id:'games',name:'Edu-games',rule:'one'},
 {id:'peer',name:'Peer-tutorials sessions',rule:'peer'}
];
const SEED={
 settings:{cycle:'Cycle 1 · Fall 2026',supervisorEmail:'anjiz.supervisor@example.edu',fiEmail:'fi.management@example.edu',lateAfter:'09:00'},
 users:[
 {uid:'A001',name:'أ. سلوى العنقودية',email:'admin@anjiz.demo',ext:'—',role:'Admin',active:true},
 {uid:'I101',name:'Dr. Asma',email:'instructor@anjiz.demo',ext:'2101',role:'Instructor',active:true},
 {uid:'I102',name:'Dr. Ahmed',email:'ahmed@example.edu',ext:'2102',role:'Instructor',active:true},
 {uid:'S001',name:'Demo Student',email:'student@anjiz.demo',role:'Student',level:'Level 2',active:true},
 {uid:'S10442',name:'Student 10442',email:'s10442@example.edu',role:'Student',level:'Level 1',active:true,disability:true},
 {uid:'S10981',name:'Student 10981',email:'s10981@example.edu',role:'Student',level:'Level 3',active:true,blocked:true,reason:'Repeated no-show',blockDate:'2026-08-26',blockDay:'Wednesday'},
 {uid:'V001',name:'Demo Visitor',email:'visitor@anjiz.demo',role:'Visitor',active:true},
 {uid:'P001',name:'Peer Tutor Ahmed',email:'peer@anjiz.demo',ext:'2201',role:'Peer-Tutor',active:true},
 {uid:'T001',name:'Trainee Sara',email:'trainee@anjiz.demo',ext:'2202',role:'Trainee',active:true}],
 instructorHours:[
 {uid:'I101',name:'Dr. Asma',service:'eng',date:'2026-09-06',day:'Sunday',time:'09:00-09:45'},
 {uid:'I102',name:'Dr. Ahmed',service:'eng',date:'2026-09-06',day:'Sunday',time:'09:00-09:45'},
 {uid:'I101',name:'Dr. Asma',service:'math',date:'2026-09-07',day:'Monday',time:'10:00-10:45'},
 {uid:'I102',name:'Dr. Ahmed',service:'conv',date:'2026-09-08',day:'Tuesday',time:'11:00-11:45'},
 {uid:'I102',name:'Dr. Ahmed',service:'conv',date:'2026-08-30',day:'Sunday',time:'09:00-09:45'}],
 peerAvailability:[{uid:'P001',name:'Peer Tutor Ahmed',date:'2026-09-06',day:'Sunday',from:'10:00',to:'12:00'},{uid:'T001',name:'Trainee Sara',date:'2026-09-07',day:'Monday',from:'09:00',to:'11:00'}],
 peerAssignments:[{uid:'P001',name:'Peer Tutor Ahmed',service:'peer',date:'2026-09-06',time:'10:00-10:45'},{uid:'T001',name:'Trainee Sara',service:'peer',date:'2026-08-30',time:'10:00-10:45'}],
 appointments:[
 {id:1,studentUid:'S001',student:'Demo Student',level:'Level 2',service:'eng',serviceName:'FI Remedial Support (ENGLISH)',date:'2026-08-23',day:'Sunday',time:'09:00-09:45',staffUid:'I101',staff:'Dr. Asma',status:'Conducted',attendance:'Present',bookedBy:'Student'},
 {id:2,studentUid:'S10442',student:'Student 10442',level:'Level 1',service:'peer',serviceName:'Peer-tutorials sessions',date:'2026-08-24',day:'Monday',time:'10:00-10:45',staffUid:'P001',staff:'Peer Tutor Ahmed',status:'Conducted',attendance:'Present',bookedBy:'Admin'},
 {id:3,studentUid:'S001',student:'Demo Student',level:'Level 2',service:'conv',serviceName:'Conversation',date:'2026-08-26',day:'Wednesday',time:'11:00-11:45',staffUid:'I102',staff:'Dr. Ahmed',status:'Conducted',attendance:'Present',bookedBy:'Student'},
 {id:4,studentUid:'S10442',student:'Student 10442',level:'Level 1',service:'peer',serviceName:'Peer-tutorials sessions',date:'2026-08-27',day:'Thursday',time:'10:00-10:45',staffUid:'P001',staff:'Peer Tutor Ahmed',status:'Conducted',attendance:'Absent',bookedBy:'Admin'},
 {id:5,studentUid:'S001',student:'Demo Student',level:'Level 2',service:'eng',serviceName:'FI Remedial Support (ENGLISH)',date:'2026-09-06',day:'Sunday',time:'09:00-09:45',staffUid:'I101',staff:'Dr. Asma',status:'Confirmed',attendance:'Upcoming',bookedBy:'Student'}],
 attendance:[
 {id:1,uid:'I101',name:'Dr. Asma',role:'Instructor',date:'2026-08-30',day:'Sunday',login:'08:55',logout:'12:02',status:'On time',note:''},
 {id:2,uid:'P001',name:'Peer Tutor Ahmed',role:'Peer-Tutor',date:'2026-08-30',day:'Sunday',login:'09:18',logout:'12:00',status:'Late',note:'18 minutes late',supervisorComment:''},
 {id:3,uid:'T001',name:'Trainee Sara',role:'Trainee',date:'2026-08-27',day:'Thursday',login:'—',logout:'—',status:'Absent',note:'No sign-in record',supervisorComment:''},
 {id:4,uid:'V001',name:'Demo Visitor',role:'Visitor',date:'2026-08-30',day:'Sunday',login:'10:02',logout:'11:00',status:'On time',note:''}],
 computerRequests:[{id:1,uid:'I101',name:'Dr. Asma',date:'2026-09-03',time:'11:00-12:00',count:8,purpose:'English support activity',status:'Pending',note:''}],
 referrals:[{uid:'S10442',student:'Student 10442',level:'Level 1',advisor:'FI Advisor Demo',appointments:3,present:2,absent:1},{uid:'S001',student:'Demo Student',level:'Level 2',advisor:'FI Advisor Demo',appointments:2,present:2,absent:0}],
 cycles:[{id:'C0',name:'Summer 2026 · Archived',from:'2026-07-01',to:'2026-08-15',file:'ANJIZ_Summer_Timetable.csv',active:false},{id:'C1',name:'Cycle 1 · Fall 2026',from:'2026-09-01',to:'2026-09-30',file:'ANJIZ_Cycle1_Timetable.csv',active:true}],
 cycleTables:{C0:[['Sunday','10:00-10:45','Conversation','Dr. Ahmed','ANJIZ 1'],['Tuesday','09:00-09:45','Reading Club','Dr. Asma','Reading Area']],C1:[['Sunday','09:00-09:45','FI Remedial Support (ENGLISH)','Dr. Asma / Dr. Ahmed','ANJIZ 1'],['Monday','10:00-10:45','FI Remedial Support (MATH & DL)','Dr. Asma','ANJIZ 2'],['Tuesday','11:00-11:45','Conversation','Dr. Ahmed','ANJIZ 1'],['Sunday','10:00-10:45','Peer-tutorials sessions','Peer Tutor Ahmed','ANJIZ 3']]},
 timetable:[['Sunday','09:00-09:45','FI Remedial Support (ENGLISH)','Dr. Asma / Dr. Ahmed','ANJIZ 1'],['Monday','10:00-10:45','FI Remedial Support (MATH & DL)','Dr. Asma','ANJIZ 2'],['Tuesday','11:00-11:45','Conversation','Dr. Ahmed','ANJIZ 1'],['Sunday','10:00-10:45','Peer-tutorials sessions','Peer Tutor Ahmed','ANJIZ 3']],
 announcements:[{id:1,title:'Cycle 1 Timetable',body:'The ANJIZ timetable for Cycle 1 is now available.',audience:'All users',date:'2026-08-31',email:true}],
 surveyUrl:'',rulesText:'Rules & Regulations content should be uploaded and approved by ANJIZ Administration. The requirements file provides the section name but not the final policy text.',
 notifications:[{id:1,to:'admin',title:'Late attendance',body:'Peer Tutor Ahmed was late on 2026-08-30.',date:'2026-08-30',read:false},{id:2,to:'all',title:'Cycle 1 timetable',body:'The current ANJIZ timetable is available.',date:'2026-08-31',read:false}],
 emailOutbox:[],audit:[['2026-08-31 09:00','System','Prototype initialized']]
};
let me=null,db=load(),selectedSlot='',reportTab='users',selectedCycleId='C1';
function clone(x){return JSON.parse(JSON.stringify(x))}function load(){try{return JSON.parse(localStorage.getItem(STORE))||clone(SEED)}catch(e){return clone(SEED)}}function save(){try{localStorage.setItem(STORE,JSON.stringify(db))}catch(e){}}function el(id){return document.getElementById(id)}function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function user(uid){return db.users.find(x=>x.uid===uid)}function svc(id){return SERVICES.find(x=>x.id===id)?.name||id}function statusBadge(s){let c=/late|absent|blocked|rejected/i.test(s)?'red':/pending/i.test(s)?'amber':/confirmed|conducted|present|on time|approved|active/i.test(s)?'':'gray';return `<span class="badge ${c}">${esc(s)}</span>`}function table(h,rows,cls){return `<div class="tablewrap"><table class="table"><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map((r,i)=>`<tr class="${cls?cls(r,i):''}">${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${h.length}" class="empty">No records.</td></tr>`}</tbody></table></div>`}
function cards(a){return `<div class="cards">${a.map(x=>`<div class="card"><small>${esc(x[0])}</small><strong>${esc(x[1])}</strong><em>${esc(x[2]||'')}</em></div>`).join('')}</div>`}
const MENUS={
 admin:[['dashboard','Dashboard'],['appointments','1. ANJIZ Appointments'],['book','2. Book for Students'],['attendance','3. Attendance'],['reports','4. Reports'],['others','5. Others'],['registration','6. Automated Registration']],
 instructor:[['dashboard','Dashboard'],['appointments','1. My Appointments'],['computers','2. Book ANJIZ Computers'],['referred','3. Referred Students'],['attendance','4. Attendance'],['reports','5. My Reports'],['others','6. Timetable & Announcements']],
 student:[['dashboard','Dashboard'],['book','1. Book Services & Programs'],['appointments','2. Appointments & Attendance'],['timetable','3. ANJIZ Timetable'],['announcements','4. Announcements']],
 peer:[['dashboard','Dashboard'],['appointments','1. My Appointments / Availability'],['book','2. Book for Students'],['attendance','3. Attendance'],['reports','4. My Reports'],['timetable','5. ANJIZ Timetable'],['announcements','6. Announcements']]
};
