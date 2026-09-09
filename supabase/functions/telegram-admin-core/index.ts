// Canonical legacy/admin command engine restored as a pinned, immutable fallback.
// Telegram returns HTTP 400 when an edit is identical to the current message.
// That is a harmless no-op, so normalize it to success before the legacy engine sees it.
const originalFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const result = await originalFetch(input, init);

  if (url.startsWith('https://api.telegram.org/bot') && !result.ok) {
    try {
      const text = await result.clone().text();
      const description = text.toLowerCase();
      if (description.includes('message is not modified')) {
        return new Response(JSON.stringify({ ok: true, result: true, unchanged: true }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' }
        });
      }
    } catch {}
  }

  return result;
};

await import('https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/8a5a505f7ac59942f98fc0019b95aa86a9348cde/supabase/functions/telegram-admin/index.ts');
