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

  function sessionId() {
    const key = 'uon_anon_session';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  async function submitSuggestion(payload) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/uon_submit_feature_suggestion`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_category: payload.category,
        p_title: payload.title,
        p_details: payload.details,
        p_college: payload.college,
        p_contact: payload.contact,
        p_page_url: payload.page_url,
        p_session_id: sessionId()
      }),
      cache: 'no-store'
    });

    const raw = await response.text();
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
    if (!response.ok) {
      throw new Error(parsed?.message || parsed?.error_description || parsed || `HTTP ${response.status}`);
    }
    return typeof parsed === 'string' ? parsed : parsed;
  }

  async function notifyAdmin(id) {
    if (!id) return;
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

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (form.dataset.submitting === 'true') return;

      const button = form.querySelector('button[type="submit"]');
      const data = new FormData(form);
      const payload = {
        category: String(data.get('category') || '').trim(),
        college: String(data.get('college') || '').trim() || null,
        title: String(data.get('title') || '').trim(),
        details: String(data.get('details') || '').trim(),
        contact: String(data.get('contact') || '').trim() || null,
        page_url: location.href
      };

      if (!payload.category || payload.title.length < 3 || payload.details.length < 10) {
        toast('أكمل نوع الاقتراح، واكتب عنوانًا وتفاصيل أوضح', true);
        return;
      }

      form.dataset.submitting = 'true';
      if (button) {
        button.disabled = true;
        button.textContent = 'جارٍ إرسال الاقتراح…';
      }

      try {
        const id = await submitSuggestion(payload);
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
