// V44 tools overlay with a real fallback to the restored admin command core.
// The imported overlay historically forwards unhandled updates back to
// telegram-admin-full. Rewrite only that internal fallback to telegram-admin-core
// so commands do not recurse or disappear.
const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.includes('/functions/v1/telegram-admin-full')) {
    const target = url.replace('/functions/v1/telegram-admin-full', '/functions/v1/telegram-admin-core');
    return originalFetch(target, init);
  }
  return originalFetch(input, init);
};

await import('https://raw.githubusercontent.com/wshukaili25-a11y/UON-COFFEE/1a0b75da905f345138885b3fa217da3a7a4f897e/supabase/functions/telegram-admin/index.ts');
