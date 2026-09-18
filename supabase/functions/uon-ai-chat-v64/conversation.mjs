// Pure helpers shared by the live gateway and regression tests.
export function normalize(value) {
  return String(value ?? '').normalize('NFKD').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}
export function conversationHistory(input, question) {
  const rows = (Array.isArray(input) ? input : []).slice(-12).filter(x => x && ['user', 'assistant'].includes(x.role) && typeof x.content === 'string').map(x => ({role: x.role, content: x.content.slice(0, 1800), ...(x.role==='assistant'&&Array.isArray(x.staff_ids)?{staff_ids:x.staff_ids.filter(id=>Number.isSafeInteger(Number(id))&&Number(id)>0).slice(0,6).map(String)}:{})}));
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
export function rankStaff(question, rows, fuzzy = true) {
  const tokens = nameTokens(question);
  if (!tokens.length || tokens.length > 6) return [];
  const unique = [...new Map(rows.map(row => [nameTokens(row.full_name).join(' '), row])).values()];
  const ranked = unique.map(row => {
    const names = nameTokens(row.full_name);
    let exact = 0, matched = 0;
    for (const token of tokens) {
      if (names.includes(token)) { exact++; matched++; }
      else if (fuzzy && phonetic(token).length >= 2 && names.some(n => phonetic(n) === phonetic(token))) matched++;
    }
    return {...row, name_score: exact * 3 + (matched - exact) * 2, exact_name: exact === tokens.length, query_tokens: tokens.length, matched};
  }).filter(row => row.matched === tokens.length).sort((a,b) => b.name_score-a.name_score || a.full_name.localeCompare(b.full_name));
  const doctors = ranked.filter(x => /(?:\bdr[.\s]|professor|lecturer|دكتور|استاذ)/i.test(normalize(x.full_name+' '+(x.job_title||''))));
  return /دكتور|دكتوره|\bdr\b|doctor|professor/.test(normalize(question)) && doctors.length ? doctors : ranked;
}

export function isCasual(question) {
  const q = normalize(question).trim();
  return /^(?:حياك|حياك الله|الله يحييك|حيالله|يا هلا|هلا|هلا والله|هلا كيفك|مرحبا|مرحبتين|صباح الخير|صباح النور|مساء الخير|مساء النور|شخبارك|وش اخبارك|كيف امورك|تمام|زين|اوكي|مع السلامه|باي|العفو|يعطيك العافيه|الله يعافيك|السلام عليكم|وعليكم السلام|كيفك|كيف حالك|شكرا|شكرا لك|مشكور|تسلم|hi|hello|hey|thanks|thank you|how are you)[!؟?.\s]*$/.test(q) || /(?:متوتر|متوتره|قلقان|قلقانه|مضغوط|مضغوطه|طفشان|تعبان|نصيحه|تنصحني|نظم وقتي|انظم وقتي|نكتة|نكته|stressed|anxious|study tips|motivat)/.test(q);
}

export function intent(question) {
  const q=normalize(question);
  if (/معدل|\bgpa\b|تراكمي|فصلي/.test(q)) return 'gpa';
  if (/خطتي|وش اسجل|ويش اسجل|الفصل القادم|الفصل الجاي|رتب.*جدول|مواد.*متبقي/.test(q)) return 'plan';
  if (/دكتور|دكاتر|استاذ|موظف|ايميل|بريد|مكتبه|رقمه|عميد|رئيس|\bdr\b|professor|staff|email|his office|her office/.test(q)) return 'people';
  if (/موعد|تقويم|متي|تاريخ|اختبار|اجازه|calendar|exam|semester/.test(q)) return 'calendar';
  if (/ماده|مساق|مقرر|متطلب|\b[a-z]{2,10}\s*\d{2,4}[a-z]?\b|course|prerequisite/.test(q)) return 'course';
  if (/لائحه|قانون|سياسه|غياب|حرمان|انسحاب|حذف|اضافه|policy|regulation/.test(q)) return 'policy';
  if(isCasual(q))return 'chat';
  return 'general';
}
export function staffFollowup(question) {
  return /^(?:و?ايميله|و?بريده|و?رقمه|و?تخصصه|و?مكتبه|وين مكتبه|وين مكانه|عطني رقمه|عطني ايميله|عطيني رقمه|عطيني ايميله|ايميلها|رقمها|وين مكتبها|his email|her email|his phone|her phone|where is his office)[؟?!.\s]*$/i.test(normalize(question).trim());
}
export function selectionIndex(question) {
  const q=normalize(question).replace(/[؟?!.،]/g,'').trim();
  const match=q.match(/^(?:(?:لا|اقصد|قصدي|ابغي|اريد|اختار|اختيار|عطني|ايميل|رقم|مكتب|the|i mean)\s+)*(الاول|الاولي|الثاني|الثانيه|الثالث|الثالثه|الرابع|الخامس|السادس|first|second|third|fourth|fifth|sixth|[1-6١-٦])(?:\s+(?:واحد|وحده|one))?$/);
  if(!match)return -1;
  const groups=[['الاول','الاولي','first','1','١'],['الثاني','الثانيه','second','2','٢'],['الثالث','الثالثه','third','3','٣'],['الرابع','fourth','4','٤'],['الخامس','fifth','5','٥'],['السادس','sixth','6','٦']];
  return groups.findIndex(g=>g.includes(match[1]));
}
export function staffLookupMode(question, history = []) {
  const route = intent(question);
  if (['chat','gpa','plan','calendar','course','policy'].includes(route)) return null;
  const last = [...history].reverse().find(x => x.role === 'assistant');
  const hasStaff = Array.isArray(last?.staff_ids) && last.staff_ids.length > 0;
  if (hasStaff && (selectionIndex(question) >= 0 || staffFollowup(question) || /^(?:لا[،,]?\s*)?(?:أقصد|اقصد|قصدي)\s/.test(question.trim()))) return 'context';
  if (route === 'people') return 'explicit';
  const tokens = nameTokens(question);
  // No phonetic search for bare ordinary text, even if it resembles a surname.
  return tokens.length >= 2 && tokens.length <= 6 ? 'exact' : null;
}
export function resolveStaff(question, history, rows) {
  const lookup = staffLookupMode(question, history);
  if (!lookup) return {rows:[],selected:false,needsSelection:false};
  const index=selectionIndex(question),follow=staffFollowup(question);
  if(index>=0||follow){
    const last=[...history].reverse().find(x=>x.role==='assistant');
    const ids=Array.isArray(last?.staff_ids)?last.staff_ids:[];
    // Client-supplied IDs select only from the current public, active directory.
    const candidates=ids.map(id=>rows.find(r=>String(r.id)===String(id))).filter(Boolean);
    if(index>=0)return {rows:candidates[index]?[candidates[index]]:[],selected:Boolean(candidates[index]),needsSelection:!candidates[index]};
    if(candidates.length)return {rows:candidates,selected:candidates.length===1,needsSelection:candidates.length>1};
  }
  const q=question.replace(/^\s*(?:هلا(?: والله)?|مرحبا|حياك(?: الله)?|السلام عليكم|hi|hello)[،,!\s]+/i,'').replace(/^\s*(?:لا[،,]?\s*)?(?:أقصد|اقصد|قصدي)\s*/,'');
  return {rows:rankStaff(retrievalQuestion(q,history),rows,lookup !== 'exact'),selected:false,needsSelection:false};
}
export function publicField(value) {
  const s=String(value??'').trim().slice(0,500);
  return !s||/['�]{3,}/.test(s)||/^[.\s]+$/.test(s)?'':s;
}
export function staffCard(row) {
  return {id:row.id,name:publicField(row.full_name),title:publicField(row.job_title),department:publicField(row.department),college:publicField(row.college),email:publicField(row.email),phone:publicField(row.phone),extension:publicField(row.extension),office:publicField(row.office_location),url:publicField(row.source_url)};
}

export function relevantContext(question, rows) {
  const verified=rows.filter(x=>!/غير معتمده|غير معتمد|unverified|not yet approved/i.test(normalize(x.description)));
  const codes=String(question).toUpperCase().match(/\b[A-Z]{2,10}[ -]*\d{2,4}[A-Z]?\b/g)||[];
  if(!codes.length)return verified;
  const normalized=codes.map(x=>x.replace(/[ -]/g,''));
  return verified.filter(row=>{
    const found=String(row.title+' '+row.description).toUpperCase().match(/\b[A-Z]{2,10}[ -]*\d{2,4}[A-Z]?\b/g)||[];
    return found.some(code=>normalized.includes(code.replace(/[ -]/g,'')));
  });
}
