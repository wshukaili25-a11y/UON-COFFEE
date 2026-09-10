const url='https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-migration-history-read-v67';
try {
  const response=await fetch(url,{cache:'no-store'});
  const text=await response.text();
  console.log(`UON_MIGRATION_HISTORY status=${response.status}`);
  console.log(`UON_MIGRATION_HISTORY_BODY ${text}`);
} catch (error) {
  console.log(`UON_MIGRATION_HISTORY_ERROR ${String(error?.message||error)}`);
}
