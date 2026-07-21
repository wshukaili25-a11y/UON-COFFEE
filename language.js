(function () {
  'use strict'

  const STORAGE_KEY = 'uonhub-language'
  const supported = new Set(['ar', 'en'])
  let dictionary = {}
  let currentLanguage = localStorage.getItem(STORAGE_KEY) || 'ar'

  function getByPath(object, path) {
    return path.split('.').reduce((value, key) => {
      return value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined
    }, object)
  }

  function t(path, fallback = '') {
    const value = getByPath(dictionary, path)
    return typeof value === 'string' ? value : fallback
  }

  async function loadDictionary(language) {
    const lang = supported.has(language) ? language : 'ar'
    const response = await fetch(`locales/${lang}.json?v=2.2`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Could not load ${lang} locale`)
    return response.json()
  }

  function updateStaticText() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n')
      const translated = t(key)
      if (translated) element.textContent = translated
    })

    document.querySelectorAll('[data-i18n-html]').forEach(element => {
      const key = element.getAttribute('data-i18n-html')
      const translated = t(key)
      if (translated) element.innerHTML = translated
    })

    const button = document.getElementById('langToggleBtn')
    if (button) {
      const label = button.querySelector('span')
      if (label) label.textContent = currentLanguage === 'ar' ? 'EN' : 'AR'
      button.title = currentLanguage === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'
    }
  }

  async function applyLanguage(language) {
    const nextLanguage = supported.has(language) ? language : 'ar'

    try {
      dictionary = await loadDictionary(nextLanguage)
      currentLanguage = nextLanguage
      localStorage.setItem(STORAGE_KEY, currentLanguage)

      document.documentElement.lang = dictionary.meta?.lang || currentLanguage
      document.documentElement.dir = dictionary.meta?.dir || (currentLanguage === 'ar' ? 'rtl' : 'ltr')
      document.body.classList.toggle('lang-en', currentLanguage === 'en')

      updateStaticText()

      window.dispatchEvent(new CustomEvent('uonhub:languagechange', {
        detail: { language: currentLanguage }
      }))
    } catch (error) {
      console.error('[UON Hub] Language loading failed:', error)
    }
  }

  window.UON_I18N = {
    t,
    get language() { return currentLanguage },
    setLanguage: applyLanguage
  }

  window.toggleUONHubLanguage = function () {
    applyLanguage(currentLanguage === 'ar' ? 'en' : 'ar')
  }

  function init() {
    applyLanguage(currentLanguage)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
