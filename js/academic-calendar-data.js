export const ACADEMIC_CALENDAR_VERSION='2026-2027-fall-v1';

export const ACADEMIC_EVENTS=[
 {icon:'📝',title:'فترة التسجيل الثانية',start:'2026-08-30',end:'2026-09-03',kind:'registration'},
 {icon:'🎓',title:'بداية الدراسة + أسبوع الحذف والإضافة',start:'2026-09-06',end:'2026-09-06',kind:'semester'},
 {icon:'➕',title:'فترة الحذف والإضافة',start:'2026-09-06',end:'2026-09-10',kind:'registration'},
 {icon:'👋',title:'أسبوع التهيئة للطلبة الجدد',start:'2026-09-20',end:'2026-09-24',kind:'orientation'},
 {icon:'📝',title:'الاختبار الأول – الأسبوع الأول',start:'2026-10-11',end:'2026-10-15',kind:'exam'},
 {icon:'📝',title:'الاختبار الأول – الأسبوع الثاني',start:'2026-10-18',end:'2026-10-22',kind:'exam'},
 {icon:'📋',title:'الاختبار الثاني – الأسبوع الأول',start:'2026-11-15',end:'2026-11-19',kind:'exam'},
 {icon:'📋',title:'الاختبار الثاني – الأسبوع الثاني',start:'2026-11-29',end:'2026-12-03',kind:'exam'},
 {icon:'⚠️',title:'آخر يوم للانسحاب بدرجة (W)',start:'2026-12-10',end:'2026-12-10',kind:'deadline'},
 {icon:'📚',title:'فترة التسجيل الأولى لفصل الربيع',start:'2026-12-13',end:'2026-12-17',kind:'registration'},
 {icon:'⚠️',title:'آخر يوم للانسحاب بدرجة (WF)',start:'2026-12-17',end:'2026-12-17',kind:'deadline'},
 {icon:'🏫',title:'آخر يوم للدراسة',start:'2026-12-24',end:'2026-12-24',kind:'semester'},
 {icon:'🏆',title:'الاختبارات النهائية',start:'2026-12-27',end:'2027-01-07',kind:'exam'}
];

export function omanDate(value){
 const raw=value instanceof Date?value:new Date(value);
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Muscat',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(raw);
 const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return `${map.year}-${map.month}-${map.day}`;
}

export function dateAtMuscatMidnight(value){return new Date(`${value}T00:00:00+04:00`)}

export function formatAcademicDate(value){
 return new Intl.DateTimeFormat('ar-OM',{timeZone:'Asia/Muscat',day:'numeric',month:'long',year:'numeric'}).format(dateAtMuscatMidnight(value));
}

export function eventState(event,now=new Date()){
 const today=omanDate(now);
 if(today<event.start)return 'upcoming';
 if(today>event.end)return 'past';
 return 'active';
}

export function nextAcademicEvent(now=new Date()){
 const today=omanDate(now);
 return ACADEMIC_EVENTS.find(event=>event.end>=today)||null;
}

export function daysUntil(value,now=new Date()){
 const today=dateAtMuscatMidnight(omanDate(now));
 const target=dateAtMuscatMidnight(value);
 return Math.round((target-today)/86400000);
}

export function nextDayCompact(value){
 const date=dateAtMuscatMidnight(value);
 date.setDate(date.getDate()+1);
 return `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
}
