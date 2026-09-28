import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import vm from 'node:vm';

const root = new URL('./', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;

// Resolve the legacy V8 presentation transform at build time. Only the four
// checked-in payload parts can be read; document.write captures, never runs, HTML.
const legacy = gunzipSync(Buffer.from(await read('base-loader-v8.gz.b64'), 'base64')).toString();
const legacyScript = [...legacy.matchAll(scriptPattern)][0][1];
let html = '';
await vm.runInNewContext(legacyScript, {
  fetch: async url => {
    const name = new URL(url).pathname.split('/').pop();
    if (!/^p[1-4]\.txt$/.test(name)) throw new Error(`Unexpected build input: ${name}`);
    return new Response(await read(name));
  },
  atob, escape, decodeURIComponent, Uint8Array, Blob, Response, DecompressionStream,
  window: { DecompressionStream },
  console,
  document: {
    open() {}, close() {}, write(value) { html = value; },
    body: { set innerHTML(value) { throw new Error(`Legacy build failed: ${value}`); } },
  },
});
if (!html.includes('function bookingPage()')) throw new Error('Missing base application');

// The previous QR patch duplicated async and prevented the entire app parsing.
html = html.replace('async async function scanBarcodeToField', 'async function scanBarcodeToField');
html = html.replace('<html>', '<html lang="en" data-anjiz-build="20260928-v33">');
// Keep the base script separate from add-ons, and preserve replacement tokens
// such as $& literally by always using replacement callbacks.
for (const [index, match] of [...html.matchAll(scriptPattern)].entries()) {
  new vm.Script(match[1], { filename: `base-${index}.js` });
}

const scripts = [];
const styles = [];
function addScript(name, code) {
  new vm.Script(code, { filename: name });
  scripts.push(`<script data-anjiz-module="${name}">\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`);
}
function addStyle(name, css) {
  if (/<\/?(?:script|style)\b/i.test(css)) throw new Error(`HTML in CSS: ${name}`);
  styles.push(`<style data-anjiz-module="${name}">\n${css}\n</style>`);
}

// Calendar and reports were previously fetched from old Git commits. Vendor the
// exact existing versions, then load every dependent module in a fixed order.
addScript('appointments-core', await read('runtime/appointments-core.js'));
addStyle('appointments', (await read('appointments-v9.css')).split('</style>')[0]);
addScript('booking', (await read('booking-v10.js')).replace("let choose=me.role!=='student'", "let choose=['admin','peer','trainee'].includes(me.role)"));
addStyle('booking', await read('booking-v10.css'));
addScript('attendance', await read('attendance-v11.js'));
addStyle('attendance', await read('attendance-v11.css'));
addScript('reports-core', await read('runtime/reports-core.js'));
addStyle('reports', await read('reports-v12.css'));

const modules = [
  ['timetable-v13', 'TIMETABLE'], ['comms-v14', 'COMMS'],
  ['registration-v15', 'REGISTRATION'], ['instructor-v16', 'INSTRUCTOR'],
  ['student-v18', 'STUDENT'], ['student-v18-fix', 'STUDENT_FIX'],
  ['demo-v19', 'DEMO_V19'], ['qr-v20', 'QR_V20'],
];
for (const [name, markerName] of modules) {
  // Node decodes the legacy student's excess Base64 padding. Browsers no longer
  // have to decode these individual packs or wait for their remote requests.
  const decoded = gunzipSync(Buffer.from((await read(`${name}.pack.b64`)).trim(), 'base64')).toString();
  const marker = `/*__ANJIZ_${markerName}_CSS_SPLIT__*/`;
  const index = decoded.indexOf(marker);
  if (index < 0) throw new Error(`Missing CSS delimiter: ${name}`);
  addScript(name, decoded.slice(0, index));
  addStyle(name, decoded.slice(index + marker.length));
}
addScript('final', await read('final-v27.js'));
addStyle('final', await read('final-v27.css'));

let enhancements = (await read('appointments-v9.js')).split('/* ANJIZ V31')[0];
enhancements = enhancements.replace(/^\s*fetch\(STABLE_APPOINTMENTS[^\n]*$/m, '');
enhancements = enhancements.replace(/installLoginScanner\(\);let scanInstall=0;[^\n]*/, '');
addScript('attendance-qr-enhancements', enhancements);
addScript('qr-login', await read('qr-login-v31.js'));
addScript('ready', `
scanBarcodeToField = window.anjizQrScanV31;
window.scanLoginId = () => scanBarcodeToField('loginId');
window.__anjizBuild = '20260928-v33';
window.__anjizLoadedModulesV27 = { reports:true, timetable:true, communications:true, registration:true, instructor:true, student:true, demo:true, qr:true, final:true };
document.documentElement.dataset.anjizBuild = '20260928-v33';
document.documentElement.dataset.anjizReady = 'true';
`);
html = html.replace('</head>', () => styles.join('\n') + '\n</head>');
// Anchor at the actual final body tag, not inside an exported report template.
html = html.replace(/<\/body>\s*<\/html>\s*$/, () => scripts.join('\n') + '\n</body></html>');
const parsedScripts = [...html.matchAll(scriptPattern)];
if (parsedScripts.length !== scripts.length + 1) throw new Error('Broken HTML script boundaries');
for (const [index, match] of parsedScripts.entries()) new vm.Script(match[1], { filename: `output-${index}.js` });
if (html.includes('async async')) throw new Error('Duplicate async remains');

await writeFile(new URL('index.html', root), html);
// The existing Vercel entry fetches this path. Keep that URL stable while
// publishing the entire assembled app atomically in a single payload.
const packed = gzipSync(Buffer.from(html), { level: 9, mtime: 0 }).toString('base64');
await writeFile(new URL('v16-full-loader.pack.b64', root), packed);
console.log(`ANJIZ V33: ${parsedScripts.length} validated scripts; ${Buffer.byteLength(html)} HTML bytes; ${packed.length} packed bytes.`);
