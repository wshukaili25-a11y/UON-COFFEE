import { readFile } from 'node:fs/promises';

const checks=[
  {
    file:'js/google-auth-status-v641.js',
    must:['/auth/v1/settings','external?.google===true','cache:\'no-store\''],
    mustNot:['client_secret','service_role']
  },
  {
    file:'js/google-connect-v641.js',
    must:['calendar.events.readonly','drive.file','providerStatus?.enabled!==true','uon-google-account-v64'],
    mustNot:['drive.readonly','calendar.events ']
  },
  {
    file:'js/assistant.js',
    must:['optionalGoogleAuthHeaders','getGoogleAuthStatus','[data-prompt*="Google"]'],
    mustNot:['provider_token']
  },
  {
    file:'supabase/functions/uon-ai-chat-v64/index.ts',
    must:['privateIntent(question)','calendar-upcoming','drive-files','google_calendar_private','google_drive_private','private:true'],
    mustNot:['uon_ai_knowledge', 'provider_token']
  },
  {
    file:'supabase/functions/uon-google-account-v64/index.ts',
    must:['calendar.events.readonly','drive.file','uon_google_get_tokens','uon_google_disconnect'],
    mustNot:['drive.readonly','calendar.events ']
  },
  {
    file:'supabase/migrations/20260902204500_v641_google_personal_connections.sql',
    must:['revoke all on function public.uon_google_get_tokens(uuid) from public, anon, authenticated','grant execute on function public.uon_google_get_tokens(uuid) to service_role','enable row level security','vault.create_secret'],
    mustNot:['grant execute on function public.uon_google_get_tokens(uuid) to authenticated']
  }
];

const failures=[];
for(const check of checks){
  let source='';
  try{source=await readFile(check.file,'utf8')}catch(error){failures.push(`${check.file}: ${error.message}`);continue}
  const compact=source.replace(/\s+/g,'');
  for(const expected of check.must||[]){
    const found=expected==='private:true'?compact.includes(expected):source.includes(expected);
    if(!found)failures.push(`${check.file}: missing invariant ${JSON.stringify(expected)}`);
  }
  for(const forbidden of check.mustNot||[])if(source.includes(forbidden))failures.push(`${check.file}: forbidden pattern ${JSON.stringify(forbidden)}`);
}

if(failures.length){
  console.error(`Google V64.1 verification failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Google V64.1 verification passed (${checks.length} privacy/readiness files checked).`);
