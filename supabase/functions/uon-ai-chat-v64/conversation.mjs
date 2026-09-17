// Pure helpers shared by the live gateway and regression tests.
export function normalize(value) {
  return String(value ?? '').normalize('NFKD').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}
export function conversationHistory(input, question) {
  const rows = (Array.isArray(input) ? input : []).slice(-12).filter(x => x && ['user', 'assistant'].includes(x.role) && typeof x.content === 'string').map(x => ({role: x.role, content: x.content.slice(0, 1800)}));
  if (rows.at(-1)?.role === 'user' && rows.at(-1).content.trim() === question.trim()) rows.pop();
  return rows;
}
export function retrievalQuestion(question, history) {
  const q = normalize(question);
  if (!/^(?:و?ايميله|و?بريده|و?رقمه|و?تخصصه|و?مكتبه|وين مكتبه|وين مكانه|وش اسمه|ما اسمه|ومتي|متي يبدا|وضح اكثر|اشرح اكثر|كم مدته|وش شروطه|و?ايميلها|وين مكتبها|his email|her email|his office|her office|where is his office|tell me more)[؟?!.\s]*$/.test(q.trim())) return question;
  const previous = [...history].reverse().find(x => x.role === 'user' && !/^(?:و?ايميله|و?رقمه|وين مكتبه|وضح اكثر)[؟?!.\s]*$/.test(normalize(x.content)));
  return previous ? `${previous.content.slice(0, 500)} — ${question}` : question;
}
const stop = new Set(normalize('دكتور الدكتور دكتوره الدكتوره دكاتره استاذ الاستاذ استاذه الاستاذه بروفيسور dr doctor professor prof mr mrs ms اسم اسمه من هو هي عن معلومات عطني اعطني عطيني اريد ابي ابغي لو سمحت ممكن تعرف تعرفني عندك هل في جامعه الجامعه نزوي ايميل ايميله ايميلها بريده بريده الالكتروني بريد البريد الالكتروني رقم رقمه رقمها هاتف الهاتف تواصل التواصل كيف اتواصل مع وين اين مكتب مكتبه مكتبها مكانه مكانها موقع موقعه موقعها تفاصيل تخصصه تخصصها و ايميله بريده رقمه تخصصه مكتبه وش ويش ما يقول تعرفه please give me the of a an what is who tell about email phone contact office number university nizwa his her').split(/\s+/));
export function nameTokens(value) {
  return normalize(value).replace(/عبد\s+الله/g, 'عبدالله').replace(/\bal[\s-]+/g, 'al').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(x => x.length > 1 && !stop.has(x));
}
function phonetic(value) {
  let s = normalize(value).replace(/^ال/, '').replace(/^al(?=[a-z])/, '');
  const arabic = {ا:'a',ب:'b',ت:'t',ث:'t',ج:'j',ح:'h',خ:'h',د:'d',ذ:'d',ر:'r',ز:'z',س:'s',ش:'s',ص:'s',ض:'d',ط:'t',ظ:'z',ع:'',غ:'g',ف:'f',ق:'k',ك:'k',ل:'l',م:'m',ن:'n',ه:'h',و:'w',ي:'y',ء:'',ؤ:'w',ئ:'y'};
  s = [...s].map(c => arabic[c] ?? c).join('').replace(/kh/g,'h').replace(/gh/g,'g').replace(/sh/g,'s').replace(/th/g,'t').replace(/dh/g,'d').replace(/q/g,'k');
  return s.replace(/[aeiouwy]/g, '').replace(/(.)\1+/g, '$1');
}
export function rankStaff(question, rows) {
  const tokens = nameTokens(question);
  if (!tokens.length || tokens.length > 6) return [];
  const unique = [...new Map(rows.map(row => [nameTokens(row.full_name).join(' '), row])).values()];
  const ranked = unique.map(row => {
    const names = nameTokens(row.full_name);
    let exact = 0, matched = 0;
    for (const token of tokens) {
      if (names.includes(token)) { exact++; matched++; }
      else if (phonetic(token).length >= 2 && names.some(n => phonetic(n) === phonetic(token))) matched++;
    }
    return {...row, name_score: exact * 3 + (matched - exact) * 2, exact_name: exact === tokens.length, query_tokens: tokens.length, matched};
  }).filter(row => row.matched === tokens.length).sort((a,b) => b.name_score-a.name_score || a.full_name.localeCompare(b.full_name));
  const doctors = ranked.filter(x => /(?:\bdr[.\s]|professor|lecturer|دكتور|استاذ)/i.test(normalize(x.full_name+' '+(x.job_title||''))));
  return /دكتور|دكتوره|\bdr\b|doctor|professor/.test(normalize(question)) && doctors.length ? doctors : ranked;
}

export function isCasual(question) {
  const q = normalize(question).trim();
  return /^(?:هلا|هلا والله|هلا كيفك|مرحبا|السلام عليكم|وعليكم السلام|كيفك|كيف حالك|شكرا|شكرا لك|مشكور|تسلم|hi|hello|hey|thanks|thank you|how are you)[!؟?.\s]*$/.test(q) || /(?:متوتر|متوتره|قلقان|قلقانه|مضغوط|مضغوطه|طفشان|تعبان|نصيحه|تنصحني|نظم وقتي|انظم وقتي|نكتة|نكته|stressed|anxious|study tips|motivat)/.test(q);
}
