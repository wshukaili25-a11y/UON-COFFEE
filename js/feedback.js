import {
  fillCollege,
  $,
  submitPending,
  notifyPending,
  toast,
  enforceUonMaintenance,
  watchUonMaintenance,
  trackEvent
} from './core.js';

const form = $('#feedbackForm');
const collegeSelect = $('#feedbackCollege');
const submitButton = form?.querySelector('button[type="submit"], button:not([type])');

// Bind the form immediately so it never falls back to a normal page submission.
if (form) {
  form.addEventListener('submit', handleSubmit);
}

// Populate the college list immediately; this does not require a network request.
if (collegeSelect) {
  fillCollege(collegeSelect, { other: true });
}

// Maintenance checks run after the interactive controls are ready.
void initializePage();

async function initializePage() {
  await enforceUonMaintenance();
  watchUonMaintenance();
}

async function handleSubmit(event) {
  event.preventDefault();
  event.stopPropagation();

  if (!form || form.dataset.submitting === 'true') return;

  const body = Object.fromEntries(new FormData(form));
  body.category = String(body.category || '').trim();
  body.college = String(body.college || '').trim() || null;
  body.title = String(body.title || '').trim();
  body.details = String(body.details || '').trim();
  body.contact = String(body.contact || '').trim() || null;

  if (!body.category || !body.title || !body.details) {
    toast('أكمل نوع الاقتراح والعنوان والتفاصيل', true);
    return;
  }

  body.status = 'pending';
  body.page_url = location.href;

  setSubmitting(true);

  try {
    const row = await submitPending('feature_suggestions', body);

    // Notifications and analytics must never make the successful form submission fail.
    void notifyPending('feature_suggestions', row.id);
    void trackEvent('suggestion_submit', { category: body.category });

    form.reset();
    if (collegeSelect) fillCollege(collegeSelect, { other: true });
    toast('وصل اقتراحك للمشرف، شكرًا لك 🤍');
  } catch (error) {
    console.error('Suggestion submission failed', error);
    toast(error?.message || 'تعذر إرسال الاقتراح، حاول مرة أخرى', true);
  } finally {
    setSubmitting(false);
  }
}

function setSubmitting(isSubmitting) {
  if (!form) return;
  form.dataset.submitting = String(isSubmitting);

  if (submitButton) {
    submitButton.disabled = isSubmitting;
    submitButton.textContent = isSubmitting ? 'جارٍ إرسال الاقتراح…' : 'إرسال الاقتراح';
  }
}
