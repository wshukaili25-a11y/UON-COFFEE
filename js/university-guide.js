import {
 setupNav,
 enforceUonMaintenance,
 watchUonMaintenance,
 $,
 get,
 toast,
 esc
} from './core.js';

setupNav();
await enforceUonMaintenance();
watchUonMaintenance();

const officialPrograms=[{"college": "كلية العلوم والآداب", "degree": "دبلوم", "name_ar": "علوم الحاسب", "name_en": "Computer Science", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "دبلوم", "name_ar": "الإحصاء", "name_en": "Statistics", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "دبلوم", "name_ar": "الرياضيات", "name_en": "Mathematics", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "دبلوم", "name_ar": "الفيزياء", "name_en": "Physics", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "دبلوم", "name_ar": "التقنية الحيوية", "name_en": "Biotechnology", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "دبلوم", "name_ar": "الكيمياء", "name_en": "Chemistry", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "دبلوم", "name_ar": "اللغة العربية", "name_en": "Arabic Language", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "دبلوم", "name_ar": "اللغة الإنجليزية والترجمة", "name_en": "English Language and Translation", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "دبلوم", "name_ar": "اللغة الفرنسية والترجمة", "name_en": "French Language and Translation", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "دبلوم", "name_ar": "اللغة الألمانية والترجمة", "name_en": "German Language and Translation", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "علوم الحاسب", "name_en": "Computer Science", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "الإحصاء", "name_en": "Statistics", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "الرياضيات", "name_en": "Mathematics", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "الفيزياء", "name_en": "Physics", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "التقنية الحيوية", "name_en": "Biotechnology", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "الكيمياء", "name_en": "Chemistry", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "اللغة العربية", "name_en": "Arabic Language", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "اللغة الإنجليزية والترجمة", "name_en": "English Language and Translation", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "اللغة الفرنسية والترجمة", "name_en": "French Language and Translation", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "اللغة الألمانية والترجمة", "name_en": "German Language and Translation", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "التربية في علوم الحاسب", "name_en": "Computer Science Education", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "التربية في الرياضيات", "name_en": "Mathematics Education", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "التربية في الفيزياء", "name_en": "Physics Education", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "التربية في الأحياء", "name_en": "Biology Education", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "التربية في الكيمياء", "name_en": "Chemistry Education", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "التربية في اللغة العربية", "name_en": "Arabic Language Education", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "التربية في اللغة الإنجليزية", "name_en": "English Language Education", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "التربية الخاصة", "name_en": "Special Education", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "رياض الأطفال", "name_en": "Kindergarten Education", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "بكالوريوس", "name_ar": "التربية الفنية", "name_en": "Art Education", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "ماجستير", "name_ar": "الإدارة التربوية", "name_en": "Educational Administration", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "ماجستير", "name_ar": "الإرشاد النفسي", "name_en": "Psychological Counseling", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "ماجستير", "name_ar": "اللغة العربية وآدابها", "name_en": "Arabic Language and Literature", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم والآداب", "degree": "ماجستير", "name_ar": "اللغة الإنجليزية", "name_en": "English Language", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "دبلوم", "name_ar": "المحاسبة", "name_en": "Accounting", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "دبلوم", "name_ar": "إدارة الأعمال", "name_en": "Business Administration", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "دبلوم", "name_ar": "الاقتصاد والتمويل", "name_en": "Economics and Finance", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "دبلوم", "name_ar": "التجارة والتمويل الدولي", "name_en": "International Trade and Finance", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "دبلوم", "name_ar": "التسويق", "name_en": "Marketing", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "دبلوم", "name_ar": "إدارة السياحة والمرافق الترفيهية", "name_en": "Tourism and Recreational Facilities Management", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "دبلوم", "name_ar": "نظم المعلومات", "name_en": "Information Systems", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "دبلوم", "name_ar": "تصميم الويب وأمن المعلومات", "name_en": "Web Design and Information Security", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "المحاسبة", "name_en": "Accounting", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "إدارة الأعمال", "name_en": "Business Administration", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "الاقتصاد والتمويل – الإدارة المالية", "name_en": "Economics and Finance – Financial Management", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "الاقتصاد والتمويل – الاقتصاد الدولي", "name_en": "Economics and Finance – International Economics", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "الاقتصاد والتمويل – الصيرفة والتمويل الإسلامي", "name_en": "Economics and Finance – Islamic Banking and Finance", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "الاقتصاد والتمويل – اقتصاد الموارد الطبيعية", "name_en": "Economics and Finance – Natural Resource Economics", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "التجارة والتمويل الدولي", "name_en": "International Trade and Finance", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "التسويق", "name_en": "Marketing", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "إدارة السياحة والترفيه", "name_en": "Tourism and Recreational Management", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "إدارة العمليات", "name_en": "Operations Management", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "نظم المعلومات", "name_en": "Information Systems", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "بكالوريوس", "name_ar": "تصميم الويب وأمن المعلومات", "name_en": "Web Design and Information Security", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "ماجستير", "name_ar": "المحاسبة", "name_en": "Accounting", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "ماجستير", "name_ar": "إدارة الأعمال", "name_en": "Business Administration", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "ماجستير", "name_ar": "الماجستير التنفيذي في إدارة الأعمال", "name_en": "Executive Master of Business Administration", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "ماجستير", "name_ar": "الاقتصاد", "name_en": "Economics", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "ماجستير", "name_ar": "نظم المعلومات", "name_en": "Information Systems", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الاقتصاد والإدارة ونظم المعلومات", "degree": "دكتوراه", "name_ar": "دكتوراه الفلسفة في دراسات الأعمال", "name_en": "Ph.D. in Business Studies", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "دبلوم", "name_ar": "تقنيات الهندسة الكيميائية والبتروكيماوية", "name_en": "Chemical and Petrochemical Technologies", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "دبلوم", "name_ar": "العمارة", "name_en": "Architecture", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "دبلوم", "name_ar": "التقنيات الكهربائية", "name_en": "Electrical Technologies", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "دبلوم", "name_ar": "تقنيات هندسة الحاسب", "name_en": "Computer Technologies", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "دبلوم", "name_ar": "التقنيات المدنية", "name_en": "Civil Technologies", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "دبلوم", "name_ar": "التقنيات البيئية", "name_en": "Environmental Technologies", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "دبلوم", "name_ar": "تقنيات التصميم الداخلي", "name_en": "Interior Design Technologies", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "بكالوريوس", "name_ar": "الهندسة الكيميائية والبتروكيماوية", "name_en": "Chemical and Petrochemical Engineering", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "بكالوريوس", "name_ar": "الهندسة المعمارية", "name_en": "Architectural Engineering", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "بكالوريوس", "name_ar": "الهندسة الكهربائية", "name_en": "Electrical Engineering", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "بكالوريوس", "name_ar": "هندسة الحاسب", "name_en": "Computer Engineering", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "بكالوريوس", "name_ar": "الهندسة المدنية", "name_en": "Civil Engineering", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "بكالوريوس", "name_ar": "الهندسة البيئية", "name_en": "Environmental Engineering", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية الهندسة والعمارة", "degree": "بكالوريوس", "name_ar": "هندسة التصميم الداخلي", "name_en": "Interior Design Engineering", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم الصحية", "degree": "دبلوم", "name_ar": "الصيدلة", "name_en": "Pharmacy", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم الصحية", "degree": "دبلوم", "name_ar": "التمريض", "name_en": "Nursing", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم الصحية", "degree": "دبلوم", "name_ar": "التجسير في الصيدلة", "name_en": "Bridging Pharmacy Diploma", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم الصحية", "degree": "دبلوم", "name_ar": "التجسير في التمريض", "name_en": "Bridging Nursing Diploma", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم الصحية", "degree": "بكالوريوس", "name_ar": "الصيدلة", "name_en": "Pharmacy", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}, {"college": "كلية العلوم الصحية", "degree": "بكالوريوس", "name_ar": "التمريض", "name_en": "Nursing", "official_url": "https://www.unizwa.edu.om/index.php?contentid=619&lang=en"}];
let rows=[];
let activeCollege='';

