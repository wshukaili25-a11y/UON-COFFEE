import {
 $,get,esc,enforceUonMaintenance,watchUonMaintenance,
 trackEvent,applyFeatureStates
} from './core.js';

const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';

const form=$('#chatForm');
const input=$('#question');
const chat=$('#chat');
const submitButton=form?.querySelector('button[type="submit"],button:not([type])');

const history=[];
let sending=false;

function addMessage(role,content,links=[]){
 if(!chat)return;

 const article=document.createElement('article');
 article.className=`message ${role}`;

 const body=document.createElement('div');
 body.className='message-content';
 body.textContent=content;
 article.appendChild(body);

 if(Array.isArray(links)&&links.length){
  const linksBox=document.createElement('div');
  linksBox.className='assistant-links';

  links.forEach(item=>{
   if(!item?.url)return;
   const anchor=document.createElement('a');
   anchor.href=item.url;
   anchor.target=item.url.startsWith('http')?'_blank':'_self';
   anchor.rel='noopener';
   anchor.innerHTML=`<span>${esc(item.type||'رابط')}</span><strong>${esc(item.title||item.url)}</strong>`;
   linksBox.appendChild(anchor);
  });

  article.appendChild(linksBox);
 }

 if(role==='bot' && Array.isArray(links) && links.some(item=>item?.official)){
  const note=document.createElement('div');
  note.className='assistant-source-note';
  note.textContent='المصادر الرسمية مرفقة مع الإجابة. تحقّق منها عند القرارات الأكاديمية أو المالية.';
  article.appendChild(note);
 }

 chat.appendChild(article);
 chat.scrollTop=chat.scrollHeight;
 return article;
}

function addTyping(){
 const article=document.createElement('article');
 article.className='message bot typing-message';
 article.innerHTML='<div class="typing-dots"><span></span><span></span><span></span></div>';
 chat.appendChild(article);
 chat.scrollTop=chat.scrollHeight;
 return article;
}

function normalize(text){
 return String(text||'')
  .toLowerCase()
  .replace(/[أإآ]/g,'ا')
  .replace(/ة/g,'ه')
  .replace(/ى/g,'ي')
  .replace(/[^\p{L}\p{N}\s]/gu,' ')
  .replace(/\s+/g,' ')
  .trim();
}

async function searchPlatform(question){
 const query=normalize(question);
 const tokens=query.split(' ').filter(token=>token.length>=2);
 const matches=[];

 const sources=[
  {
   table:'courses',
   query:'select=code,name_ar,name_en,college,department,description&active=eq.true&limit=250',
   type:'مقرر',
   title:item=>`${item.code||''} — ${item.name_ar||item.name_en||''}`,
   description:item=>[item.college,item.department,item.description].filter(Boolean).join(' • '),
   url:item=>`course.html?code=${encodeURIComponent(item.code||'')}`
  },
  {
   table:'summaries',
   query:'select=id,title,subject,course_code,college,description,url&approved=eq.true&limit=250',
   type:'ملخص',
   title:item=>item.title||item.subject||'ملخص',
   description:item=>[item.course_code,item.subject,item.college,item.description].filter(Boolean).join(' • '),
   url:item=>item.url||'summaries.html'
  },
  {
   table:'whatsapp_groups',
   query:'select=id,subject,course_code,college,link&approved=eq.true&limit=250',
   type:'مجموعة',
   title:item=>item.subject||item.course_code||'مجموعة واتساب',
   description:item=>[item.course_code,item.college].filter(Boolean).join(' • '),
   url:item=>item.link||'groups.html'
  },
  {
   table:'university_programs',
   query:'select=name_ar,name_en,college,degree,official_url&active=eq.true&limit=250',
   type:'برنامج',
   title:item=>item.name_ar||item.name_en||'برنامج',
   description:item=>[item.college,item.degree,item.name_en].filter(Boolean).join(' • '),
   url:item=>item.official_url||'university-guide.html'
  },
  {
   table:'academic_calendar_events',
   query:'select=title,description,start_date,end_date,event_type&active=eq.true&limit=100',
   type:'موعد',
   title:item=>item.title||'موعد أكاديمي',
   description:item=>[item.description,item.start_date,item.end_date].filter(Boolean).join(' • '),
   url:()=> 'calendar.html'
  },
  {
   table:'useful_sites',
   query:'select=title_ar,title_en,description_ar,category,url&active=eq.true&limit=150',
   type:'موقع',
   title:item=>item.title_ar||item.title_en||'موقع مفيد',
   description:item=>[item.description_ar,item.category].filter(Boolean).join(' • '),
   url:item=>item.url||'useful-sites.html'
  }
 ];

 for(const source of sources){
  try{
   const rows=await get(source.table,source.query);

   rows.forEach(item=>{
    const title=source.title(item);
    const description=source.description(item);
    const searchable=normalize(
     `${title} ${description} ${Object.values(item).filter(value=>typeof value==='string').join(' ')}`
    );

    let score=0;
    if(query&&searchable.includes(query))score+=12;
    tokens.forEach(token=>{
     if(searchable.includes(token))score+=2;
     if(normalize(title).includes(token))score+=3;
    });

    if(score>0){
     matches.push({
      type:source.type,
      title,
      description,
      url:source.url(item),
      score
     });
    }
   });
  }catch(error){
   console.warn(`AI context source skipped: ${source.table}`,error);
  }
 }

 return matches
  .sort((a,b)=>b.score-a.score)
  .slice(0,12)
  .map(({score,...item})=>item);
}

