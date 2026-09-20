export const MAX_QUESTIONS = 20;
export function validateQuiz(value) {
  if (!value || !Array.isArray(value.questions) || !value.questions.length || value.questions.length > MAX_QUESTIONS) throw new Error('questions');
  const questions = value.questions.map(q => {
    if (!q || typeof q.prompt !== 'string' || !q.prompt.trim() || q.prompt.length > 1000 || !Array.isArray(q.options) || q.options.length !== 4) throw new Error('question');
    const options = q.options.map(x => { if (typeof x !== 'string' || !x.trim() || x.length > 400) throw new Error('options'); return x.trim(); });
    if (new Set(options.map(x => x.toLowerCase())).size !== 4 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) throw new Error('answer');
    if (q.explanation != null && (typeof q.explanation !== 'string' || q.explanation.length > 1500)) throw new Error('explanation');
    return {prompt:q.prompt.trim(), options, answer:q.answer, explanation:(q.explanation || '').trim()};
  });
  return {questions};
}
export function gradeQuiz(quiz, answers) {
  const {questions} = validateQuiz(quiz);
  if (!Array.isArray(answers) || answers.length !== questions.length || answers.some(x => !Number.isInteger(x) || x < 0 || x > 3)) throw new Error('incomplete');
  const wrong = questions.flatMap((q, i) => q.answer === answers[i] ? [] : [i]);
  return {correct:questions.length - wrong.length, total:questions.length, wrong};
}
export function practiceKey(code) {
  if (!/^[A-Z]{2,10}\d{2,4}[A-Z]?$/.test(code)) throw new Error('course');
  return 'uon_course_practice_v1:' + code;
}
export function loadPractice(storage, code) {
  const raw = storage.getItem(practiceKey(code));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value.version !== 1) throw new Error('version');
  const quiz = {...validateQuiz(value), version:1};
  if (value.attempt) {
    try { quiz.attempt = validateAttempt(quiz, value.attempt); } catch { /* Keep valid questions when an old attempt is damaged. */ }
  }
  return quiz;
}
export function savePractice(storage, code, quiz) {
  const value = {version:1, ...validateQuiz(quiz)};
  // A single isolated key keeps other course data and schedules untouched.
  storage.setItem(practiceKey(code), JSON.stringify(value));
  return value;
}
export function validateAttempt(bank, attempt) {
  const quiz = validateQuiz(attempt);
  const available = new Set(validateQuiz(bank).questions.map(q => JSON.stringify(q)));
  if (quiz.questions.some(q => !available.has(JSON.stringify(q))) || !Number.isInteger(attempt.index) || attempt.index < 0 || attempt.index >= quiz.questions.length) throw new Error('attempt');
  if (!Array.isArray(attempt.answers) || attempt.answers.length !== quiz.questions.length || attempt.answers.some(a => a !== null && (!Number.isInteger(a) || a < 0 || a > 3))) throw new Error('answers');
  if (attempt.complete === true) gradeQuiz(quiz, attempt.answers);
  return {...quiz, answers:attempt.answers.slice(), index:attempt.index, complete:attempt.complete === true};
}
export function saveAttempt(storage, code, bank, attempt) {
  const current = loadPractice(storage, code);
  if (!current || JSON.stringify(validateQuiz(current)) !== JSON.stringify(validateQuiz(bank))) throw new Error('changed');
  const value = {...current, attempt:validateAttempt(current, attempt)};
  storage.setItem(practiceKey(code), JSON.stringify(value));
  return value;
}
export function exportPractice(code, quiz) {
  practiceKey(code);
  return JSON.stringify({format:'uon-personal-practice', version:1, course:code, ...validateQuiz(quiz)}, null, 2);
}
export function parsePracticeBackup(text, code) {
  if (typeof text !== 'string' || text.length > 400000) throw new Error('size');
  const value = JSON.parse(text);
  if (value.format !== 'uon-personal-practice' || value.version !== 1) throw new Error('format');
  practiceKey(code);
  if (value.course !== code) throw new Error('course');
  return validateQuiz(value);
}
export function mergePractice(current, incoming) {
  const questions = current ? validateQuiz(current).questions : [];
  const seen = new Set(questions.map(q => JSON.stringify(q)));
  for (const q of validateQuiz(incoming).questions) {
    const key = JSON.stringify(q);
    if (!seen.has(key)) { questions.push(q); seen.add(key); }
  }
  return validateQuiz({questions});
}
export function practiceSummary(value) {
  if (!value) return {state:'empty', count:0};
  const bank = validateQuiz(value);
  if (!value.attempt) return {state:'ready', count:bank.questions.length};
  const attempt = validateAttempt(bank, value.attempt);
  return {
    state:attempt.complete ? 'complete' : 'in_progress',
    count:bank.questions.length,
    total:attempt.questions.length,
    answered:attempt.answers.filter(answer => answer !== null).length,
    question:attempt.index + 1,
    ...(attempt.complete ? {correct:gradeQuiz(attempt, attempt.answers).correct} : {})
  };
}
