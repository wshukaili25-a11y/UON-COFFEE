
(function(){
  const dict = {
    'الرئيسية':'Home','الأدوات':'Tools','المساعد AI':'AI Assistant','التواصل':'Contact','الميزات':'Features',
    'بحث':'Search','ابحث في الأدوات، الملخصات، المطاعم...':'Search tools, summaries, restaurants...',
    'منصة جديدة كلياً لطلاب جامعة نزوى':'A modern platform for University of Nizwa students',
    'منصتك الشاملة':'Your all-in-one hub','للحياة الأكاديمية':'for campus life',
    'أدوات ذكية، ملخصات، جداول دراسية، وكل ما تحتاجه للنجاح':'Smart tools, summaries, study schedules, and everything you need to succeed',
    'كل أدواتك الجامعية المهمة في مكان واحد':'Everything you need for university, in one place',
    'استكشف الأدوات':'Explore tools','انضم للمجتمع':'Join the community',
    'مجاني بالكامل':'Completely free','مصمم لطلاب نزوى':'Built for Nizwa students','يعمل على الجوال':'Mobile friendly',
    'أدوات أساسية':'Core tools','متاح على مدار الساعة':'Available 24/7','وصول سريع':'Quick access',
    'أكثر الخدمات استخداماً':'Most-used services','افتح الآن':'Open now',
    'الأدوات المتاحة':'Available tools','مجموعة شاملة من الأدوات المصممة خصيصاً لتلبية احتياجاتك الأكاديمية في جامعة نزوى':'A complete set of tools designed for University of Nizwa students',
    'لماذا منصة جامعة نزوى؟':'Why UON Hub?','نحن نقدم تجربة فريدة مصممة خصيصاً لطلاب جامعة نزوى':'A student-first experience built for the University of Nizwa community',
    'سريع ومجاني':'Fast and free','جميع الأدوات متاحة بالكامل بدون أي تكلفة أو اشتراكات مخفية':'Useful tools with no hidden subscriptions',
    'آمن وموثوق':'Safe and reliable','محتوى مراجع وموثق من طلاب جامعة نزوى مع نظام تقييم ذكي':'Student-powered content with careful moderation',
    'متجاوب تماماً':'Fully responsive','تصميم يتكيف مع جميع الأجهزة من الجوال إلى سطح المكتب':'Designed for phones, tablets, and desktops',
    'المساعد الذكي 🤖':'AI Assistant 🤖','اسألني عن أي شيء يخص جامعة نزوى':'Ask about University of Nizwa services and student life',
    'مسح':'Clear','متصل الآن':'Online now','اكتب سؤالك هنا...':'Type your question...',
    'حاسبة المعدل التراكمي 📊':'Cumulative GPA Calculator 📊','احسب معدل الفصل والمعدل التراكمي المتوقع مع دعم المواد المعادة':'Calculate semester and expected cumulative GPA, including repeated courses',
    'المعدل التراكمي الحالي':'Current cumulative GPA','مجموع الساعات السابقة':'Completed credit hours','المادة':'Course','الساعات':'Credits',
    'التقدير المتوقع':'Expected grade','معادة؟':'Repeated?','الدرجة السابقة':'Previous grade','إضافة مادة':'Add course','احسب المعدل':'Calculate GPA',
    'معدل الفصل':'Semester GPA','المعدل التراكمي المتوقع':'Expected cumulative GPA',
    'أرقام جامعة نزوى 📞':'University of Nizwa contacts 📞','اضغط على الرقم للاتصال مباشرة':'Tap a number to call',
    'روابط سريعة 🔗':'Quick links 🔗','البوابة الطلابية':'Student Portal','المالية':'Finance','القبول والتسجيل':'Admission & Registration',
    'الرعاية الاجتماعية 1':'Student Welfare 1','الرعاية الاجتماعية 2':'Student Welfare 2','المكتبة':'Library','الموقع الرسمي':'Official website',
    'كل ما يحتاجه طالب جامعة نزوى في مكان واحد.':'Everything a University of Nizwa student needs, in one place.',
    'جميع الحقوق محفوظة':'All rights reserved','صنع بحب':'Built with love','من طلاب جامعة نزوى':'by University of Nizwa students',
    'سوق الطلاب':'Student Marketplace','مجموعات الواتساب':'WhatsApp Groups','مكتبة الملخصات':'Summary Library','الجدول الدراسي':'Study Schedule',
    'اعترافات الطلاب':'Student Confessions','دليل المطاعم':'Restaurant Guide','مكتبة الأدوات':'Tools Library','مساعد AI ذكي':'Smart AI Assistant',
    'حاسبة المعدل':'GPA Calculator','بنك الأسئلة':'Question Bank','المشاريع':'Projects','رفع ملخص':'Upload Summary',
    'لوحة التحكم':'Dashboard','نظرة عامة':'Overview','الإشعارات':'Notifications','الإعلانات':'Announcements','إعدادات الموقع':'Site Settings',
    'تسجيل الخروج':'Log out','دخول':'Sign in','كلمة المرور غير صحيحة!':'Incorrect password!','المشرف':'Administrator',
    'جارٍ التحميل...':'Loading...','جاري التحميل...':'Loading...','لا توجد بيانات':'No data','قبول':'Approve','رفض':'Reject','حذف':'Delete',
    'إضافة إعلان':'Submit listing','إرسال للمراجعة':'Submit for review','بانتظار الموافقة':'Pending approval','الإعلانات المعتمدة':'Approved listings',
    'دليل الجامعة الرسمي':'Official University Guide','استكشف البرامج':'Explore programs','دليل برامج جامعة نزوى':'University of Nizwa Program Guide',
    'معلومات مرتبطة بالمصادر الرسمية':'Linked to official sources','كل الكليات':'All colleges','كل الدرجات':'All degrees',
    'حاسبة تكلفة تقريبية':'Estimated Tuition Calculator','المصدر الرسمي':'Official source','سعر الساعة المنشور':'Published credit-hour price',
    'العربية':'العربية','English':'English','تجاوز إلى الأدوات':'Skip to tools','أنت غير متصل — بعض البيانات قد لا تتحدث الآن':'You are offline — some data may not update'
  };
  let lang = localStorage.getItem('uon_hub_lang') || 'ar';
  const originalText = new WeakMap();
  const attrs = ['placeholder','title','aria-label'];
  function normalize(s){return String(s||'').replace(/\s+/g,' ').trim()}
  function translateString(s){
    const n=normalize(s); if(!n) return s;
    if(lang==='en' && dict[n]) return s.replace(n,dict[n]);
    if(lang==='ar'){
      const hit=Object.entries(dict).find(([,v])=>v===n);
      if(hit) return s.replace(n,hit[0]);
    }
    return s;
  }
  function translateNode(node){
    if(node.nodeType===3){
      if(!originalText.has(node)) originalText.set(node,node.nodeValue);
      const base=originalText.get(node);
      node.nodeValue = lang==='en' ? translateString(base) : base;
      return;
    }
    if(node.nodeType!==1 || ['SCRIPT','STYLE','CODE'].includes(node.tagName)) return;
    attrs.forEach(a=>{
      if(node.hasAttribute(a)){
        const key='data-i18n-original-'+a.replace('aria-','aria');
        if(!node.hasAttribute(key)) node.setAttribute(key,node.getAttribute(a));
        const base=node.getAttribute(key);
        node.setAttribute(a,lang==='en'?translateString(base):base);
      }
    });
    [...node.childNodes].forEach(translateNode);
  }
  function apply(){
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    translateNode(document.body);
    document.querySelectorAll('.hub-language-toggle').forEach(btn=>{
      btn.innerHTML=lang==='ar'?'<span>EN</span><i class="fas fa-globe"></i>':'<i class="fas fa-globe"></i><span>العربية</span>';
      btn.setAttribute('aria-label',lang==='ar'?'Switch to English':'التبديل إلى العربية');
    });
  }
  window.toggleHubLanguage=function(){lang=lang==='ar'?'en':'ar';localStorage.setItem('uon_hub_lang',lang);apply()};
  document.addEventListener('DOMContentLoaded',()=>{
    const target=document.querySelector('.nav-actions')||document.querySelector('.page-header')||document.body;
    if(!document.querySelector('.hub-language-toggle')){
      const b=document.createElement('button');b.type='button';b.className='hub-language-toggle';b.onclick=window.toggleHubLanguage;
      if(target===document.body){b.style.cssText='position:fixed;top:14px;left:14px;z-index:99999';target.appendChild(b)}else target.prepend(b);
    }
    apply();
    const obs=new MutationObserver(ms=>{ms.forEach(m=>m.addedNodes.forEach(n=>translateNode(n)));document.querySelectorAll('.hub-language-toggle').forEach(btn=>btn.innerHTML=lang==='ar'?'<span>EN</span><i class="fas fa-globe"></i>':'<i class="fas fa-globe"></i><span>العربية</span>')});
    obs.observe(document.body,{childList:true,subtree:true});
  });
})();
