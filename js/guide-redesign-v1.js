const lang=localStorage.getItem('uon_language')==='en'?'en':'ar',en=lang==='en';
const OFFICIAL='https://www.unizwa.edu.om/program_details.php?comingfrom=1378';
const colleges={
 'كلية العلوم والآداب':'College of Arts and Sciences',
 'كلية الاقتصاد والإدارة ونظم المعلومات':'College of Economics, Management and Information Systems',
 'كلية الهندسة والعمارة':'College of Engineering and Architecture',
 'كلية العلوم الصحية':'College of Health Sciences',
 'برامج أخرى':'Other Programs'
};
const degrees={'دبلوم':'Diploma','بكالوريوس':"Bachelor's",'ماجستير':"Master's",'دكتوراه':'Doctorate','دبلوم دراسات عليا':'Postgraduate Diploma','برنامج':'Program'};
const tabs={'الكل':'All','العلوم والآداب':'Arts & Sciences','الاقتصاد والإدارة':'Economics & Management','الهندسة والعمارة':'Engineering & Architecture','العلوم الصحية':'Health Sciences'};
function fixLinks(root=document){root.querySelectorAll('a[href*="contentid=619"]').forEach(a=>a.href=OFFICIAL)}
function translateDynamic(){
 fixLinks();
 if(!en)return;
 document.querySelectorAll('#collegeTabs button').forEach(b=>{const raw=b.textContent.trim();if(tabs[raw])b.textContent=tabs[raw]});
 document.querySelectorAll('.guide-college-heading').forEach(head=>{
  const label=head.querySelector('span'),title=head.querySelector('h2'),count=head.querySelector(':scope > strong');
  if(label)label.textContent='College';
  if(title&&colleges[title.textContent.trim()])title.textContent=colleges[title.textContent.trim()];
  if(count){const n=(count.textContent.match(/\d+/)||['0'])[0];count.textContent=`${n} program${n==='1'?'':'s'}`}
 });
 document.querySelectorAll('.guide-program-card').forEach(card=>{
  const h=card.querySelector('h3'),small=card.querySelector('.guide-program-top small'),tag=card.querySelector('.degree-tag');
  if(h&&small&&!card.dataset.enSwapped){const ar=h.textContent.trim(),english=small.textContent.trim();if(english){h.textContent=english;small.textContent=ar;card.dataset.enSwapped='1'}}
  if(tag&&degrees[tag.textContent.trim()])tag.textContent=degrees[tag.textContent.trim()];
  card.querySelectorAll('.guide-program-actions a').forEach(a=>{const text=a.textContent.trim();if(text==='الخطة الدراسية')a.textContent='Study plan';if(text==='المصدر الرسمي')a.textContent='Official source'});
 });
 const items=document.querySelector('#items');if(items&&items.textContent.trim()==='لا توجد برامج مطابقة للبحث.')items.textContent='No programs match your search.';
}
function schedule(){requestAnimationFrame(()=>requestAnimationFrame(translateDynamic));setTimeout(translateDynamic,120)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['search','collegeFilter','degreeFilter'].forEach(id=>document.querySelector('#'+id)?.addEventListener('input',schedule));
document.querySelector('#collegeTabs')?.addEventListener('click',schedule);
