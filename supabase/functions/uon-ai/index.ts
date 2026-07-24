const corsHeaders={
 'Access-Control-Allow-Origin':'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST,OPTIONS'
};

const requests=new Map<string,{count:number,reset:number}>();

function json(body:any,status=200){
 return new Response(JSON.stringify(body),{
  status,
  headers:{...corsHeaders,'Content-Type':'application/json'}
 });
}

function cleanText(value:any,max=8000){
 return String(value||'').replace(/\s+/g,' ').trim().slice(0,max);
}

function checkRateLimit(req:Request){
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  ||req.headers.get('cf-connecting-ip')
  ||'unknown';
 const now=Date.now();
 const current=requests.get(ip);

 if(!current||current.reset<now){
  requests.set(ip,{count:1,reset:now+60_000});
  return true;
 }

 if(current.count>=12)return false;
 current.count++;
 requests.set(ip,current);
 return true;
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{status:204,headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(!checkRateLimit(req))return json({error:'تم تجاوز الحد المؤقت. حاول بعد دقيقة.'},429);

 try{
  const apiKey=Deno.env.get('GEMINI_API_KEY');
  if(!apiKey)return json({error:'GEMINI_API_KEY is not configured'},503);

  const body=await req.json();
  const question=cleanText(body?.question,800);
  const context=Array.isArray(body?.context)?body.context.slice(0,12):[];
  const history=Array.isArray(body?.history)?body.history.slice(-6):[];

  if(question.length<2)return json({error:'السؤال قصير جدًا'},400);

  const contextText=context.map((item:any,index:number)=>
   `${index+1}. النوع: ${cleanText(item.type,40)}
العنوان: ${cleanText(item.title,180)}
الوصف: ${cleanText(item.description,400)}
الرابط: ${cleanText(item.url,500)}`
  ).join('\n\n');

  const historyText=history.map((item:any)=>
   `${item.role==='assistant'?'المساعد':'الطالب'}: ${cleanText(item.content,600)}`
  ).join('\n');

  const systemInstruction=`أنت مساعد منصة UON Hub لطلاب جامعة نزوى.
أجب باللغة التي يستخدمها الطالب، وبأسلوب واضح ومختصر وودود.
اعتمد على سياق المنصة المرفق عندما يكون السؤال عن المواد أو الملخصات أو المجموعات أو البرامج أو المواعيد أو الروابط الرسمية. الروابط المصنفة كموقع داخل السياق هي الروابط التي تديرها المنصة، ولا تستخدم أي رابط غير مرفق.
لا تدّعِ وجود معلومة غير موجودة في السياق.
عندما لا يدعم السياق إجابة دقيقة، قل بوضوح إن المعلومة غير متوفرة داخل المنصة واقترح الصفحة المناسبة.
لا تطلب بيانات شخصية أو كلمة مرور أو الرقم الجامعي.
لا تنشئ روابط من عندك.
لا تستخدم Markdown معقدًا؛ استخدم فقرات قصيرة عند الحاجة.`;


const prompt=`${historyText?`المحادثة السابقة:\n${historyText}\n\n`:''}
بيانات مرتبطة من منصة UON Hub:
${contextText||'لا توجد نتائج مرتبطة مباشرة.'}

سؤال الطالب:
${question}`;

  const response=await fetch(
   'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
   {
    method:'POST',
    headers:{
     'x-goog-api-key':apiKey,
     'Content-Type':'application/json'
    },
    body:JSON.stringify({
     system_instruction:{parts:[{text:systemInstruction}]},
     contents:[{role:'user',parts:[{text:prompt}]}],
     generationConfig:{
      maxOutputTokens:700,
      temperature:0.25
     }
    })
   }
  );

  const raw=await response.text();
  let data:any;
  try{data=raw?JSON.parse(raw):{}}catch{data={error:{message:raw}}}

  if(!response.ok){
   console.error('Gemini error',response.status,data);
   return json({error:data?.error?.message||'تعذر الاتصال بخدمة الذكاء الاصطناعي'},502);
  }

  const answer=data?.candidates?.[0]?.content?.parts
   ?.map((part:any)=>part.text||'')
   .join('')
   .trim();

  if(!answer)return json({error:'لم يتم إنشاء إجابة'},502);

  return json({
   answer,
   links:context.slice(0,5).map((item:any)=>({
    type:cleanText(item.type,40),
    title:cleanText(item.title,180),
    url:cleanText(item.url,500)
   }))
  });
 }catch(error){
  console.error(error);
  return json({error:'تعذر معالجة السؤال حاليًا'},500);
 }
});
