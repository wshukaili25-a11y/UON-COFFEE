const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
const headers={apikey:SUPABASE_KEY,'Content-Type':'application/json'};
const sessionId=crypto.randomUUID();

const groups=[
  ['لاب تكنولوجيا التعليم سكشن ٢','https://chat.whatsapp.com/JFsqiuZmHpVJSslg5jKTB5?mode=gi_t'],
  ['علم النفس التربوي سكشن ٢','https://chat.whatsapp.com/HykJ95r7y3YInwvz1yBTyO?mode=gi_t'],
  ['القياس النفسي والتقويم التربوي سكشن ٢','https://chat.whatsapp.com/JniRsTyHiW4H2S12hICJI1?mode=gi_t'],
  ['المناهج والتدريس سكشن ٢','https://chat.whatsapp.com/LcMjIi8WzfyE3loUmKhqZ8?mode=gi_t'],
  ['طرق التدريس سكشن ٢','https://chat.whatsapp.com/E8k9MryKhd9CgALZouvuo3?mode=gi_t'],
  ['اصول التربيه سكشن ٢','https://chat.whatsapp.com/GSYQnx3xQqTHdGzYOIk1ap?mode=gi_t']
];

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const duplicateText=text=>/موجودة مسبقًا|مرسلة للمراجعة مسبقًا/i.test(text);
let failures=[];

for(let i=0;i<groups.length;i++){
  const [subject,link]=groups[i];
  try{
    const res=await fetch(`${SUPABASE_URL}/rest/v1/rpc/uon_submit_whatsapp_group_v2`,{
      method:'POST',headers,cache:'no-store',
      body:JSON.stringify({
        p_subject:subject,
        p_course_code:null,
        p_college:'كلية العلوم والآداب',
        p_link:link,
        p_description:null,
        p_session_id:sessionId
      })
    });
    const text=await res.text();
    if(!res.ok){
      if(duplicateText(text)){
        console.log(`UON_GROUP_SUBMIT SKIP ${subject} ${text.replace(/\s+/g,' ').slice(0,220)}`);
      }else{
        console.error(`UON_GROUP_SUBMIT FAIL ${subject} status=${res.status} ${text.replace(/\s+/g,' ').slice(0,300)}`);
        failures.push(`${subject}: ${res.status}`);
      }
    }else{
      let id=text;
      try{id=JSON.parse(text)}catch{}
      id=String(id??'').replace(/^"|"$/g,'');
      console.log(`UON_GROUP_SUBMIT OK ${subject} ${id}`);
      try{
        const notify=await fetch(`${SUPABASE_URL}/functions/v1/public-submit-notify`,{
          method:'POST',headers,cache:'no-store',body:JSON.stringify({table:'whatsapp_groups',id})
        });
        const notifyText=await notify.text();
        if(notify.ok) console.log(`UON_GROUP_NOTIFY OK ${subject} ${id}`);
        else console.warn(`UON_GROUP_NOTIFY WARN ${subject} status=${notify.status} ${notifyText.replace(/\s+/g,' ').slice(0,220)}`);
      }catch(error){
        console.warn(`UON_GROUP_NOTIFY WARN ${subject} ${String(error?.message||error)}`);
      }
    }
  }catch(error){
    console.error(`UON_GROUP_SUBMIT FAIL ${subject} ${String(error?.message||error)}`);
    failures.push(`${subject}: network`);
  }

  if(i<groups.length-1){
    console.log('UON_GROUP_SUBMIT WAIT 22s');
    await sleep(22000);
  }
}

if(failures.length){
  throw new Error(`Group submission failures: ${failures.join(' | ')}`);
}
console.log('UON_GROUP_SUBMIT COMPLETE');