function keyOf(item){
 return `${item.college||''}|${item.degree||''}|${item.name_ar||item.name_en||''}`.toLowerCase();
}

async function load(){
 try{
  const databaseRows=await get('university_programs','select=*&active=eq.true&order=college.asc,name_ar.asc');
  const merged=new Map();

  officialPrograms.forEach(item=>merged.set(keyOf(item),item));
  databaseRows.forEach(item=>merged.set(keyOf(item),{...merged.get(keyOf(item)),...item}));

  rows=[...merged.values()];
  renderTabs();
  render();
 }catch(error){
  rows=[...officialPrograms];
  renderTabs();
  render();
  console.warn(error);
 }
}

function renderTabs(){
 const colleges=[
  ['','الكل'],
  ['كلية العلوم والآداب','العلوم والآداب'],
  ['كلية الاقتصاد والإدارة ونظم المعلومات','الاقتصاد والإدارة'],
  ['كلية الهندسة والعمارة','الهندسة والعمارة'],
  ['كلية العلوم الصحية','العلوم الصحية']
 ];

 $('#collegeTabs').innerHTML=colleges.map(([value,label])=>`
  <button class="${activeCollege===value?'active':''}" data-college="${esc(value)}">${esc(label)}</button>
 `).join('');

 document.querySelectorAll('[data-college]').forEach(button=>{
  button.onclick=()=>{
   activeCollege=button.dataset.college;
   $('#collegeFilter').value=activeCollege;
   renderTabs();
   render();
  };
 });
}

