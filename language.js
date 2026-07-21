(function () {
  'use strict'

  const STORAGE_KEY = 'uonhub-language'
  const translations = {
    ar: {
      nav_home: 'الرئيسية',
      nav_tools: 'الأدوات',
      nav_ai: 'المساعد AI',
      nav_contact: 'التواصل',
      hero_title: 'منصتك الشاملة<br>للحياة الأكاديمية',
      hero_desc: 'أدوات ذكية، ملخصات، جداول دراسية، وكل ما تحتاجه للنجاح',
      tools_title: 'الأدوات المتاحة',
      ai_title: 'المساعد الذكي 🤖',
      gpa_title: 'حاسبة المعدل التراكمي 📊'
    },
    en: {
      nav_home: 'Home',
      nav_tools: 'Tools',
      nav_ai: 'AI Assistant',
      nav_contact: 'Contact',
      hero_title: 'Your Complete Hub<br>for Academic Life',
      hero_desc: 'Smart tools, summaries, schedules, and everything you need to succeed',
      tools_title: 'Available Tools',
      ai_title: 'AI Assistant 🤖',
      gpa_title: 'GPA Calculator 📊'
    }
  }

  function applyLanguage(lang) {
    const language = lang === 'en' ? 'en' : 'ar'
    const dict = translations[language]

    document.documentElement.lang = language
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.body?.classList.toggle('lang-en', language === 'en')

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n')
      if (dict[key]) el.textContent = dict[key]
    })

    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html')
      if (dict[key]) el.innerHTML = dict[key]
    })

    const button = document.getElementById('langToggleBtn')
    if (button) {
      const label = button.querySelector('span')
      if (label) label.textContent = language === 'ar' ? 'EN' : 'AR'
      button.title = language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'
    }

    localStorage.setItem(STORAGE_KEY, language)
  }

  window.toggleUONHubLanguage = function () {
    const current = localStorage.getItem(STORAGE_KEY) || 'ar'
    applyLanguage(current === 'ar' ? 'en' : 'ar')
  }

  window.setUONHubLanguage = applyLanguage
  window.getUONHubLanguage = function () {
    return localStorage.getItem(STORAGE_KEY) || 'ar'
  }

  function init() {
    applyLanguage(window.getUONHubLanguage())
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
