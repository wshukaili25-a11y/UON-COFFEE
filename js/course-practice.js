import {validateQuiz, gradeQuiz, loadPractice, savePractice, saveAttempt, exportPractice, parsePracticeBackup, mergePractice, MAX_QUESTIONS} from './course-practice-data.js?v=71.0.0';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountCoursePractice(root, code, english = false) {
  if (!root) return;
  const t = (ar,en) => english ? en : ar;
  let saved = null, quiz = null, answers = [], index = 0, graded = null, storage, pendingImport = null;
  try { storage = localStorage; saved = loadPractice(storage, code); } catch { /* Show a recoverable storage warning below. */ }
  root.innerHTML = `<header><span class="student-label">${t('تدريب شخصي','Personal practice')}</span><h2>${t('اختبر نفسك في','Practise')} ${escape(code)}</h2><p>${t('أنشئ أسئلة من ملاحظاتك مع الإجابة الصحيحة. أسئلتك محفوظة في هذا المتصفح فقط، وليست بنك أسئلة معتمدًا من الجامعة.','Create questions from your notes and provide the correct answers. Questions are saved only in this browser and are not an official university question bank.')}</p></header><div class="practice-body"></div><p class="practice-status" role="status" aria-live="polite"></p>`;
  const body = root.querySelector('.practice-body'), status = root.querySelector('.practice-status');
  const say = text => { status.textContent = text; };
  const focusHeading = () => body.querySelector('[tabindex="-1"]')?.focus();
  const button = (action, label, primary = false) => `<button type="button" class="btn${primary?' primary':''}" data-practice="${action}">${label}</button>`;
  function home() {
    say('');
    body.innerHTML = saved ? `<p>${saved.questions.length} ${t('أسئلة جاهزة للتدريب','questions ready')}</p><div class="practice-actions">${saved.attempt?button('resume',saved.attempt.complete?t('آخر نتيجة','Last result'):t('تابع من حيث توقفت','Resume practice'),true):''}${button('start',t('ابدأ تدريبًا جديدًا','Start new practice'),!saved.attempt)}${button('export',t('نسخة احتياطية للأسئلة','Back up questions'))}${button('edit',t('تعديل أسئلتي','Edit my questions'))}</div>` : `<p>${t('ابدأ بسؤال واحد، وأضف حتى ٢٠ سؤالًا لكل مادة.','Start with one question and add up to 20 per course.')}</p>${button('edit',t('إنشاء أسئلتي','Create my questions'),true)}`;
    body.insertAdjacentHTML('beforeend', `<div class="practice-actions">${button('paste',t('لصق نسخة الأسئلة','Paste question backup'))}<label class="btn">${t('استيراد نسخة أسئلة','Import question backup')}<input type="file" id="practiceImport-${escape(code)}" name="practice-backup" class="practice-import-file" accept=".json,application/json" aria-label="${t('استيراد نسخة أسئلة','Import question backup')}"></label></div><p>${t('ملف النسخة يتضمن الأسئلة والإجابات الصحيحة. الاستيراد يضيف الأسئلة الجديدة ولا يحذف أسئلتك الحالية.','Backups include questions and the answer key. Import adds new questions without deleting your existing questions.')}</p>`);
  }
  const blank = () => ({prompt:'',options:['','','',''],answer:0,explanation:''});
  function questionFields(q, i) {
    return `<fieldset class="practice-editor-question"><legend>${t('السؤال','Question')} ${i+1}</legend><label>${t('نص السؤال','Question text')}<textarea data-field="prompt" required maxlength="1000" rows="2">${escape(q.prompt)}</textarea></label><div class="practice-options-editor">${q.options.map((option,j)=>`<label>${t('الخيار','Option')} ${j+1}<input data-option="${j}" required maxlength="400" value="${escape(option)}"></label>`).join('')}</div><label>${t('الإجابة الصحيحة','Correct answer')}<select data-field="answer">${q.options.map((_,j)=>`<option value="${j}" ${q.answer===j?'selected':''}>${t('الخيار','Option')} ${j+1}</option>`).join('')}</select></label><label>${t('شرح الإجابة أو مرجعها (اختياري)','Explanation or reference (optional)')}<textarea data-field="explanation" maxlength="1500" rows="2">${escape(q.explanation)}</textarea></label>${button('remove',t('إزالة هذا السؤال','Remove this question'))}</fieldset>`;
  }
  function editor() {
    say('');
    body.innerHTML = `<h3 tabindex="-1">${t('أسئلتي','My questions')}</h3><p>${t('حفظ التعديلات يبدأ سجل تدريب جديدًا لهذه الأسئلة.','Saving edits resets the saved attempt for these questions.')}</p><form class="practice-editor"><div class="practice-fields">${(saved?.questions || [blank()]).map(questionFields).join('')}</div><div class="practice-actions">${button('add',t('إضافة سؤال','Add question'))}<button class="btn primary" type="submit">${t('حفظ الأسئلة','Save questions')}</button>${button('home',t('إلغاء التعديل','Cancel editing'))}</div></form>`;
    focusHeading();
  }
  function start(selected = saved.questions) {
    quiz = validateQuiz({questions:selected}); answers = Array(quiz.questions.length).fill(null); index = 0; graded = null; say(''); showQuestion(); persist();
  }
  function persist(complete = false) {
    try { saved = saveAttempt(storage,code,saved,{...quiz,answers,index,complete}); }
    catch { say(t('تعذر حفظ التقدم. يمكنك إكمال التدريب، لكن قد تفقد هذه المحاولة عند المغادرة.','Progress could not be saved. You can continue, but this attempt may be lost when leaving.')); }
  }
  function showQuestion() {
    const q = quiz.questions[index];
    body.innerHTML = `<p>${t('السؤال','Question')} ${index+1} / ${quiz.questions.length}</p><progress value="${answers.filter(a=>a!==null).length}" max="${quiz.questions.length}" aria-label="${t('الأسئلة المجابة','Questions answered')}"></progress><fieldset class="practice-question"><legend tabindex="-1">${escape(q.prompt)}</legend>${q.options.map((option,j)=>`<label class="practice-choice"><input type="radio" name="practice-answer" value="${j}" ${answers[index]===j?'checked':''}><span>${escape(option)}</span></label>`).join('')}</fieldset><div class="practice-actions">${index?button('prev',t('السابق','Previous')):''}${button(index===quiz.questions.length-1?'finish':'next',index===quiz.questions.length-1?t('عرض النتيجة','Show result'):t('التالي','Next'),true)}${button('home',t('إنهاء التدريب','Exit practice'))}</div>`;
    focusHeading();
  }
  function result() {
    graded = gradeQuiz(quiz, answers);
    persist(true);
    body.innerHTML = `<h3 tabindex="-1">${t('نتيجتك','Your result')}: ${graded.correct} / ${graded.total}</h3><p>${t('التصحيح حسب مفتاح الإجابة الذي أدخلته.','Graded against the answer key you provided.')}</p><div class="practice-actions">${graded.wrong.length?button('wrong',t('أعد الأسئلة الخاطئة','Retry missed questions'),true):''}${button('start',t('أعد الاختبار كاملًا','Retry full quiz'))}${button('home',t('العودة','Back'))}</div><div class="practice-review">${quiz.questions.map((q,i)=>`<article><h4>${i+1}. ${escape(q.prompt)}</h4><strong>${q.answer===answers[i]?t('✓ إجابة صحيحة','✓ Correct'):t('✕ تحتاج مراجعة','✕ Review needed')}</strong><p>${t('إجابتك:','Your answer:')} ${escape(q.options[answers[i]])}</p>${q.answer!==answers[i]?`<p>${t('الصحيح:','Correct:')} ${escape(q.options[q.answer])}</p>`:''}${q.explanation?`<p class="practice-explanation">${escape(q.explanation)}</p>`:''}</article>`).join('')}</div>`;
    focusHeading();
  }
  body.addEventListener('change', event => { if(event.target.name==='practice-answer') { answers[index]=Number(event.target.value); say(''); persist(); body.querySelector('progress').value=answers.filter(a=>a!==null).length; } });
  function reviewImport(imported) {
      const merged=mergePractice(saved,imported); pendingImport=imported;
      body.innerHTML=`<h3 tabindex="-1">${t('مراجعة الاستيراد','Review import')}</h3><p>${escape(code)} · ${imported.questions.length} ${t('أسئلة في الملف','questions in file')} · ${merged.questions.length} ${t('أسئلة بعد الدمج','questions after merge')}</p><p>${t('راجع الأسئلة ومفتاح الإجابة بعد الاستيراد. إضافة أسئلة جديدة تبدأ سجل تدريب جديدًا.','Review the questions and answer key after importing. Adding new questions resets the saved attempt.')}</p><ul>${imported.questions.map(q=>`<li>${escape(q.prompt)}</li>`).join('')}</ul><div class="practice-actions">${button('import-confirm',t('تأكيد إضافة الأسئلة','Confirm adding questions'),true)}${button('import-cancel',t('إلغاء','Cancel'))}</div>`;
      say(''); focusHeading();
  }
  body.addEventListener('change', async event => {
    if (!event.target.matches('.practice-import-file')) return;
    const file=event.target.files?.[0]; if(!file) return;
    const input=event.target; input.disabled=true; say(t('جاري قراءة النسخة…','Reading backup…'));
    try {
      if(file.size>400000) throw new Error('size');
      const imported=parsePracticeBackup(await file.text(),code);
      if(!input.isConnected) return;
      reviewImport(imported);
    } catch(error) {
      say(error.message==='course'?t('هذه النسخة لمادة أخرى. افتح صفحة مادتها لاستيرادها.','This backup belongs to another course. Open that course to import it.'):t('تعذر قراءة النسخة. استخدم ملف UON Hub صالحًا، وبحد أقصى ٢٠ سؤالًا بعد الدمج و٤٠٠ كيلوبايت. أسئلتك لم تتغير.','Could not read the backup. Use a valid UON Hub file, no larger than 400 KB and no more than 20 merged questions. Your questions are unchanged.'));
    } finally { if(input.isConnected){input.disabled=false;input.value='';} }
  });
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
      if(body.querySelector('form') && !confirm(t('مغادرة هذه المحاولة؟ التعديلات غير المحفوظة والإجابات الحالية لن تُحفظ.','Leave this attempt? Unsaved edits and current answers will not be saved.'))) return;
      quiz=null; return home();
    }
    if(action==='start') {
      if(saved.attempt && !saved.attempt.complete && !graded && !confirm(t('بدء محاولة جديدة بدل المحاولة المحفوظة؟','Start a new attempt instead of the saved attempt?'))) return;
      return start();
    }
    if(action==='resume') { const a=saved.attempt; quiz=validateQuiz(a); answers=a.answers.slice(); index=a.index; graded=null; say(''); return a.complete?result():showQuestion(); }
    if(action==='paste') {
      body.innerHTML=`<h3 tabindex="-1">${t('لصق نسخة الأسئلة','Paste question backup')}</h3><p>${t('الصق النص الذي نسخته من «نسخة احتياطية للأسئلة». سنراجع النسخة قبل إضافتها لهذه المادة.','Paste the text copied from Back up questions. You can review it before adding it to this course.')}</p><label>${t('نص النسخة للاستيراد','Backup text to import')}<textarea class="practice-backup-text" rows="10" maxlength="400000" spellcheck="false"></textarea></label><div class="practice-actions">${button('paste-review',t('مراجعة النسخة','Review backup'),true)}${button('import-cancel',t('إلغاء','Cancel'))}</div>`;
      say(''); body.querySelector('textarea').focus(); return;
    }
    if(action==='paste-review') {
      try { reviewImport(parsePracticeBackup(body.querySelector('textarea').value,code)); }
      catch(error) { say(error.message==='course'?t('هذه النسخة لمادة أخرى. افتح صفحة مادتها لاستيرادها.','This backup belongs to another course. Open that course to import it.'):t('النسخة غير صالحة أو تتجاوز حد ٢٠ سؤالًا بعد الدمج. الصق النص كاملًا؛ أسئلتك الحالية لم تتغير.','Invalid backup or more than 20 merged questions. Paste the complete text; your current questions are unchanged.')); }
      return;
    }
    if(action==='export') {
      body.innerHTML=`<h3 tabindex="-1">${t('نسخة أسئلتك','Your question backup')}</h3><p>${t('انسخ النص ثم افتح نفس المادة على جهازك الآخر واختر «لصق نسخة الأسئلة». يمكنك أيضًا تنزيل ملف. النسخة تتضمن الإجابات الصحيحة.','Copy this text, open the same course on another device and choose Paste question backup. You can also download a file. The backup includes the answer key.')}</p><label>${t('نص النسخة','Backup text')}<textarea class="practice-backup-text" readonly rows="10">${escape(exportPractice(code,saved))}</textarea></label><div class="practice-actions">${button('copy',t('نسخ النسخة','Copy backup'),true)}${button('download',t('تنزيل ملف','Download file'))}${button('home',t('العودة','Back'))}</div>`; say(''); focusHeading(); return;
    }
    if(action==='copy') {
      navigator.clipboard.writeText(exportPractice(code,saved)).then(()=>say(t('تم نسخ النسخة.','Backup copied.'))).catch(()=>say(t('تعذر النسخ التلقائي؛ حدّد النص وانسخه يدويًا.','Automatic copy failed; select and copy the text manually.'))); return;
    }
    if(action==='download') {
      const url=URL.createObjectURL(new Blob([exportPractice(code,saved)],{type:'application/json'}));
      const link=document.createElement('a'); link.href=url; link.download=`uon-${code}-questions.json`; document.body.append(link); link.click(); link.remove(); say(t('إذا لم يبدأ التنزيل، استخدم «نسخ النسخة» ثم «لصق نسخة الأسئلة» على الجهاز الآخر.','If the download does not start, use Copy backup then Paste question backup on the other device.')); setTimeout(()=>URL.revokeObjectURL(url),30000); return;
    }
    if(action==='import-cancel') { pendingImport=null; return home(); }
    if(action==='import-confirm') {
      try {
        const current=loadPractice(storage,code), merged=mergePractice(current,pendingImport);
        saved=JSON.stringify(validateQuiz(current||merged))===JSON.stringify(merged)&&current?current:savePractice(storage,code,merged);
        pendingImport=null; home(); say(t('تم استيراد الأسئلة مع الحفاظ على أسئلتك السابقة.','Questions imported; your previous questions are preserved.'));
      } catch { say(t('تعذر الاستيراد. لم تتغير أسئلتك؛ تحقق من مساحة التخزين وحدّ ٢٠ سؤالًا.','Import failed. Your questions are unchanged; check storage and the 20-question limit.')); }
      return;
    }
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
    if(action==='prev') { index--; say(''); showQuestion(); persist(); return; }
    if(answers[index]===null) return say(t('اختر إجابة أولًا.','Choose an answer first.'));
    if(action==='next') { index++; say(''); showQuestion(); persist(); return; }
    if(action==='finish') { say(''); return result(); }
  });
  home();
}
