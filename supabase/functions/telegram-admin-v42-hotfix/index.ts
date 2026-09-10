// UON Hub Telegram webhook router hotfix v67.0.4.
// This wrapper is deployed as the live `telegram-admin-v42` function.
// It normalizes Telegram's harmless identical-edit 400 response before the
// pinned router/its helpers can turn it into a user-facing error message.
const nativeFetch = globalThis.fetch.bind(globalThis);

function isTelegramEdit(url: string) {
  return /^https:\/\/api\.telegram\.org\/bot[^/]+\/editMessage/i.test(url);
}

function isUnchangedMessageError(text: string) {
  const value = String(text || '').toLowerCase();
  return value.includes('message is not modified') ||
    value.includes('specified new message content and reply markup are exactly the same') ||
    value.includes('message content and reply markup are exactly the same');
}

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  const response = await nativeFetch(input, init);
  if (isTelegramEdit(url) && !response.ok) {
    try {
      const text = await response.clone().text();
      if (isUnchangedMessageError(text)) {
        return new Response(JSON.stringify({
          ok: true,
          result: true,
          unchanged: true,
          description: 'message unchanged; treated as successful no-op'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json; charset=utf-8' }
        });
      }
    } catch {
      // Preserve the real response for every other Telegram failure.
    }
  }
  return response;
};

// Pin the known v42 router so the deployed runtime is deterministic.
await import('https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/651e6b7df1af2a05d8a935c9fab706fb5da54233/supabase/functions/telegram-admin-v42/index.ts');
