// UON Hub Telegram modern/dashboard route hotfix v67.0.4.
const nativeFetch = globalThis.fetch.bind(globalThis);
function unchanged(text: string) {
  const value = String(text || '').toLowerCase();
  return value.includes('message is not modified') ||
    value.includes('specified new message content and reply markup are exactly the same') ||
    value.includes('message content and reply markup are exactly the same');
}
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const response = await nativeFetch(input, init);
  if (/^https:\/\/api\.telegram\.org\/bot[^/]+\/editMessage/i.test(url) && !response.ok) {
    try {
      const text = await response.clone().text();
      if (unchanged(text)) return new Response(JSON.stringify({ok:true,result:true,unchanged:true}), {status:200,headers:{'content-type':'application/json; charset=utf-8'}});
    } catch {}
  }
  return response;
};
await import('https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/39f9b313c8342dedf03fb0a863b7c88409d85249/supabase/functions/telegram-admin-modern/index.ts');
