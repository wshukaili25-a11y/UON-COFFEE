const ENDPOINT='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-schedule-image-parser';
const PROXY='/api/schedule-parser';
const originalFetch=window.fetch.bind(window);

function clean(value){return String(value||'').trim()}
function courseKey(course,resultIndex,courseIndex){
  const code=clean(course?.course_code).toUpperCase();
  const name=clean(course?.course_name).replace(/\s+/g,' ').toLowerCase();
  const generated=/^IMAGE-\d+-COURSE-\d+$/i.test(code);
  if(code&&!generated)return`code:${code}`;
  if(name)return`name:${name}`;
  return`image:${resultIndex}:course:${courseIndex}`;
}
function mergeResults(results,total){
  const map=new Map();
  const terms=new Map();
  results.forEach((result,resultIndex)=>{
    const term=clean(result?.term);
    if(term)terms.set(term,(terms.get(term)||0)+1);
    (Array.isArray(result?.courses)?result.courses:[]).forEach((course,courseIndex)=>{
      const key=courseKey(course,resultIndex,courseIndex);
      if(!map.has(key)){
        const rawCode=clean(course?.course_code).toUpperCase();
        map.set(key,{
          course_code:/^IMAGE-\d+-COURSE-\d+$/i.test(rawCode)?`مادة ${map.size+1}`:rawCode,
          course_name:clean(course?.course_name),
          sections:[]
        });
      }
      const target=map.get(key);
      if(!target.course_name&&course?.course_name)target.course_name=clean(course.course_name);
      for(const section of (Array.isArray(course?.sections)?course.sections:[])){
        const sectionNo=clean(section?.section_no);
        if(!sectionNo)continue;
        let current=target.sections.find(item=>item.section_no===sectionNo);
        if(!current){
          current={
            section_no:sectionNo,
            instructor:clean(section?.instructor),
            capacity:0,
            enrolled:Number(section?.enrolled||0),
            meetings:[]
          };
          target.sections.push(current);
        }else{
          if(!current.instructor&&section?.instructor)current.instructor=clean(section.instructor);
          current.enrolled=Math.max(Number(current.enrolled||0),Number(section?.enrolled||0));
        }
        for(const meeting of (Array.isArray(section?.meetings)?section.meetings:[])){
          const normalized={day:clean(meeting?.day),start:clean(meeting?.start),end:clean(meeting?.end),room:clean(meeting?.room)};
          const meetingKey=`${normalized.day}|${normalized.start}|${normalized.end}|${normalized.room}`;
          if(!current.meetings.some(item=>`${item.day}|${item.start}|${item.end}|${item.room||''}`===meetingKey))current.meetings.push(normalized);
        }
      }
    });
  });
  const term=[...terms.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
  return{
    ok:true,
    term,
    courses:[...map.values()].filter(course=>course.sections.length),
    images_total:total,
    images_read:results.length,
    partial:results.length<total,
    batch_mode:'one_request_per_image'
  };
}
async function postOne(payload,image,index,signal){
  const response=await originalFetch(PROXY,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({...payload,images:[image],image_index:index}),
    signal,
    cache:'no-store',
    credentials:'same-origin'
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data?.error||`http_${response.status}`),{status:response.status,data});
  if(!Array.isArray(data?.courses)||!data.courses.length)throw new Error('no_sections_found');
  return data;
}
async function readOneWithRetry(payload,image,index,signal){
  try{return await postOne(payload,image,index,signal)}catch(firstError){
    if(signal?.aborted||firstError?.status===429||firstError?.status===401||firstError?.status===403)throw firstError;
    await new Promise(resolve=>setTimeout(resolve,250));
    return postOne(payload,image,index,signal);
  }
}

window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:(input?.url||'');
  if(url!==ENDPOINT)return originalFetch(input,init);
  let payload={};
  try{payload=JSON.parse(String(init?.body||'{}'))}catch{}
  const images=Array.isArray(payload.images)?payload.images:[];
  if(images.length<=1){
    return originalFetch(PROXY,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload),
      signal:init?.signal,
      cache:'no-store',
      credentials:'same-origin'
    });
  }
  try{
    const settled=await Promise.allSettled(images.map((image,index)=>readOneWithRetry(payload,image,index,init?.signal)));
    const results=[];
    const errors=[];
    settled.forEach((item,index)=>{
      if(item.status==='fulfilled')results.push(item.value);
      else errors.push(`image_${index+1}:${clean(item.reason?.message||item.reason)}`);
    });
    if(errors.length){
      return new Response(JSON.stringify({error:'partial_image_failure',image_errors:errors,images_total:images.length,images_read:results.length}),{
        status:502,
        headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
      });
    }
    return new Response(JSON.stringify(mergeResults(results,images.length)),{
      status:200,
      headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
    });
  }catch(error){
    if(error?.name==='AbortError')throw error;
    return new Response(JSON.stringify({error:'batch_parser_failed'}),{
      status:502,
      headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
    });
  }
};
