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
  return {...validateQuiz(value), version:1};
}
export function savePractice(storage, code, quiz) {
  const value = {version:1, ...validateQuiz(quiz)};
  // A single isolated key keeps other course data and schedules untouched.
  storage.setItem(practiceKey(code), JSON.stringify(value));
  return value;
}
