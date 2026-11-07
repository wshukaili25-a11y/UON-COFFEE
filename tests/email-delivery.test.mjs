import test from 'node:test';
import assert from 'node:assert/strict';
import {emailTemplate,cleanSchedule,cleanName,cleanPng,formatClock,scheduleStats,validEmail} from '../supabase/functions/summary-email/email.mjs';

const rows=[
 {course:'COMP101',day:'الاثنين',start:'10:00',end:'11:50',room:'17A',teacher:'د. أحمد',type:'lecture'},
 {course:'MATH101',day:'الأحد',start:'08:00',end:'09:50',room:'',teacher:'',type:'lab'},
];

test('student name is written into every email automatically',()=>{
 for(const t of [emailTemplate({kind:'otp',subject:'schedule',name:'عبدالرحمن',title:'جدولي',otp:'123456'}),
  emailTemplate({kind:'summary',name:'عبدالرحمن',title:'ملخص COMP101',id:'abc'}),
  emailTemplate({kind:'schedule',name:'عبدالرحمن',schedule:cleanSchedule({title:'جدولي',rows})})]){
  assert.match(t.html,/هلا <strong>عبدالرحمن<\/strong>/);assert.match(t.text,/هلا عبدالرحمن/);
  assert.match(t.html,/#0B3B2C/);assert.match(t.html,/#CFA038/);assert.match(t.html,/فريق UON Hub/);
  assert.match(t.html,/dir="rtl"/);
 }
});

test('names and titles are escaped',()=>{
 const t=emailTemplate({kind:'summary',name:'<b>x</b>',title:'"><script>',id:'1'});
 assert.doesNotMatch(t.html,/<script>|<b>x<\/b>/);
});

test('otp email shows the code and what is being sent',()=>{
 const s=emailTemplate({kind:'otp',subject:'schedule',name:'سارة',title:'x',otp:'048213'});
 assert.match(s.html,/048213/);assert.match(s.html,/جدولك الدراسي/);assert.match(s.subject,/^048213 /);
 const m=emailTemplate({kind:'otp',name:'سارة',title:'ملخص الفيزياء',otp:'111111'});
 assert.match(m.html,/ملخص الفيزياء/);
 // legacy call shape still works
 assert.match(emailTemplate({name:'سارة',title:'t',otp:'222222'}).html,/222222/);
});

test('schedule email lists days in order with 12h times and stats',()=>{
 const sch=cleanSchedule({title:'جدول الفصل',rows});
 assert.deepEqual(sch.rows.map(r=>r.course),['MATH101','COMP101']);
 const t=emailTemplate({kind:'schedule',name:'علي',schedule:sch,hasImage:true});
 assert.ok(t.html.indexOf('MATH101')<t.html.indexOf('COMP101'));
 assert.match(t.html,/8:00 ص – 9:50 ص/);assert.match(t.html,/القاعة 17A/);assert.match(t.html,/أرفقنا لك نسخة صورة/);
 assert.match(t.subject,/جدول الفصل/);assert.match(t.text,/COMP101: 10:00 ص – 11:50 ص · 17A/);
 assert.doesNotMatch(emailTemplate({kind:'schedule',name:'علي',schedule:sch}).html,/أرفقنا لك نسخة صورة/);
 assert.deepEqual(scheduleStats(sch.rows),{courses:2,days:2,hours:3.7});
});

test('schedule validation rejects bad input',()=>{
 assert.equal(cleanSchedule(null),null);
 assert.equal(cleanSchedule({rows:[]}),null);
 assert.equal(cleanSchedule({rows:[{...rows[0],day:'الجمعة'}]}),null);
 assert.equal(cleanSchedule({rows:[{...rows[0],end:'09:00'}]}),null);
 assert.equal(cleanSchedule({rows:[{...rows[0],start:'25:00'}]}),null);
 assert.equal(cleanSchedule({rows:Array(81).fill(rows[0])}),null);
 const s=cleanSchedule({rows:[{...rows[0],course:'<img>'+'x'.repeat(80),type:'evil'}]});
 assert.equal(s.title,'جدولي الدراسي');assert.ok(s.rows[0].course.length<=40);assert.doesNotMatch(s.rows[0].course,/[<>]/);assert.equal(s.rows[0].type,'lecture');
});

test('name, email, clock and png helpers',()=>{
 assert.equal(cleanName('  عبد   الرحمن '),'عبد الرحمن');assert.equal(cleanName('a'),null);assert.equal(cleanName('x<y'),null);
 assert.ok(validEmail('a@b.co'));assert.ok(!validEmail('a@b'));
 assert.equal(formatClock('00:05'),'12:05 ص');assert.equal(formatClock('13:30'),'1:30 م');assert.equal(formatClock('12:00'),'12:00 م');
 const png=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.alloc(200)]).toString('base64');
 assert.equal(cleanPng(png),png);
 assert.equal(cleanPng(Buffer.from('%PDF-'+'x'.repeat(200)).toString('base64')),null);
 assert.equal(cleanPng('not base64!'),null);
 assert.equal(cleanPng(png,100),null);
});

test('dialog greeting updates from the typed name',async()=>{
 const src=(await import('node:fs')).readFileSync(new URL('../js/summary-email.js',import.meta.url),'utf8');
 const mod=await import('data:text/javascript,'+encodeURIComponent(src.replace(/^import.*?;\n/,'const esc=s=>s;\n')));
 assert.equal(mod.greeting('  محمد  '),'هلا محمد 👋');assert.equal(mod.greeting(''),'هلا … 👋');
 assert.match(src,/addEventListener\('input',updateGreeting\)/);
});
