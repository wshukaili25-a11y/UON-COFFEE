import {
  enforceUonMaintenance,
  watchUonMaintenance,
  applyFeatureStates,
  trackEvent,
} from './core.js?v=42.0.0';

const API = 'https://irkhvydgxpseflggbeqq.supabase.co/functions/v1/uon-ai-v3';
const STORAGE_KEY = 'uon_ai_v3_history';
const MAX_SAVED_MESSAGES = 30;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const messagesEl = $('#aiMessages');
const form = $('#aiForm');
const input = $('#aiInput');
const sendButton = $('#aiSend');
const newChatButtons = $$('#aiNewChat, #aiClearChat');
const toastEl = $('#aiToast');
const lang = () => localStorage.getItem('uon_language') === 'en' ? 'en' : 'ar';
const t = (ar, en) => lang() === 'en' ? en : ar;

let sending = false;
let state = loadState();
let lastQuestion = '';

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(-MAX_SAVED_MESSAGES) : [];
  } catch {
    return [];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.slice(-MAX_SAVED_MESSAGES)));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineMarkdown(value) {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return text;
}

function renderMarkdown(value) {
  const lines = String(value || '').replace(/\r/g, '').split('\n');
  const output = [];
  let listType = '';

  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = '';
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      closeList();
      output.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        output.push('<ul>');
      }
      output.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        output.push('<ol>');
      }
      output.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    closeList();
    output.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  closeList();
  return output.join('');
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

