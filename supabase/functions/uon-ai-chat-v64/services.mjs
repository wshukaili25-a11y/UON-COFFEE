import { normalize, serviceTopic } from './conversation.mjs';

// Stable public entry points. Individual dates and rooms are deliberately not
// stored here: students obtain their own details on the university portal.
export function placementSources(question) {
  if(serviceTopic(question)!=='placement')return [];
  return [
    {type:'رابط رسمي',title:'الاستعلام عن موعد وقاعة اختبار تحديد المستوى',description:'تتيح بوابة جامعة نزوى للطلبة الجدد الاستعلام عن تفاصيل اختبار تحديد المستوى باستخدام الرقم الجامعي أو الرقم المدني. تُعرض التفاصيل الخاصة بالطالب في البوابة. أدخل الرقم في موقع الجامعة فقط، ولا ترسله إلى المحادثة.',url:'https://portal.unizwa.edu.om/info/fiexam.php',official:true,score:0},
    {type:'معلومة رسمية',title:'اختبار تحديد المستوى للغة الإنجليزية — معهد التأسيس',description:'يعتمد معهد التأسيس اختبار Linguaskill للغة الإنجليزية في الكتابة والقراءة والاستماع. لا توجد اختبارات تحديد مستوى للرياضيات أو محو الأمية الرقمية أو مهارات الحياة والتعلم. المصدر يشرح الاختبار ولا يحدد الموعد أو القاعة لطالب بعينه.',url:'https://www.unizwa.edu.om/mobile.php?contentid=2931',official:true,score:0}
  ];
}

// UON Hub's own tools, offered as source cards when a student asks for study
// files or help building a registration timetable. These are platform pages,
// not official university records.
export function hubSources(question) {
  const q=normalize(question),out=[];
  if(/شروحات|ملخص|ملخصات|ملفات الماده|ملفات المقرر|سلايدات|اختبارات سابقه|امتحانات سابقه|نماذج اختبار|summar|notes|slides|past exam|past paper/.test(q))
    out.push({type:'خدمة UON Hub',title:'مكتبة الملخصات والملفات — UON Hub',description:'مكتبة UON Hub للملخصات والشروحات وملفات المقررات التي يشاركها الطلبة، مع بحث حسب رمز المقرر أو الكلية. يقدر الطالب يطلب ملفًا غير موجود أو يرفع ملفه للمراجعة.',url:'/summaries.html',official:false,score:0});
  if(/تسجيل المقررات|تسجيل المواد|تسجيل المساقات|اسجل المقررات|اسجل المواد|اسجل مواد|جدولي|جدول دراسي|اسوي جدول|ابني جدول|رتب جدول|تعارض|الشعب المتاحه|timetable|schedule|register courses|course registration/.test(q))
    out.push({type:'خدمة UON Hub',title:'مولّد الجدول الدراسي — UON Hub',description:'أداة في UON Hub تبني جدولًا بدون تعارض قبل التسجيل: أدخل المواد والشعب يدويًا أو ارفع صور الشعب المتاحة من EduWave. التسجيل الفعلي يتم في نظام الجامعة خلال فترة التسجيل المعلنة في التقويم الأكاديمي.',url:'/schedule.html',official:false,score:0});
  return out;
}

export function directServiceAnswer(question, rows, language='ar') {
  const q=normalize(question),topic=serviceTopic(question),en=language==='en';
  const booking=/احجز|حجز|book|appointment|رابط|link/.test(q);
  if(['anjiz','masalik'].includes(topic)&&booking){
    const source=rows.find(row=>serviceTopic(row.title)===topic&&row.type==='مركز دعم'&&/^https:\/\//.test(row.url));
    if(!source)return null;
    const name=en?(topic==='anjiz'?'Anjiz Center':'Learning Pathways Enhancement Center'):source.title;
    return {answer:en?`You can book a session at ${name} using the booking link below. Open the university portal to view the available sessions and complete your booking.`:`تقدر تحجز موعد في ${name} من رابط الحجز أدناه. افتح بوابة الجامعة للاطلاع على الجلسات المتاحة وإكمال الحجز.`,sources:[source],mode:'service'};
  }
  if(topic==='placement'&&/موعد|قاعه|وقت|تاريخ|متي|رابط|استعلام|وين|where|when|room|date|time|link/.test(q)&& !/تقسيم|درجات|درجه|نتيج|نتائج|score|result|mark/.test(q)){
    const source=rows.find(row=>row.url==='https://portal.unizwa.edu.om/info/fiexam.php');
    if(!source)return null;
    return {answer:en?'To find your placement-test date, time and room, open the university enquiry page below and enter your university ID or civil ID there. Your personal test details appear in the portal; do not send your ID in this chat.':'لمعرفة موعد وقاعة اختبار تحديد المستوى، افتح صفحة الاستعلام الرسمية أدناه وأدخل رقمك الجامعي أو المدني في موقع الجامعة. بتظهر لك تفاصيل اختبارك هناك: اليوم والتاريخ والوقت والقاعة. لا ترسل رقمك في المحادثة.',sources:[source],mode:'service'};
  }
  return null;
}
