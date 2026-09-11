const TARGET='/rest/v1/rpc/uon_submit_exam_question_v2';
const EDGE='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/public-api-v67';
const FALLBACK_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';

if(!window.__uonQuestionsApiBridge){
  window.__uonQuestionsApiBridge=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const rawUrl=typeof input==='string'?input:(input instanceof Request?input.url:String(input||''));
    let url;
    try{url=new URL(rawUrl,location.href)}catch{return nativeFetch(input,init)}
    if(url.hostname!=='irkhvydgxpseflggbeqq.supabase.co'||url.pathname!==TARGET)return nativeFetch(input,init);

    let payload={};
    try{
      const body=init?.body??(input instanceof Request?await input.clone().text():'');
      payload=typeof body==='string'&&body?JSON.parse(body):{};
    }catch{
      return new Response(JSON.stringify({code:'invalid_json',message:'invalid_json'}),{status:400,headers:{'Content-Type':'application/json'}});
    }

    const sourceHeaders=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
    const apikey=sourceHeaders.get('apikey')||FALLBACK_KEY;
    try{
      const response=await nativeFetch(EDGE,{
        method:'POST',
        headers:{apikey,'Content-Type':'application/json'},
        body:JSON.stringify({
          action:'submit_exam_question',
          college:payload.p_college,
          subject:payload.p_subject,
          text:payload.p_text,
          session_id:payload.p_session_id,
          answer:payload.p_answer,
          type:payload.p_type,
          year:payload.p_year
        }),
        cache:'no-store',
        signal:init?.signal
      });
      const raw=await response.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{}
      if(response.ok&&data?.ok&&data?.id!=null){
        return new Response(JSON.stringify(String(data.id)),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
      }
      const code=data?.code||'submit_failed';
      return new Response(JSON.stringify({code,message:data?.message||code}),{status:response.status||503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    }catch(error){
      if(error?.name==='AbortError')throw error;
      return new Response(JSON.stringify({code:'service_unavailable',message:'service_unavailable'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    }
  };
}