function localAnswer(question,context){
 const q=normalize(question);

 if(/معدل|gpa|تراكمي|فصلي/.test(q)){
  return {
   answer:'تقدر تستخدم حاسبة المعدل في المنصة لحساب المعدل الفصلي والتراكمي. افتح أداة حاسبة المعدل، أضف المواد والساعات والتقديرات، ثم اضغط حساب.',
   links:[{type:'أداة',title:'حاسبة المعدل',url:'gpa.html'}]
  };
 }

 if(/مجموعه|واتساب|قروب/.test(q)){
  return {
   answer:context.length
    ?'وجدت مجموعات أو مقررات مرتبطة بسؤالك. افتح النتيجة المناسبة من الروابط أدناه.'
    :'افتح صفحة مجموعات الواتساب وابحث برمز المادة أو اسمها. بعض الروابط قد تتطلب الدخول بالحساب الجامعي.',
   links:context.length?context:[{type:'خدمة',title:'مجموعات الواتساب',url:'groups.html'}]
  };
 }

 if(/ملخص|اختبار|فاينل|ميد/.test(q)){
  return {
   answer:context.length
    ?'وجدت ملفات أو مقررات مرتبطة بسؤالك. اختر النتيجة المناسبة أدناه.'
    :'افتح صفحة الملخصات والاختبارات وابحث برمز المادة أو اسمها.',
   links:context.length?context:[{type:'خدمة',title:'الملخصات والاختبارات',url:'summaries.html'}]
  };
 }

 if(/كليه|تخصص|برنامج|بكالوريوس|دبلوم|ماجستير|دكتوراه/.test(q)){
  return {
   answer:context.length
    ?'وجدت برامج أكاديمية مرتبطة بسؤالك. التفاصيل وروابط المصدر موجودة أدناه.'
    :'تقدر تستعرض الكليات والتخصصات والبرامج من دليل الجامعة.',
   links:context.length?context:[{type:'دليل',title:'دليل الجامعة',url:'university-guide.html'}]
  };
 }

 if(context.length){
  return {
   answer:'وجدت معلومات مرتبطة بسؤالك داخل منصة UON Hub. افتح النتائج أدناه، أو اكتب سؤالك بصورة أدق.',
   links:context
  };
 }

 return {
  answer:'ما حصلت معلومة مؤكدة في بيانات المنصة أو المصادر الرسمية المتاحة. جرّب كتابة اسم الخدمة أو التخصص بصورة أوضح.',
  links:[
   {type:'خدمة',title:'مركز المقررات',url:'courses.html'},
   {type:'دليل',title:'دليل الجامعة',url:'university-guide.html'},
   {type:'أداة',title:'مواقع مهمة ومفيدة',url:'useful-sites.html'}
  ]
 };
}

