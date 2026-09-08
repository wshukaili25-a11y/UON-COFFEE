const SUPABASE_URL='https://irkhvydgxpseflggbeqq.supabase.co';
const SUPABASE_KEY='sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';

function classify(status,text=''){
 const value=String(text||'');
 if(status>=200&&status<300)return'ready';
 if(status===404||/PGRST(202|205)|Could not find|not found/i.test(value))return'missing';
 if(status===400&&/invalid_session|invalid_sections|invalid_image|invalid_request|bad request|question|query|required/i.test(value))return'ready';
 if(status===401&&/invalid_api_key/i.test(value))return'ready_key_rejected';
 if((status===401||status===403)&&/permission denied|not authorized|JWT|authorization|forbidden|unauthorized/i.test(value))return'exists_but_blocked';
 return'error';
}
async function probe(name,url,init={}){
 try{const response=await fetch(url,{cache:'no-store',...init});const text=await response.text();return{name,status:response.status,state:classify(response.status,text),detail:text.slice(0,260)}}
 catch(error){return{name,status:0,state:'network_error',detail:String(error?.message||error).slice(0,260)}}
}

export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
 const common={apikey:SUPABASE_KEY,'content-type':'application/json'};
 const checks=await Promise.all([
  probe('public_state_rpc',`${SUPABASE_URL}/rest/v1/rpc/uon_public_state`,{method:'POST',headers:common,body:'{}'}),
  probe('groups_public_view',`${SUPABASE_URL}/rest/v1/public_whatsapp_groups?select=id&limit=1`,{headers:common}),
  probe('summaries_public_view',`${SUPABASE_URL}/rest/v1/public_summaries?select=id&limit=1`,{headers:common}),
  probe('support_centers',`${SUPABASE_URL}/rest/v1/support_centers?select=id&active=eq.true&limit=1`,{headers:common}),
  probe('university_programs',`${SUPABASE_URL}/rest/v1/university_programs?select=id&active=eq.true&limit=1`,{headers:common}),
  probe('global_search_rpc',`${SUPABASE_URL}/rest/v1/rpc/uon_global_search_v44`,{method:'POST',headers:common,body:JSON.stringify({p_query:'COMP',p_limit:1,p_language:'ar'})}),
  probe('contact_rpc',`${SUPABASE_URL}/rest/v1/rpc/uon_public_contact_numbers`,{method:'POST',headers:common,body:'{}'}),
  probe('contact_table',`${SUPABASE_URL}/rest/v1/contact_numbers?select=label,phone,sort_order,is_visible&is_visible=eq.true&order=sort_order.asc&limit=1`,{headers:common}),
  probe('schedule_observations_table',`${SUPABASE_URL}/rest/v1/uon_student_section_observations?select=id&limit=1`,{headers:common}),
  probe('schedule_confirm_rpc',`${SUPABASE_URL}/rest/v1/rpc/uon_confirm_schedule_sections`,{method:'POST',headers:common,body:JSON.stringify({p_session_id:'00000000-0000-4000-8000-000000000000',p_client_token:'short',p_sections:[],p_term:null})}),
  probe('schedule_ingest_rpc',`${SUPABASE_URL}/rest/v1/rpc/uon_ingest_schedule_extraction`,{method:'POST',headers:common,body:JSON.stringify({p_session_id:'00000000-0000-4000-8000-000000000000',p_client_token:'short',p_term:null,p_model:'probe',p_courses:[]})}),
  probe('schedule_parser_options',`${SUPABASE_URL}/functions/v1/uon-schedule-image-parser`,{method:'OPTIONS',headers:{...common,origin:'https://uonhub.space'}}),
  probe('schedule_parser_post',`${SUPABASE_URL}/functions/v1/uon-schedule-image-parser`,{method:'POST',headers:{...common,origin:'https://uonhub.space'},body:'{}'}),
  probe('uon_ai_chat',`${SUPABASE_URL}/functions/v1/uon-ai-chat-v64`,{method:'POST',headers:{...common,origin:'https://uonhub.space'},body:JSON.stringify({question:''})}),
  probe('telegram_admin_core',`${SUPABASE_URL}/functions/v1/telegram-admin-core`,{method:'POST',headers:common,body:'{}'})
 ]);
 const serverCredentials={SUPABASE_SERVICE_ROLE_KEY:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),SUPABASE_SERVICE_KEY:Boolean(process.env.SUPABASE_SERVICE_KEY),SUPABASE_SECRET_KEY:Boolean(process.env.SUPABASE_SECRET_KEY),SUPABASE_URL:Boolean(process.env.SUPABASE_URL)};
 const required=['public_state_rpc','groups_public_view','summaries_public_view','support_centers','university_programs','global_search_rpc','schedule_observations_table','schedule_confirm_rpc','schedule_ingest_rpc','schedule_parser_options','uon_ai_chat'];
 const ok=required.every(name=>{const state=checks.find(item=>item.name===name)?.state;return state&&state!=='missing'&&state!=='network_error'&&state!=='error'});
 res.setHeader('Cache-Control','no-store');return res.status(ok?200:503).json({ok,checked_at:new Date().toISOString(),serverCredentials,checks});
}
