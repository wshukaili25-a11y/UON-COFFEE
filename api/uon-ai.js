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

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const { question, history = [], language = 'ar' } = req.body || {};
    const text = String(question || '').trim();
    if (!text) return json(res, 400, { error: 'Question is required' });
    if (text.length > 4000) return json(res, 400, { error: 'Question is too long' });

    if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) {
      return json(res, 503, { error: 'AI provider is not configured' });
    }

    const messages = Array.isArray(history)
      ? history.slice(-8).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [];
    messages.push({ role: 'user', content: text });

    const result = await generateText({
      model: MODEL,
      system: `${SYSTEM}\nPreferred response language: ${language === 'en' ? 'English' : 'Arabic'}.`,
      messages,
      maxOutputTokens: 900,
      temperature: 0.4
    });

    return json(res, 200, {
      answer: result.text,
      links: [],
      grounded: false,
      confidence: 0,
      sources_count: 0
    });
  } catch (error) {
    console.error('UON AI error:', error);
    return json(res, 500, { error: 'UON AI request failed' });
  }
}