async function askAI(question,context){
 const response=await fetch(`${SUPABASE_URL}/functions/v1/uon-ai`,{
  method:'POST',
  headers:{
   apikey:SUPABASE_KEY,
   Authorization:`Bearer ${SUPABASE_KEY}`,
   'Content-Type':'application/json'
  },
  body:JSON.stringify({
   question,
   context,
   history:history.slice(-6)
  }),
  cache:'no-store'
 });

 const text=await response.text();
 let data;
 try{data=text?JSON.parse(text):{}}catch{data={error:text}}

 if(!response.ok)throw new Error(data?.error||`AI HTTP ${response.status}`);
 if(!data?.answer)throw new Error('AI returned an empty answer');
 return data;
}

async function submitQuestion(question){
 if(sending||!question)return;
 sending=true;

 addMessage('user',question);
 history.push({role:'user',content:question});
 input.value='';

 const typing=addTyping();
 const originalText=submitButton?.textContent||'إرسال';

 if(submitButton){
  submitButton.disabled=true;
  submitButton.textContent='جاري التفكير...';
 }

 trackEvent('assistant_question',{query:question.slice(0,100)});

 try{
  const context=await searchPlatform(question);
  let result;

  try{
   result=await askAI(question,context);
  }catch(error){
   console.warn('AI function unavailable, using platform fallback',error);
   result=localAnswer(question,context);
  }

  typing.remove();
  addMessage('bot',result.answer,result.links||context.slice(0,5));
  history.push({role:'assistant',content:result.answer});
 }catch(error){
  console.error(error);
  typing.remove();
  addMessage('bot','تعذر إكمال الإجابة الآن. جرّب مرة أخرى أو افتح إحدى خدمات المنصة من القائمة.');
 }finally{
  sending=false;
  if(submitButton){
   submitButton.disabled=false;
   submitButton.textContent=originalText;
  }
  input.focus();
 }
}

function handleSubmit(event){
 if(event){
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
 }
 const question=input?.value?.trim()||'';
 if(!question){
  input?.focus();
  return false;
 }
 submitQuestion(question);
 return false;
}

// Install submit protection immediately, before any network request.
if(form){
 form.action='javascript:void(0)';
 form.method='post';
 form.addEventListener('submit',handleSubmit,true);
 form.onsubmit=handleSubmit;
}

submitButton?.addEventListener('click',event=>{
 event.preventDefault();
 handleSubmit(event);
});

input?.addEventListener('keydown',event=>{
 if(event.key==='Enter'&&!event.shiftKey){
  event.preventDefault();
  event.stopPropagation();
  handleSubmit(event);
 }
});

document.querySelectorAll('[data-prompt]').forEach(button=>{
 button.type='button';
 button.addEventListener('click',event=>{
  event.preventDefault();
  const prompt=button.dataset.prompt||button.textContent.trim();
  if(input){
   input.value=prompt;
   input.focus();
  }
 });
});

async function initializeAssistant(){
 try{
  await enforceUonMaintenance();
 }catch(error){
  console.warn('Maintenance check skipped in assistant',error);
 }

 try{
  watchUonMaintenance();
 }catch(error){
  console.warn('Maintenance watcher skipped in assistant',error);
 }

 try{
  await applyFeatureStates(document);
 }catch(error){
  console.warn('Feature state check skipped in assistant',error);
 }

 try{
  trackEvent('page_view',{page:'assistant'});
 }catch(error){
  console.warn('Assistant analytics skipped',error);
 }
}

initializeAssistant();


async function loadOfficialQuickActions(){
 const target=document.querySelector('#officialQuickActions');if(!target)return;
 const defaults=[
  ['🎓','كيف أدخل EduWave؟'],['🖥️','أين رابط Moodle؟'],['🩺','كيف أقدم عذرًا طبيًا؟'],['📄','كيف أقدم عذرًا غير طبي؟'],['🗓️','أين التقويم الأكاديمي الرسمي؟']
 ];
 let actions=defaults;
 try{
  const rows=await get('useful_sites','select=title_ar,icon&active=eq.true&category=eq.university&order=sort_order.asc&limit=8');
  if(rows.length)actions=rows.map(x=>[x.icon||'🔗',`أعطني رابط ${x.title_ar} الرسمي`]);
 }catch{}
 target.innerHTML=actions.map(([icon,q])=>`<button type="button" data-official-question="${esc(q)}"><span>${esc(icon)}</span>${esc(q)}</button>`).join('');
 target.querySelectorAll('[data-official-question]').forEach(b=>b.onclick=()=>submitQuestion(b.dataset.officialQuestion));
}
loadOfficialQuickActions();
