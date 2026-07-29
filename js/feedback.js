(() => {
  'use strict';

  const SUPABASE_URL = 'https://irkhvydgxpseflggbeqq.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_gZ9tyM1udrkuQIXHqDtToQ_FyFmePgH';
  const COLLEGES = [
    'كلية العلوم والآداب',
    'كلية الاقتصاد والإدارة ونظم المعلومات',
    'كلية الهندسة والعمارة',
    'كلية العلوم الصحية'
  ];

  function toast(message, isError = false) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = `toast show${isError ? ' error' : ''}`;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.className = 'toast'; }, 3500);
  }

  function populateColleges(select) {
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">اختر الكلية</option>' +
      COLLEGES.map(name => `<option value="${name}">${name}</option>`).join('') +
      '<option value="أخرى">أخرى</option>';
    if ([...select.options].some(option => option.value === current)) {
      select.value = current;
    }
  }

  async function submitSuggestion(payload) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/feature_suggestions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    if (!response.ok) {
      const raw = await response.text();
      let message = raw;
      try {
        const parsed = JSON.parse(raw);
        message = parsed.message || parsed.error_description || raw;
      } catch {}
      throw new Error(message || `HTTP ${response.status}`);
    }
  }

  async function notifyAdmin(id) {
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/telegram-admin`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ source: 'web-submit', table: 'feature_suggestions', id }),
        cache: 'no-store'
      });
    } catch (error) {
      console.warn('Suggestion notification skipped', error);
    }
  }

  function initialize() {
    const form = document.getElementById('feedbackForm');
    const collegeSelect = document.getElementById('feedbackCollege');
    if (!form) return;

    populateColleges(collegeSelect);

    // Capture phase prevents any older cached handler or browser fallback from reloading the page.
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (form.dataset.submitting === 'true') return;

      const button = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const id = crypto.randomUUID();
      const payload = {
        id,
        category: String(data.get('category') || '').trim(),
        college: String(data.get('college') || '').trim() || null,
        title: String(data.get('title') || '').trim(),
        details: String(data.get('details') || '').trim(),
        contact: String(data.get('contact') || '').trim() || null,
        status: 'pending',
        page_url: location.href
      };

      if (!payload.category || !payload.title || !payload.details) {
        toast('أكمل نوع الاقتراح والعنوان والتفاصيل', true);
        return;
      }

      form.dataset.submitting = 'true';
      if (button) {
        button.disabled = true;
        button.textContent = 'جارٍ إرسال الاقتراح…';
      }

      try {
        await submitSuggestion(payload);
        void notifyAdmin(id);
        form.reset();
        populateColleges(collegeSelect);
        toast('وصل اقتراحك للمشرف، شكرًا لك 🤍');
      } catch (error) {
        console.error('Suggestion submission failed', error);
        toast(error.message || 'تعذر إرسال الاقتراح، حاول مرة أخرى', true);
      } finally {
        form.dataset.submitting = 'false';
        if (button) {
          button.disabled = false;
          button.textContent = 'إرسال الاقتراح';
        }
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
