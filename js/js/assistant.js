
import {get} from './api.js';import {$,esc,setupNav} from './ui.js';setupNav();
let programs=[];
try{programs=await get('university_programs','select=*&active=eq.true')}catch{}
const links={portal:'https://portal.unizwa.edu.om',moodle:'https://moodle.unizwa.edu.om',library:'https://library.unizwa.edu.om',official:'https://www.unizwa.edu.om/'};
function answer(q){
 const s=q.toLowerCase();
 if(s.includes('كلية')||s.includes('كليات'))return 'جامعة نزوى تضم أربع كليات رئيسية: العلوم والآداب، الاقتصاد والإدارة ونظم المعلومات، الهندسة والعمارة، والعلوم الصحية. افتح دليل الجامعة للتفاصيل.';
 if(s.includes('معدل'))return 'تقدر تستخدم حاسبة المعدل من الصفحة الرئيسية. نظام النقاط الشائع: A=4.0، A-=3.7، B+=3.3، B=3.0، B-=2.7، C+=2.3، C=2.0، D=1.0، F=0.';
 if(s.includes('رابط')||s.includes('بوابة')||s.includes('مودل'))return `الروابط: البوابة ${links.portal} — مودل ${links.moodle} — المكتبة ${links.library}`;
 const found=programs.filter(p=>`${p.name_ar||''} ${p.name_en||''} ${p.college||''}`.toLowerCase().includes(s)).slice(0,3);
 if(found.length)return found.map(p=>`${p.name_ar||p.name_en}: ${p.credit_hours||'—'} ساعة، سعر الساعة ${p.credit_hour_price||'—'} ر.ع`).join('\n');
 return 'ما حصلت إجابة دقيقة في بيانات المنصة. جرّب تكتب اسم التخصص أو افتح دليل الجامعة الرسمي.';
}
function add(text,type){const d=document.createElement('div');d.className=`msg ${type}`;d.textContent=text;$('#chatWindow').append(d);$('#chatWindow').scrollTop=$('#chatWindow').scrollHeight}
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();const q=$('#chatInput').value.trim();if(!q)return;add(q,'user');$('#chatInput').value='';setTimeout(()=>add(answer(q),'bot'),250)});
document.querySelectorAll('.quick-q').forEach(b=>b.onclick=()=>{$('#chatInput').value=b.textContent;$('#chatForm').requestSubmit()});