function render(){
 const query=$('#search').value.trim().toLowerCase();
 const selectedCollege=$('#collegeFilter').value||activeCollege;
 const degree=$('#degreeFilter').value;

 const list=rows.filter(item=>{
  const text=`${item.name_ar||''} ${item.name_en||''} ${item.college||''} ${item.degree||''}`.toLowerCase();
  return (!selectedCollege||item.college===selectedCollege)&&
         (!degree||String(item.degree||'').includes(degree))&&
         (!query||text.includes(query));
 });

 $('#programCount').textContent=rows.length;

 const groups=new Map();
 list.forEach(item=>{
  const key=item.college||'برامج أخرى';
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(item);
 });

 $('#items').innerHTML=list.length?[...groups.entries()].map(([college,items])=>`
  <section class="guide-college-section">
   <div class="guide-college-heading">
    <div><span>كلية</span><h2>${esc(college)}</h2></div>
    <strong>${items.length} برنامج</strong>
   </div>
   <div class="guide-program-grid">
    ${items.map(item=>`
     <article class="guide-program-card">
      <div class="guide-program-top">
       <span class="degree-tag">${esc(item.degree||'برنامج')}</span>
       <small>${esc(item.name_en||'')}</small>
      </div>
      <h3>${esc(item.name_ar||item.name_en)}</h3>
      <div class="guide-program-actions">
       ${item.study_plan_url?`<a class="btn" target="_blank" href="${esc(item.study_plan_url)}">الخطة الدراسية</a>`:''}
       <a class="btn primary" target="_blank" rel="noopener" href="${esc(item.official_url||'https://www.unizwa.edu.om/index.php?contentid=619&lang=en')}">المصدر الرسمي</a>
      </div>
     </article>
    `).join('')}
   </div>
  </section>
 `).join(''):'<div class="empty">لا توجد نتائج مطابقة</div>';
}

$('#search').addEventListener('input',render);
$('#collegeFilter').addEventListener('change',()=>{
 activeCollege=$('#collegeFilter').value;
 renderTabs();
 render();
});
$('#degreeFilter').addEventListener('change',render);

load();
