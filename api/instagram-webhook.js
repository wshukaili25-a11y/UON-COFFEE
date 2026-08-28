import crypto from 'node:crypto';

export const config = { api: { bodyParser: false } };

const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN?.trim();
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
const IG_USER_ID = process.env.INSTAGRAM_IG_USER_ID?.trim();
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET?.trim();
const API_VERSION = process.env.INSTAGRAM_API_VERSION?.trim() || 'v24.0';
const GRAPH_BASE = (process.env.INSTAGRAM_GRAPH_BASE_URL?.trim() || 'https://graph.instagram.com').replace(/\/$/, '');
const AI_ENDPOINT = process.env.UON_AI_ENDPOINT?.trim();
const AI_KEY = process.env.UON_AI_API_KEY?.trim();

function text(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function validSignature(raw, signature) {
  if (!APP_SECRET) return true;
  if (!signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', APP_SECRET).update(raw).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function localAiUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers.host;
  return `${proto}://${host}/api/uon-ai`;
}

async function askUonAi(req, question) {
  const endpoint = AI_ENDPOINT || localAiUrl(req);
  const headers = { 'Content-Type': 'application/json' };
  if (AI_KEY) {
    headers.Authorization = `Bearer ${AI_KEY}`;
    headers.apikey = AI_KEY;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ question, language: /[\u0600-\u06FF]/.test(question) ? 'ar' : 'en', history: [] }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `UON AI HTTP ${response.status}`);
    return String(data?.answer || '').trim();
  } finally {
    clearTimeout(timeout);
  }
}

function splitMessage(value, max = 900) {
  const text = String(value || '').trim();
  if (!text) return [];
  const chunks = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.55) cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.55) cut = max;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function sendInstagramText(recipientId, message) {
  if (!ACCESS_TOKEN || !IG_USER_ID) throw new Error('Instagram credentials are not configured');
  const url = `${GRAPH_BASE}/${API_VERSION}/${encodeURIComponent(IG_USER_ID)}/messages`;

  for (const chunk of splitMessage(message)) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: chunk } })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `Instagram HTTP ${response.status}`);
  }
}

function extractMessages(payload) {
  const items = [];
  for (const entry of payload?.entry || []) {
    for (const event of entry?.messaging || []) {
      if (!event?.sender?.id || event?.message?.is_echo) continue;
      if (event?.message?.text) {
        items.push({ senderId: String(event.sender.id), text: String(event.message.text).trim() });
      } else if (event?.message?.attachments?.length) {
        items.push({ senderId: String(event.sender.id), attachmentOnly: true });
      }
    }
  }
  return items;
}

async function handleMessage(req, item) {
  if (item.attachmentOnly) {
    await sendInstagramText(item.senderId, 'حاليًا أقدر أتعامل مع الرسائل النصية فقط 🤖 اكتب سؤالك وأنا أساعدك.');
    return;
  }

  const question = item.text.slice(0, 1200);
  const answer = await askUonAi(req, question);
  await sendInstagramText(item.senderId, answer || 'ما قدرت أحصل جواب موثوق حاليًا. جرّب تكتب سؤالك بشكل أوضح.');
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];

    if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      return text(res, 200, String(challenge || ''));
    }
    return text(res, 403, 'Forbidden');
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const raw = await rawBody(req);
    const signature = req.headers['x-hub-signature-256'];
    if (!validSignature(raw, Array.isArray(signature) ? signature[0] : signature)) {
      return json(res, 401, { error: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(raw.toString('utf8') || '{}');
    if (payload?.object !== 'instagram') return json(res, 200, { received: true, ignored: true });

    const messages = extractMessages(payload).slice(0, 10);
    const results = await Promise.allSettled(messages.map(item => handleMessage(req, item)));
    const failed = results.filter(result => result.status === 'rejected');
    for (const failure of failed) console.error('Instagram UON AI message failed:', failure.reason);

    return json(res, 200, { received: true, processed: messages.length, failed: failed.length });
  } catch (error) {
    console.error('Instagram webhook error:', error);
    return json(res, 500, { error: 'Webhook processing failed' });
  }
}
