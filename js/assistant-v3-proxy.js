const nativeFetch=window.fetch.bind(window);
const API_MARKER='/functions/v1/uon-ai-v3';

function cleanInlineLinks(text=''){
 return String(text)
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,'$1')
  .replace(/\n{3,}/g,'\n\n')
  .trim();
}

function courseCode(question=''){
 return String(question).toUpperCase().match(/\b[A-Z]{2,10}\s*\d{2,4}[A-Z]?\b/)?.[0]?.replace(/\s+/g,'')||'';
}

function normalizeResult(data,question,language){
 if(!data||typeof data!=='object'||!data.answer)return data;
 const isEnglish=language==='en';
 data.answer=cleanInlineLinks(data.answer);

 if(data.mode==='course'){
  const code=courseCode(question);
  data.links=(Array.isArray(data.links)?data.links:[]).filter(link=>{
   const value=`${link?.title||''} ${link?.url||''}`.toUpperCase();
   return !code||value.includes(code)||String(link?.url||'').includes('/course.html');
  }).slice(0,2);
  data.sources_count=Math.max(1,data.links.length||1);
  data.confidence=Math.max(Number(data.confidence||0),.9);
 }

 if(data.mode==='gpa'&&!data.grounded){
  data.answer=isEnglish
   ?'## GPA calculation\n\n- Multiply each course grade point by its credit hours.\n- Add all quality points.\n- Divide by the total credit hours.\n\nUse the UON Hub GPA calculator below to calculate it directly.'
   :'## طريقة حساب المعدل\n\n- اضرب نقاط كل مادة في عدد ساعاتها.\n- اجمع كل النقاط الناتجة.\n- اقسم المجموع على إجمالي الساعات.\n\nاستخدم حاسبة المعدل الموجودة تحت عشان تحسبه مباشرة.';
  data.confidence=.88;
  data.sources_count=0;
 }

 if(data.mode==='links'){
  data.answer=data.answer
   .replace(/\* \*\*المصدر الرسمي للجامعة:[\s\S]*$/,'')
   .replace(/\* \*\*Official university source:[\s\S]*$/i,'')
   .trim();
 }

 return data;
}

window.fetch=async function(input,init={}){
 const response=await nativeFetch(input,init);
 const url=typeof input==='string'?input:input?.url||'';
 if(!url.includes(API_MARKER)||String(init?.method||'GET').toUpperCase()!=='POST')return response;

 let requestBody={};
 try{requestBody=JSON.parse(init?.body||'{}')}catch{}
 if(requestBody.action==='feedback')return response;

 try{
  const data=await response.clone().json();
  const normalized=normalizeResult(data,requestBody.question,requestBody.language);
  const headers=new Headers(response.headers);
  headers.set('Content-Type','application/json; charset=utf-8');
  return new Response(JSON.stringify(normalized),{status:response.status,statusText:response.statusText,headers});
 }catch{
  return response;
 }
};