function scrollToBottom(smooth = true) {
  if (!messagesEl) return;
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

function emptyMarkup() {
  return `
    <section class="ai3-empty" id="aiEmpty">
      <div class="ai3-empty-icon">AI</div>
      <h2>${t('هلا، كيف أساعدك؟', 'Hi, how can I help?')}</h2>
      <p>${t('اسأل عن مادة، تخصص، رابط رسمي، موعد أكاديمي أو أي خدمة داخل UON Hub. الإجابات تعتمد على المصادر المتوفرة وتظهر لك تحت كل جواب.', 'Ask about a course, major, official link, academic date, or any UON Hub service. Answers are grounded in available sources shown below each response.')}</p>
      <div class="ai3-starters">
        <button class="ai3-starter" type="button" data-question="ماذا يوجد لمادة STAT101؟"><span>📘</span>${t('ماذا يوجد لمادة STAT101؟', 'What is available for STAT101?')}</button>
        <button class="ai3-starter" type="button" data-question="ما رابط EduWave الرسمي؟"><span>🔗</span>${t('ما رابط EduWave الرسمي؟', 'What is the official EduWave link?')}</button>
        <button class="ai3-starter" type="button" data-question="ما أقرب موعد مهم في التقويم الأكاديمي؟"><span>📅</span>${t('ما أقرب موعد مهم؟', 'What is the next important date?')}</button>
        <button class="ai3-starter" type="button" data-question="كيف أحسب المعدل التراكمي؟"><span>🧮</span>${t('كيف أحسب المعدل؟', 'How do I calculate GPA?')}</button>
      </div>
    </section>`;
}

function renderEmpty() {
  if (!messagesEl) return;
  messagesEl.innerHTML = emptyMarkup();
  bindQuestionButtons(messagesEl);
}

function messageRecord(role, content, extra = {}) {
  return {
    role,
    content: String(content || ''),
    request_id: extra.request_id || '',
    links: Array.isArray(extra.links) ? extra.links : [],
    actions: Array.isArray(extra.actions) ? extra.actions : [],
    suggestions: Array.isArray(extra.suggestions) ? extra.suggestions : [],
    grounded: Boolean(extra.grounded),
    confidence: Number(extra.confidence || 0),
    sources_count: Number(extra.sources_count || 0),
    timing: extra.timing || null,
    question: extra.question || '',
    created_at: extra.created_at || Date.now(),
  };
}

function sourceMarkup(links) {
  if (!Array.isArray(links) || !links.length) return '';
  return `
    <div class="ai3-sources">
      <div class="ai3-sources-title">${t('المصادر والروابط', 'Sources and links')}</div>
      ${links.map((item) => {
        const external = /^https?:/i.test(item.url || '');
        return `<a class="ai3-source${item.official ? ' official' : ''}" href="${escapeHtml(item.url || '#')}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ''}>
          <span class="ai3-source-icon">${item.official ? '✓' : '↗'}</span>
          <div><strong>${escapeHtml(item.title || item.url || t('مصدر', 'Source'))}</strong><small>${escapeHtml(item.official ? t('مصدر رسمي', 'Official source') : (item.type || t('بيانات UON Hub', 'UON Hub data')))}</small></div>
        </a>`;
      }).join('')}
    </div>`;
}

function actionsMarkup(actions) {
  if (!Array.isArray(actions) || !actions.length) return '';
  return `<div class="ai3-direct-actions">${actions.map((item) => `
    <a href="${escapeHtml(item.url || '#')}"><span>${escapeHtml(item.icon || '↗')}</span>${escapeHtml(item.label || '')}</a>
  `).join('')}</div>`;
}

function messageMarkup(item, index) {
  const isUser = item.role === 'user';
  const confidence = Math.round(Number(item.confidence || 0) * 100);
  const meta = !isUser ? `
    <div class="ai3-message-meta">
      ${item.grounded ? `<span class="ai3-grounded">${t('مدعوم بالمصادر', 'Grounded in sources')}</span>` : `<span>${t('إجابة عامة', 'General response')}</span>`}
      ${confidence ? `<span>${t('الثقة', 'Confidence')} ${confidence}%</span>` : ''}
      ${item.sources_count ? `<span>${item.sources_count} ${t('مصدر', 'sources')}</span>` : ''}
      ${item.timing?.total_ms ? `<span>${(item.timing.total_ms / 1000).toFixed(1)}s</span>` : ''}
      <span class="ai3-message-actions">
        <button class="ai3-mini-btn" type="button" data-copy-message="${index}" title="${t('نسخ', 'Copy')}">⧉</button>
        ${item.request_id ? `<button class="ai3-mini-btn" type="button" data-feedback="1" data-index="${index}" title="${t('مفيد', 'Helpful')}">👍</button><button class="ai3-mini-btn" type="button" data-feedback="-1" data-index="${index}" title="${t('غير مفيد', 'Not helpful')}">👎</button>` : ''}
      </span>
    </div>` : '';

  return `
    <article class="ai3-message ${isUser ? 'user' : 'assistant'}" data-message-index="${index}">
      <div class="ai3-avatar">${isUser ? t('أنت', 'You') : 'AI'}</div>
      <div class="ai3-message-card">
        <div class="ai3-message-body">${isUser ? `<p>${escapeHtml(item.content)}</p>` : renderMarkdown(item.content)}</div>
        ${!isUser ? sourceMarkup(item.links) + actionsMarkup(item.actions) : ''}
        ${meta}
      </div>
    </article>
    ${!isUser && item.suggestions?.length ? `<div class="ai3-followups">${item.suggestions.map((question) => `<button type="button" data-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`).join('')}</div>` : ''}`;
}

function renderHistory() {
  if (!messagesEl) return;
  if (!state.length) {
    renderEmpty();
    return;
  }
  messagesEl.innerHTML = state.map(messageMarkup).join('');
  bindQuestionButtons(messagesEl);
  bindMessageActions();
  scrollToBottom(false);
}

function addTyping() {
  const article = document.createElement('article');
  article.className = 'ai3-message assistant';
  article.id = 'aiTyping';
  article.innerHTML = `<div class="ai3-avatar">AI</div><div class="ai3-message-card"><div class="ai3-typing"><i></i><i></i><i></i></div></div>`;
  messagesEl?.appendChild(article);
  scrollToBottom();
  return article;
}

function setSending(value) {
  sending = value;
  if (sendButton) sendButton.disabled = value;
  if (input) input.disabled = value;
}

function historyForApi() {
  return state.slice(-10).map((item) => ({ role: item.role, content: item.content }));
}

async function requestAnswer(question) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        history: historyForApi(),
        language: lang(),
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.answer) {
      const error = new Error(data.message || data.error || `AI HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function ask(question) {
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion || sending) return;
  lastQuestion = cleanQuestion;
  if ($('#aiEmpty')) messagesEl.innerHTML = '';

  state.push(messageRecord('user', cleanQuestion));
  saveState();
  renderHistory();
  const typing = addTyping();
  setSending(true);
  if (input) {
    input.value = '';
    resizeInput();
  }

  try {
    trackEvent('assistant_question_v3', { query: cleanQuestion.slice(0, 100) });
    const result = await requestAnswer(cleanQuestion);
    typing.remove();
    state.push(messageRecord('assistant', result.answer, {
      ...result,
      question: cleanQuestion,
    }));
    saveState();
    renderHistory();
  } catch (error) {
    typing.remove();
    let message = t('تعذر الوصول إلى UON AI حاليًا. جرّب مرة ثانية بعد قليل.', 'UON AI is unavailable right now. Try again shortly.');
    if (/abort|timeout/i.test(String(error?.message || error))) {
      message = t('الرد تأخر أكثر من المتوقع. جرّب سؤالًا أقصر أو أعد المحاولة.', 'The response took too long. Try a shorter question or retry.');
    } else if (Number(error?.status) === 429) {
      message = t('أرسلت أسئلة كثيرة بسرعة 😅 انتظر دقيقة وجرب مرة ثانية.', 'Too many questions were sent quickly. Wait a minute and try again.');
    }
    state.push(messageRecord('assistant', message, {
      suggestions: [t('أعد المحاولة', 'Retry'), t('ابحث برمز مادة', 'Search by course code')],
      question: cleanQuestion,
    }));
    saveState();
    renderHistory();
  } finally {
    setSending(false);
    input?.focus();
  }
}

async function sendFeedback(index, rating, button) {
  const item = state[index];
  if (!item?.request_id) return;
  button.disabled = true;
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'feedback',
        request_id: item.request_id,
        rating,
        question: item.question,
        answer: item.content,
      }),
      cache: 'no-store',
    });
    button.classList.add('active');
    showToast(rating === 1 ? t('شكراً، تم تسجيل التقييم', 'Thanks, feedback saved') : t('تم تسجيل الملاحظة', 'Feedback saved'));
  } catch {
    showToast(t('تعذر حفظ التقييم', 'Could not save feedback'));
    button.disabled = false;
  }
}

function bindMessageActions() {
  $$('[data-copy-message]').forEach((button) => {
    button.addEventListener('click', async () => {
      const item = state[Number(button.dataset.copyMessage)];
      if (!item) return;
      try {
        await navigator.clipboard.writeText(item.content);
        showToast(t('تم نسخ الإجابة', 'Answer copied'));
      } catch {
        showToast(t('تعذر النسخ', 'Could not copy'));
      }
    });
  });

  $$('[data-feedback]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      const rating = Number(button.dataset.feedback) === -1 ? -1 : 1;
      sendFeedback(index, rating, button);
    });
  });
}

function bindQuestionButtons(root = document) {
  $$('[data-question]', root).forEach((button) => {
    if (button.dataset.bound === '1') return;
    button.dataset.bound = '1';
    button.addEventListener('click', () => {
      const question = button.dataset.question || button.textContent.trim();
      if (question === t('أعد المحاولة', 'Retry') && lastQuestion) {
        ask(lastQuestion);
        return;
      }
      ask(question);
    });
  });
}

function clearChat() {
  if (sending) return;
  state = [];
  lastQuestion = '';
  saveState();
  renderEmpty();
  input?.focus();
  showToast(t('بدأنا محادثة جديدة', 'New chat started'));
}

function resizeInput() {
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  ask(input?.value);
});

input?.addEventListener('input', resizeInput);
input?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    ask(input.value);
  }
});

newChatButtons.forEach((button) => button.addEventListener('click', clearChat));
bindQuestionButtons(document);

async function initialize() {
  try { await enforceUonMaintenance(); } catch {}
  try { watchUonMaintenance(); } catch {}
  try { await applyFeatureStates(document); } catch {}

  renderHistory();
  resizeInput();
  bindQuestionButtons(document);

  const query = new URLSearchParams(location.search).get('q')?.trim();
  if (query) {
    history.replaceState(null, '', location.pathname);
    setTimeout(() => ask(query), 200);
  }

  try { trackEvent('page_view', { page: 'assistant-v3' }); } catch {}
}

initialize();
