(function () {
  'use strict';

  const STORAGE_KEY = 'uonhub-language';

  const arToEn = new Map(Object.entries({
    'الرئيسية':'Home',
    'الأدوات':'Tools',
    'المساعد AI':'AI Assistant',
    'التواصل':'Contact',
    '🔥 الميزات':'🔥 Features',
    'UON Hub — منصة طلاب جامعة نزوى':'UON Hub — University of Nizwa Student Platform',
    'منصتك الشاملة':'Your complete hub',
    'للحياة الأكاديمية':'for academic life',
    'أدوات ذكية، ملخصات، جداول دراسية، وكل ما تحتاجه للنجاح':'Smart tools, summaries, study schedules, and everything you need to succeed',
    'كل أدواتك الجامعية المهمة في مكان واحد':'All your essential university tools in one place',
    'استكشف الأدوات':'Explore tools',
    'انضم للمجتمع':'Join the community',
    '✓ مجاني بالكامل':'✓ Completely free',
    '✓ مصمم لطلاب نزوى':'✓ Built for Nizwa students',
    '✓ يعمل على الجوال':'✓ Mobile friendly',
    'أدوات أساسية':'Essential tools',
    'متاح على مدار الساعة':'Available 24/7',
    'وصول سريع':'Quick access',
    'ابدأ من هنا':'Start here',
    'أكثر الخدمات استخدامًا بدون دوران':'Your most-used services, instantly',
    'حاسبة المعدل':'GPA Calculator',
    'فصلي وتراكمي ومواد معادة':'Semester, cumulative, and repeated courses',
    'الجدول الدراسي':'Study Schedule',
    'رتب أسبوعك واطبعه':'Plan and print your week',
    'مكتبة الملخصات':'Summary Library',
    'مواد وملفات طلابية':'Courses and student files',
    'مجموعات المواد':'Course Groups',
    'ابحث عن مجموعة مادتك':'Find your course group',
    'الأدوات المتاحة':'Available Tools',
    'مجموعة شاملة من الأدوات المصممة خصيصاً لتلبية احتياجاتك الأكاديمية في جامعة نزوى':'A complete set of tools designed for University of Nizwa students',
    'لماذا منصة جامعة نزوى؟':'Why UON Hub?',
    'نحن نقدم تجربة فريدة مصممة خصيصاً لطلاب جامعة نزوى':'A student-first experience designed for University of Nizwa',
    'سريع ومجاني':'Fast and Free',
    'جميع الأدوات متاحة بالكامل بدون أي تكلفة أو اشتراكات مخفية':'All tools are available with no fees or hidden subscriptions',
    'آمن وموثوق':'Safe and Reliable',
    'محتوى مراجع وموثق من طلاب جامعة نزوى مع نظام تقييم ذكي':'Student-powered content with thoughtful review and moderation',
    'متجاوب تماماً':'Fully Responsive',
    'تصميم يتكيف مع جميع الأجهزة من الجوال إلى سطح المكتب':'Designed for phones, tablets, and desktop devices',
    'المساعد الذكي 🤖':'AI Assistant 🤖',
    'اسألني عن أي شيء يخص جامعة نزوى':'Ask about University of Nizwa',
    'مساعد UON Hub':'UON Hub Assistant',
    'متصل الآن':'Online',
    'مسح':'Clear',
    '🏛️ الكليات':'🏛️ Colleges',
    '📊 المعدل':'📊 GPA',
    '🔗 الروابط':'🔗 Links',
    '💡 نصائح':'💡 Tips',
    'حاسبة المعدل التراكمي 📊':'GPA Calculator 📊',
    'احسب معدل الفصل والمعدل التراكمي المتوقع مع دعم المواد المعادة':'Calculate semester and expected cumulative GPA, including repeated courses',
    'المعدل التراكمي الحالي':'Current cumulative GPA',
    'مجموع الساعات السابقة':'Previously completed credit hours',
    'المادة':'Course',
    'الساعات':'Credits',
    'التقدير المتوقع':'Expected grade',
    'معادة؟':'Repeated?',
    'الدرجة السابقة':'Previous grade',
    '+ إضافة مادة':'+ Add course',
    'احسب المعدل ⚡':'Calculate GPA ⚡',
    'معدل الفصل':'Semester GPA',
    'المعدل التراكمي المتوقع':'Expected cumulative GPA',
    'في المادة المعادة اختر الدرجة السابقة. لا تُضاف ساعات المادة المعادة مرة ثانية إلى مجموع الساعات التراكمية.':'For a repeated course, select the previous grade. Its credit hours are not added twice.',
    'أرقام جامعة نزوى 📞':'University Contacts 📞',
    'اضغط على الرقم للاتصال مباشرة':'Tap a number to call',
    'حساب البنك':'Bank Account',
    'المالية':'Finance',
    'القبول والتسجيل':'Admission and Registration',
    'الرعاية الاجتماعية 1':'Student Welfare 1',
    'الرعاية الاجتماعية 2':'Student Welfare 2',
    'روابط سريعة 🔗':'Quick Links 🔗',
    'البوابة الطلابية':'Student Portal',
    'المكتبة':'Library',
    'الموقع الرسمي':'Official Website',
    'كل ما يحتاجه طالب جامعة نزوى في مكان واحد.':'Everything a University of Nizwa student needs in one place.',
    'تجهيز الأدوات...':'Preparing tools...'
  }));

  const placeholderMap = {
    'ابحث في الأدوات، الملخصات، المطاعم...':'Search tools, summaries, and services...',
    'اكتب سؤالك هنا...':'Type your question...',
    'مثال: 2.75':'Example: 2.75',
    'بدون ساعات الفصل الحالي':'Excluding current semester credits',
    'اسم المادة':'Course name'
  };

  const toolTitleMap = {
    'مساعد AI ذكي':'Smart AI Assistant',
    'حاسبة المعدل':'GPA Calculator',
    'الجدول الدراسي':'Study Schedule',
    'اعترافات الطلاب':'Student Confessions',
    'الملخصات الدراسية':'Study Summaries',
    'مطاعم قريبة':'Nearby Restaurants',
    'أدوات أكاديمية':'Academic Tools',
    'مجموعات المواد':'Course Groups',
    'سوق الطلاب':'Student Marketplace',
    'مشاريع الطلاب':'Student Projects',
    'دليل الجامعة الرسمي':'Official University Guide'
  };

  const originalText = new WeakMap();
  const originalPlaceholder = new WeakMap();

  function translateNode(node, lang) {
    const original = originalText.get(node) ?? node.nodeValue;
    if (!originalText.has(node)) originalText.set(node, original);
    const trimmed = original.trim();
    if (!trimmed) return;
    node.nodeValue = lang === 'en' && arToEn.has(trimmed)
      ? original.replace(trimmed, arToEn.get(trimmed))
      : original;
  }

  function translatePage(lang) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        return !p || ['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => translateNode(node, lang));

    document.querySelectorAll('[placeholder]').forEach(el => {
      if (!originalPlaceholder.has(el)) originalPlaceholder.set(el, el.getAttribute('placeholder') || '');
      const original = originalPlaceholder.get(el);
      el.setAttribute('placeholder', lang === 'en' ? (placeholderMap[original] || original) : original);
    });

    document.querySelectorAll('.tool-card h3').forEach(el => {
      const ar = el.dataset.arText || el.textContent.trim();
      el.dataset.arText = ar;
      el.textContent = lang === 'en' ? (toolTitleMap[ar] || ar) : ar;
    });

    const button = document.getElementById('langToggleBtn');
    if (button) {
      const label = button.querySelector('span');
      if (label) label.textContent = lang === 'ar' ? 'EN' : 'AR';
    }
  }

  function applyLanguage(lang) {
    const language = lang === 'en' ? 'en' : 'ar';
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('lang-en', language === 'en');
    translatePage(language);
    localStorage.setItem(STORAGE_KEY, language);
  }

  window.toggleUONHubLanguage = function () {
    const current = localStorage.getItem(STORAGE_KEY) || 'ar';
    applyLanguage(current === 'ar' ? 'en' : 'ar');
  };
  window.setUONHubLanguage = applyLanguage;
  window.getUONHubLanguage = () => localStorage.getItem(STORAGE_KEY) || 'ar';

  function init() {
    applyLanguage(window.getUONHubLanguage());
    const grid = document.getElementById('toolsGrid');
    if (grid) {
      let timer;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => translatePage(window.getUONHubLanguage()), 80);
      });
      observer.observe(grid, { childList:true, subtree:true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
