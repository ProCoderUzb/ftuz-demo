import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import type { Lang } from '../api/types'
import en from './locales/en'
import ru from './locales/ru'
import uz from './locales/uz'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'uz', label: 'Oʻzbekcha' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]

const STORAGE_KEY = 'ftuz.lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'uz' || saved === 'ru' || saved === 'en') return saved
  } catch {
    /* ignore */
  }
  const nav = navigator.language.slice(0, 2)
  return nav === 'ru' || nav === 'en' ? nav : 'uz'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru }, uz: { translation: uz } },
  lng: initialLang(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnObjects: true,
})

export function setLanguage(lang: Lang) {
  void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* ignore */
  }
}

document.documentElement.lang = i18n.language

export default i18n
