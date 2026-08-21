import { generateText } from 'ai';

const MODEL = process.env.AI_MODEL || 'openai/gpt-4o-mini';

const SYSTEM = `You are UON AI, the friendly AI assistant inside UON Hub for University of Nizwa students.
Answer naturally and helpfully in Arabic by default, using an Omani-friendly conversational tone when appropriate. Use English when the user asks in English.
Do not claim official university affiliation. UON Hub is an independent student project.
Do not invent university policies, dates, links, courses, grades, or services. If you do not know something, say so clearly.
Keep answers concise unless the user asks for detail.`;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function providerConfig() {
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (gatewayKey) return { kind: 'gateway', key: gatewayKey };
  if (openaiKey) return { kind: 'openai', key: openaiKey };
  return null;
}

async function directOpenAI(messages, language) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is missing');
  const model = process.env.AI_MODEL?.startsWith('openai/')
    ? process.env.AI_MODEL.slice(7)
    : (process.env.AI_MODEL || 'gpt-4o-mini');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: `${SYSTEM}\nPreferred response language: ${language === 'en' ? 'English' : 'Arabic'}.` },
        ...messages
      ],
      temperature: 0.4,
      max_tokens: 900
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const { question, history = [], language = 'ar' } = req.body || {};
    const text = String(question || '').trim();
    if (!text) return json(res, 400, { error: 'Question is required' });
    if (text.length > 4000) return json(res, 400, { error: 'Question is too long' });

    const provider = providerConfig();
    if (!provider) return json(res, 503, { error: 'AI provider is not configured', code: 'MISSING_AI_KEY' });

    const messages = Array.isArray(history)
      ? history.slice(-8)
          .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [];
    messages.push({ role: 'user', content: text });

    let answer = '';
    if (provider.kind === 'openai') {
      answer = await directOpenAI(messages, language);
    } else {
      const result = await generateText({
        model: MODEL,
        system: `${SYSTEM}\nPreferred response language: ${language === 'en' ? 'English' : 'Arabic'}.`,
        messages,
        maxOutputTokens: 900,
        temperature: 0.4
      });
      answer = result.text?.trim() || '';
    }

    if (!answer) throw new Error('AI returned an empty response');
    return json(res, 200, { answer, links: [], grounded: false, confidence: 0, sources_count: 0 });
  } catch (error) {
    console.error('UON AI error:', error);
    return json(res, 502, { error: 'AI provider request failed', code: 'AI_PROVIDER_ERROR' });
  }
}
