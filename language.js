(function () {
  'use strict'

  const STORAGE_KEY = 'uonhub-language'
  const supported = new Set(['ar', 'en'])

  function applyLanguage(language) {
    const lang = supported.has(language) ? language : 'ar'
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.body?.classList.toggle('lang-en', lang === 'en')
    localStorage.setItem(STORAGE_KEY, lang)
    window.dispatchEvent(new CustomEvent('uonhub:languagechange', { detail: { language: lang } }))
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
