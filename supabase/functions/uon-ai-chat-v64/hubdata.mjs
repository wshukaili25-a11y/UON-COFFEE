// Answers that come straight from UON Hub's own catalogue: summaries, WhatsApp
// groups, programme plans and course pages. Pure functions (tested); the gateway
// loads the rows and passes them in.
import { normalize } from './conversation.mjs';

export const SITE = 'https://www.uonhub.space';
const toLatinDigits = v => String(v ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
// Same spirit as the SQL key used to link groups: no diacritics, unified alef/yaa/taa, punctuation → space.
export function key(value) {
  return normalize(toLatinDigits(value)).replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
const stem = w => w.replace(/^و(?=\S{4,})/, '').replace(/^ال(?=\S{3,})/, '').replace(/ه$/, '').replace(/ي$/, '');
const SYN = { حاسوب: 'حاسب', كمبيوتر: 'حاسب', كمبيوت: 'حاسب', احيا: 'احياء', بايولوجي: 'احياء', فيزيا: 'فيزياء', كيميا: 'كيمياء', انجليز: 'انجليزي', انقلش: 'انجليزي', انجلش: 'انجليزي', رياضي: 'رياضيات', تمريض: 'تمريض', ويب: 'ويب', امن: 'امن' };
const tokens = v => key(v).split(' ').filter(Boolean).map(stem).map(w => SYN[w] || w);
const STOP = new Set(['في', 'و', 'من', 'او', 'ل', 'لل', 'and', 'of', 'in', 'the', 'تخصص', 'برنامج', 'خطه', 'خطة', 'مواد', 'program', 'major', 'plan']);

export function hubIntent(question) {
  const q = normalize(question);
  return {
    summaries: /ملخص|شروحات|سلايد|اختبارات سابق|امتحانات سابق|اسئله سابق|نماذج اختبار|ملفات (?:ال)?(?:ماده|مقرر|مساق)|\bpdf\b|summar|notes|slides|past (?:exam|paper)/.test(q),
    groups: /قروب|قروبات|جروب|كروب|مجموعه|مجموعات|واتس|\bgroup|whatsapp/.test(q),
    plan: /خطه|خطط|مواد (?:ال)?تخصص|مقررات (?:ال)?تخصص|study plan|degree plan|courses (?:of|in|for)/.test(q),
  };
}

const ALIASES = [
  ['عربي 1', 'ARAB100'], ['عربي ون', 'ARAB100'], ['لغه عربيه 1', 'ARAB100'], ['arabic 1', 'ARAB100'],
  ['عربي 2', 'ARAB101'], ['عربي تو', 'ARAB101'], ['لغه عربيه 2', 'ARAB101'], ['arabic 2', 'ARAB101'],
  ['حضاره', 'HIST150'], ['حضاره اسلاميه', 'HIST150'], ['islamic civilization', 'HIST150'],
  ['computer skills', 'COMP101'], ['كمبيوتر سكلس', 'COMP101'], ['مهارات الحاسوب', 'COMP101'], ['مهارات حاسوب', 'COMP101'],
  ['منطق', 'LOGI100'], ['مقدمه في المنطق', 'LOGI100'],
  ['بري كالكلس', 'MATH116'], ['بري كالكولس', 'MATH116'], ['pre calculus', 'MATH116'], ['precalculus', 'MATH116'],
  ['انجلش 1', 'ENGL150'], ['انجلش ون', 'ENGL150'], ['انجليزي 1', 'ENGL150'], ['english 1', 'ENGL150'],
  ['انجلش 2', 'ENGL151'], ['انجلش تو', 'ENGL151'], ['انجليزي 2', 'ENGL151'], ['english 2', 'ENGL151'],
  ['ريادة الاعمال', 'MNGT100'], ['رياده الاعمال', 'MNGT100'], ['ريادة اعمال', 'MNGT100'],
  ['عمان الدوله والانسان', 'HIST160'], ['عمان الدولة والانسان', 'HIST160'],
].map(([a, c]) => [key(a), c]);

export const codeKey = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** courses: [{code,name_ar,name_en,credit_hours}] → {course, ambiguous:[...]} */
export function resolveCourse(question, courses) {
  const byCode = new Map(courses.map(c => [codeKey(c.code), c]));
  const raw = toLatinDigits(question).toUpperCase();
  const codes = [...raw.matchAll(/\b([A-Z]{2,5})\s*-?\s*(\d{3})(L?)\b/g)].map(m => m[1] + m[2] + m[3]);
  for (const c of codes) { if (byCode.has(c)) return { course: byCode.get(c), ambiguous: [] }; const base = c.replace(/L$/, ''); if (byCode.has(base)) return { course: byCode.get(base), ambiguous: [] }; }
  const q = ' ' + key(question) + ' ';
  const alias = ALIASES.filter(([a]) => q.includes(' ' + a + ' ')).sort((x, y) => y[0].length - x[0].length)[0];
  if (alias && byCode.has(alias[1])) return { course: byCode.get(alias[1]), ambiguous: [] };
  const hits = [];
  for (const c of courses) {
    for (const name of [c.name_en, c.name_ar]) {
      const k = key(name);
      if (k.length >= 6 && q.includes(' ' + k + ' ')) hits.push({ c, len: k.length });
    }
  }
  if (!hits.length) return { course: null, ambiguous: [] };
  hits.sort((a, b) => b.len - a.len);
  const best = hits.filter(h => h.len === hits[0].len), uniq = [...new Map(best.map(h => [codeKey(h.c.code), h.c])).values()];
  return uniq.length === 1 ? { course: uniq[0], ambiguous: [] } : { course: null, ambiguous: uniq.slice(0, 5) };
}

/** programs: [{id,name_ar,name_en,degree_ar}] */
export function resolveProgram(question, programs) {
  const q = new Set(tokens(question).filter(w => !STOP.has(w)));
  const nq = normalize(question);
  const wantDiploma = /دبلوم|diploma/.test(nq), wantMaster = /ماجستير|master/.test(nq);
  let best = null;
  for (const p of programs) {
    for (const name of [p.name_ar, p.name_en]) {
      const t = [...new Set(tokens(name).filter(w => !STOP.has(w)))];
      if (!t.length) continue;
      const hit = t.filter(w => q.has(w)).length, score = hit / t.length;
      if (hit === 0 || score < 0.66) continue;
      const deg = String(p.degree_ar || '');
      const degScore = (wantDiploma ? deg.includes('دبلوم') : wantMaster ? deg.includes('ماجستير') : deg.includes('بكالوريوس')) ? 0.1 : 0;
      const total = score + degScore + hit * 0.01;
      if (!best || total > best.total) best = { p, total };
    }
  }
  return best ? best.p : null;
}

const courseLabel = c => `${c.code} — ${c.name_ar && /[؀-ۿ]/.test(c.name_ar) ? c.name_ar : (c.name_en || c.name_ar)}`;
export const courseUrl = c => `${SITE}/course.html?code=${encodeURIComponent(codeKey(c.code))}`;
const fileUrl = s => `${SITE}/summary-viewer.html?id=${encodeURIComponent(s.id)}`;

export function summariesAnswer(course, rows, lang = 'ar') {
  const en = lang === 'en', list = rows.slice(0, 5);
  if (!list.length) return {
    answer: en
      ? `I couldn't find shared files for ${courseLabel(course)} yet.\nYou can request one or upload yours here:\n${SITE}/summaries.html?q=${encodeURIComponent(codeKey(course.code))}`
      : `ما حصلت ملخصات مرفوعة لـ ${courseLabel(course)} حاليًا.\nتقدر تطلب ملخص أو ترفع ملفك من هنا:\n${SITE}/summaries.html?q=${encodeURIComponent(codeKey(course.code))}`,
    links: [{ type: 'UON Hub', title: en ? 'Summaries library' : 'مكتبة الملخصات', url: `${SITE}/summaries.html?q=${encodeURIComponent(codeKey(course.code))}`, official: false }],
  };
  const lines = list.map((s, i) => `${i + 1}. ${String(s.title || '').slice(0, 90)}\n${fileUrl(s)}`);
  const more = rows.length > list.length ? (en ? `\n\nAll ${rows.length} files for this course:\n${courseUrl(course)}` : `\n\nكل ملفات المادة (${rows.length}):\n${courseUrl(course)}`) : (en ? `\n\nCourse page:\n${courseUrl(course)}` : `\n\nصفحة المادة:\n${courseUrl(course)}`);
  return {
    answer: (en ? `📚 Files for ${courseLabel(course)}:\n\n` : `📚 ملفات ${courseLabel(course)}:\n\n`) + lines.join('\n\n') + more,
    links: [{ type: 'UON Hub', title: courseLabel(course), url: courseUrl(course), official: false }],
  };
}

export function groupsAnswer(course, rows, lang = 'ar') {
  const en = lang === 'en', list = rows.filter(g => /^https:\/\/chat\.whatsapp\.com\//.test(String(g.link || ''))).slice(0, 6);
  if (!list.length) return {
    answer: en ? `No WhatsApp group is listed for ${courseLabel(course)} yet.\nIf you have one, add it here:\n${SITE}/groups.html` : `ما فيه قروب مسجل لـ ${courseLabel(course)} حاليًا.\nإذا عندك قروب، أضفه من هنا وبيظهر بعد المراجعة:\n${SITE}/groups.html`,
    links: [{ type: 'UON Hub', title: en ? 'Groups' : 'المجموعات', url: `${SITE}/groups.html`, official: false }],
  };
  const lines = list.map((g, i) => `${i + 1}. ${String(g.subject || '').slice(0, 80)}\n${g.link}`);
  return {
    answer: (en ? `💬 WhatsApp groups for ${courseLabel(course)}:\n\n` : `💬 قروبات ${courseLabel(course)}:\n\n`) + lines.join('\n\n') + (en ? `\n\nGroups are added by students; join the one for your section.` : `\n\nالقروبات يضيفها الطلاب، ادخل قروب شعبتك.`),
    links: [{ type: 'UON Hub', title: courseLabel(course), url: courseUrl(course), official: false }],
  };
}

export function planAnswer(program, courses, lang = 'ar') {
  const en = lang === 'en';
  const name = en ? `${program.name_en} (${program.degree_en || program.degree_ar || ''})`.replace(' ()', '') : `${program.name_ar}${program.degree_ar ? ' — ' + program.degree_ar : ''}`;
  const listUrl = `${SITE}/courses.html?program=${encodeURIComponent(program.id)}`;
  if (!courses.length) return {
    answer: en ? `I don't have the course list for ${name} yet. The university hasn't published its plan online; your department or advisor can share it.` : `ما عندي قائمة مواد ${name} حاليًا، لأن خطتها مو منشورة في موقع الجامعة. تقدر تطلبها من القسم أو المرشد الأكاديمي.`,
    links: [],
  };
  const levels = new Map();
  for (const c of courses) { const lv = Number(c.level) || Number(String(c.code).match(/\d/)?.[0]) || 0; if (!levels.has(lv)) levels.set(lv, []); levels.get(lv).push(c); }
  const title = l => en ? `Level ${l}00` : `مستوى ${l}00`;
  const parts = [...levels.keys()].sort((a, b) => a - b).map(l => `▪️ ${title(l)}\n` + levels.get(l).sort((a, b) => codeKey(a.code).localeCompare(codeKey(b.code))).map(c => `• ${courseLabel(c)}${c.credit_hours ? ` (${c.credit_hours})` : ''}`).join('\n'));
  const source = courses.find(c => c.source_url)?.source_url;
  return {
    answer: (en ? `📘 Courses in ${name} (${courses.length}):\n\n` : `📘 مواد ${name} (${courses.length} مادة):\n\n`) + parts.join('\n\n')
      + (en ? `\n\nBrowse them with summaries and groups:\n${listUrl}` : `\n\nتصفحها مع ملخصاتها وقروباتها:\n${listUrl}`)
      + (source ? (en ? `\n\nOfficial plan file:\n${source}` : `\n\nملف الخطة الرسمي:\n${source}`) : ''),
    links: [{ type: 'UON Hub', title: name, url: listUrl, official: false }, ...(source ? [{ type: en ? 'Official source' : 'مصدر رسمي', title: en ? 'Study plan' : 'الخطة الدراسية', url: source, official: true }] : [])],
  };
}

export function courseAnswer(course, stats, lang = 'ar') {
  const en = lang === 'en';
  const bits = [courseLabel(course) + (course.credit_hours ? (en ? ` — ${course.credit_hours} credit hours` : ` — ${course.credit_hours} ساعات`) : '')];
  if (course.name_en && course.name_ar && course.name_en !== course.name_ar) bits.push(course.name_en);
  bits.push(en ? `On UON Hub: ${stats.summaries} files · ${stats.groups} groups` : `في UON Hub: ${stats.summaries} ملف · ${stats.groups} قروب`);
  return {
    answer: (en ? '📗 ' : '📗 ') + bits.join('\n') + (en ? `\n\nCourse page (files, groups, prerequisites):\n${courseUrl(course)}` : `\n\nصفحة المادة (الملفات والقروبات والمتطلبات):\n${courseUrl(course)}`),
    links: [{ type: 'UON Hub', title: courseLabel(course), url: courseUrl(course), official: false }],
  };
}

/** Text left after removing request words, used as a library search term. */
export function searchTerm(question) {
  const drop = new Set(['اريد','ابي','ابغي','عطني','عطيني','ممكن','ملخص','ملخصات','شروحات','سلايدات','ملفات','pdf','قروب','قروبات','جروب','مجموعه','واتساب','واتس','حق','مال','ماده','مقرر','نماذج','اختبارات','سابقه','للانجلش','summary','summaries','notes','group','groups']);
  return key(question).split(' ').map(w => w.replace(/^لل(?=\S{3,})/, '').replace(/^ل(?=ال)/, '')).filter(w => w && !drop.has(w)).join(' ').slice(0, 60);
}
