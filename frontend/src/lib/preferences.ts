import type { ThemePref, User } from '../api/types'

const media = window.matchMedia('(prefers-color-scheme: dark)')
let currentTheme: ThemePref = 'system'

function resolveTheme() {
  const dark = currentTheme === 'dark' || (currentTheme === 'system' && media.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a111e' : '#047857')
}

media.addEventListener('change', resolveTheme)

export function applyPreferences(prefs: Pick<User, 'theme' | 'text_size' | 'simple_mode'>) {
  currentTheme = prefs.theme
  const root = document.documentElement
  root.dataset.text = prefs.text_size
  root.dataset.simple = String(prefs.simple_mode)
  resolveTheme()
  try {
    localStorage.setItem('ftuz.prefs', JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

/** Before sign-in, reuse the last known preferences so the login page matches. */
export function applyStoredPreferences() {
  let prefs: Pick<User, 'theme' | 'text_size' | 'simple_mode'> = { theme: 'system', text_size: 'm', simple_mode: false }
  try {
    const raw = localStorage.getItem('ftuz.prefs')
    if (raw) prefs = { ...prefs, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  applyPreferences(prefs)
}
