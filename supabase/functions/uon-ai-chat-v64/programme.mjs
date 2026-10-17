import {normalize} from './conversation.mjs';

// Read the university's labelled cells as pairs; never infer a value by position
// in flattened page text or reuse a number from a different programme.
export function programmeFields(html, textFromHTML) {
 const cells=kind=>[...html.matchAll(new RegExp(`<td\\b[^>]*\\bclass=(?:["']${kind}["']|${kind}(?=[\\s>]))[^>]*>([\\s\\S]*?)<\\/td>`, 'gi'))].map(m=>textFromHTML(m[1]).trim());
 const labels=cells('programhead'),values=cells('programdata');
 if(!labels.length||labels.length>8||labels.length!==values.length||new Set(labels).size!==labels.length)return [];
 return labels.map((label,i)=>({label,value:values[i]})).filter(x=>x.label.length<200&&x.value.length<100&&/\d|[٠-٩]/.test(x.value));
}
export function programmeFacet(question) {
 const q=normalize(question).split(' — ').at(-1);
 // Calculations and admissions need interpretation beyond a displayed table.
 if(/احسب|متبقي|باقي|خصم|منحه|شروط|قبول|معدل|calculate|remaining|discount|scholarship|admission|gpa/.test(q))return '';
 if(/رسوم|تكلفه|سعر|tuition|fees|cost/.test(q))return 'fees';
 if(/مده|مدته|سنوات|كم سنه|how long|duration/.test(q))return 'duration';
 if(/ساعات|ساعاته|عدد.*ساعه|how many credits/.test(q))return 'credits';
 return '';
}
export function directProgrammeAnswer(question,rows,language='ar') {
 const facet=programmeFacet(question);if(!facet)return null;
 const sources=rows.filter(r=>r.official&&r.live&&/^https:\/\/www\.unizwa\.edu\.om\/program_details\.php\?programid=\d+$/.test(r.url)&&r.programme_fields?.length);
 if(sources.length!==1)return null;
 const source=sources[0];
 const patterns={fees:/قيمه الساعه|تكلفه|رسوم/,duration:/مده الدراسه/,credits:/اجمالي الساعات/};
 const fields=source.programme_fields.filter(x=>patterns[facet].test(normalize(x.label)));
 if(!fields.length)return null;
 const en=language==='en';
 return {answer:(en?`The university page for ${source.title} lists:`:`حسب صفحة الجامعة لبرنامج ${source.title}:`)+ '\n'+fields.map(x=>`${x.label}: ${x.value}`).join('\n')+'\n\n'+(en?'These are the figures displayed on the official page; confirm with admissions before registering.':'هذي البيانات المعروضة في الصفحة الرسمية؛ تأكد من القبول والتسجيل قبل التسجيل.'),sources:[source],mode:'programs'};
}
