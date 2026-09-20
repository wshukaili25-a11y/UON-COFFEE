import {validateQuiz, gradeQuiz, loadPractice, savePractice, MAX_QUESTIONS} from './course-practice-data.js?v=70.0.0';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountCoursePractice(root, code, english = false) {
  if (!root) return;
  const t = (ar,en) => english ? en : ar;
  let saved = null, quiz = null, answers = [], index = 0, graded = null, storage;
  try { storage = localStorage; saved = loadPractice(storage, code); } catch { /* Show a recoverable storage warning below. */ }
  root.innerHTML = `<header><span class="student-label">${t('تدريب شخصي','Personal practice')}</span><h2>${t('اختبر نفسك في','Practise')} ${escape(code)}</h2><p>${t('أنشئ أسئلة من ملاحظاتك مع الإجابة الصحيحة. أسئلتك محفوظة في هذا المتصفح فقط، وليست بنك أسئلة معتمدًا من الجامعة.','Create questions from your notes and provide the correct answers. Questions are saved only in this browser and are not an official university question bank.')}</p></header><div class="practice-body"></div><p class="practice-status" role="status" aria-live="polite"></p>`;
  const body = root.querySelector('.practice-body'), status = root.querySelector('.practice-status');
  const say = text => { status.textContent = text; };
  const focusHeading = () => body.querySelector('[tabindex="-1"]')?.focus();
  const button = (action, label, primary = false) => `<button type="button" class="btn${primary?' primary':''}" data-practice="${action}">${label}</button>`;
  function home() {
    say('');
    body.innerHTML = saved ? `<p>${saved.questions.length} ${t('أسئلة جاهزة للتدريب','questions ready')}</p><div class="practice-actions">${button('start',t('ابدأ التدريب','Start practice'),true)}${button('edit',t('تعديل أسئلتي','Edit my questions'))}</div>` : `<p>${t('ابدأ بسؤال واحد، وأضف حتى ٢٠ سؤالًا لكل مادة.','Start with one question and add up to 20 per course.')}</p>${button('edit',t('إنشاء أسئلتي','Create my questions'),true)}`;
  }
  const blank = () => ({prompt:'',options:['','','',''],answer:0,explanation:''});
  function questionFields(q, i) {
    return `<fieldset class="practice-editor-question"><legend>${t('السؤال','Question')} ${i+1}</legend><label>${t('نص السؤال','Question text')}<textarea data-field="prompt" required maxlength="1000" rows="2">${escape(q.prompt)}</textarea></label><div class="practice-options-editor">${q.options.map((option,j)=>`<label>${t('الخيار','Option')} ${j+1}<input data-option="${j}" required maxlength="400" value="${escape(option)}"></label>`).join('')}</div><label>${t('الإجابة الصحيحة','Correct answer')}<select data-field="answer">${q.options.map((_,j)=>`<option value="${j}" ${q.answer===j?'selected':''}>${t('الخيار','Option')} ${j+1}</option>`).join('')}</select></label><label>${t('شرح الإجابة أو مرجعها (اختياري)','Explanation or reference (optional)')}<textarea data-field="explanation" maxlength="1500" rows="2">${escape(q.explanation)}</textarea></label>${button('remove',t('إزالة هذا السؤال','Remove this question'))}</fieldset>`;
  }
  function editor() {
    say('');
    body.innerHTML = `<h3 tabindex="-1">${t('أسئلتي','My questions')}</h3><form class="practice-editor"><div class="practice-fields">${(saved?.questions || [blank()]).map(questionFields).join('')}</div><div class="practice-actions">${button('add',t('إضافة سؤال','Add question'))}<button class="btn primary" type="submit">${t('حفظ الأسئلة','Save questions')}</button>${button('home',t('إلغاء التعديل','Cancel editing'))}</div></form>`;
    focusHeading();
  }
  function start(selected = saved.questions) {
    quiz = validateQuiz({questions:selected}); answers = Array(quiz.questions.length).fill(null); index = 0; graded = null; say(''); showQuestion();
  }
  function showQuestion() {
    const q = quiz.questions[index];
    body.innerHTML = `<p>${t('السؤال','Question')} ${index+1} / ${quiz.questions.length}</p><progress value="${answers.filter(a=>a!==null).length}" max="${quiz.questions.length}" aria-label="${t('الأسئلة المجابة','Questions answered')}"></progress><fieldset class="practice-question"><legend tabindex="-1">${escape(q.prompt)}</legend>${q.options.map((option,j)=>`<label class="practice-choice"><input type="radio" name="practice-answer" value="${j}" ${answers[index]===j?'checked':''}><span>${escape(option)}</span></label>`).join('')}</fieldset><div class="practice-actions">${index?button('prev',t('السابق','Previous')):''}${button(index===quiz.questions.length-1?'finish':'next',index===quiz.questions.length-1?t('عرض النتيجة','Show result'):t('التالي','Next'),true)}${button('home',t('إنهاء التدريب','Exit practice'))}</div>`;
    focusHeading();
  }
  function result() {
    graded = gradeQuiz(quiz, answers);
    body.innerHTML = `<h3 tabindex="-1">${t('نتيجتك','Your result')}: ${graded.correct} / ${graded.total}</h3><p>${t('التصحيح حسب مفتاح الإجابة الذي أدخلته.','Graded against the answer key you provided.')}</p><div class="practice-actions">${graded.wrong.length?button('wrong',t('أعد الأسئلة الخاطئة','Retry missed questions'),true):''}${button('start',t('أعد الاختبار كاملًا','Retry full quiz'))}${button('home',t('العودة','Back'))}</div><div class="practice-review">${quiz.questions.map((q,i)=>`<article><h4>${i+1}. ${escape(q.prompt)}</h4><strong>${q.answer===answers[i]?t('✓ إجابة صحيحة','✓ Correct'):t('✕ تحتاج مراجعة','✕ Review needed')}</strong><p>${t('إجابتك:','Your answer:')} ${escape(q.options[answers[i]])}</p>${q.answer!==answers[i]?`<p>${t('الصحيح:','Correct:')} ${escape(q.options[q.answer])}</p>`:''}${q.explanation?`<p class="practice-explanation">${escape(q.explanation)}</p>`:''}</article>`).join('')}</div>`;
    focusHeading();
  }
  body.addEventListener('change', event => { if(event.target.name==='practice-answer') { answers[index]=Number(event.target.value); say(''); } });
  body.addEventListener('submit', event => {
    event.preventDefault();
    const questions = [...body.querySelectorAll('.practice-editor-question')].map(field => ({prompt:field.querySelector('[data-field="prompt"]').value,options:[...field.querySelectorAll('[data-option]')].map(x=>x.value),answer:Number(field.querySelector('[data-field="answer"]').value),explanation:field.querySelector('[data-field="explanation"]').value}));
    let valid;
    try { valid = validateQuiz({questions}); } catch { say(t('أكمل كل سؤال بأربعة خيارات مختلفة وإجابة صحيحة واحدة.','Complete each question with four different options and one correct answer.')); return; }
    try { saved = savePractice(storage,code,valid); home(); say(t('تم حفظ أسئلتك على هذا الجهاز.','Your questions are saved on this device.')); } catch { say(t('تعذر الحفظ في المتصفح. أسئلتك ما زالت في النموذج؛ انسخها قبل المغادرة وتحقق من إعدادات التخزين.','Could not save in this browser. Your questions remain in the form; copy them before leaving and check your storage settings.')); }
  });
  body.addEventListener('click', event => {
    const action = event.target.closest('[data-practice]')?.dataset.practice;
    if (!action) return;
    if(action==='edit') return editor();
    if(action==='home') {
      if((body.querySelector('form') || (quiz && !graded && body.querySelector('.practice-question'))) && !confirm(t('مغادرة هذه المحاولة؟ التعديلات غير المحفوظة والإجابات الحالية لن تُحفظ.','Leave this attempt? Unsaved edits and current answers will not be saved.'))) return;
      quiz=null; return home();
    }
    if(action==='start') return start();
    if(action==='wrong') return start(graded.wrong.map(i=>quiz.questions[i]));
    if(action==='add') {
      const fields=body.querySelector('.practice-fields');
      if(fields.children.length>=MAX_QUESTIONS) return say(t('الحد الأقصى ٢٠ سؤالًا.','Maximum 20 questions.'));
      fields.insertAdjacentHTML('beforeend',questionFields(blank(),fields.children.length));
      fields.lastElementChild.querySelector('textarea').focus(); return;
    }
    if(action==='remove') {
      const fields=body.querySelector('.practice-fields');
      if(fields.children.length===1) return say(t('احتفظ بسؤال واحد على الأقل.','Keep at least one question.'));
      event.target.closest('fieldset').remove();
      [...fields.children].forEach((field,i)=>field.querySelector('legend').textContent=`${t('السؤال','Question')} ${i+1}`); return;
    }
    if(action==='prev') { index--; say(''); return showQuestion(); }
    if(answers[index]===null) return say(t('اختر إجابة أولًا.','Choose an answer first.'));
    if(action==='next') { index++; say(''); return showQuestion(); }
    if(action==='finish') { say(''); return result(); }
  });
  home();
}
