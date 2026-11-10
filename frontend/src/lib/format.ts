import i18n from '../i18n'
import type { Category, CategoryRef, Currency } from '../api/types'

const GROUP = ' ' // narrow no-break space: "1 250 000"

function group(intPart: string) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP)
}

export function toNumber(value: string | number | null | undefined) {
  const n = typeof value === 'number' ? value : parseFloat(value ?? '0')
  return Number.isFinite(n) ? n : 0
}

interface MoneyOptions {
  sign?: boolean // force a leading + / −
  decimals?: number
}

/** 1250000 UZS -> "1 250 000 soʻm"; 12.5 USD -> "$12.50". */
export function formatMoney(value: string | number, currency: Currency = 'UZS', opts: MoneyOptions = {}) {
  const n = toNumber(value)
  const decimals = opts.decimals ?? (currency === 'USD' ? 2 : 0)
  const fixed = Math.abs(n).toFixed(decimals)
  const [intPart, frac] = fixed.split('.')
  const lang = i18n.language
  const decimalSep = lang === 'en' ? '.' : ','
  const body = group(intPart) + (frac ? decimalSep + frac : '')
  const minus = n < 0 ? '−' : opts.sign && n > 0 ? '+' : ''
  if (currency === 'USD') return `${minus}$${body}`
  return `${minus}${body}${GROUP}${i18n.t('currency.UZS')}`
}

/** Short axis labels: 1 250 000 -> "1,3 mln" / "1.3M". */
export function formatCompact(value: number) {
  const lang = i18n.language
  const abs = Math.abs(value)
  const units =
    lang === 'uz'
      ? { b: 'mlrd', m: 'mln', k: 'ming' }
      : lang === 'ru'
        ? { b: 'млрд', m: 'млн', k: 'тыс.' }
        : { b: 'B', m: 'M', k: 'K' }
  const sep = lang === 'en' ? '' : ' '
  const fmt = (n: number) => {
    const s = n >= 10 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, '')
    return lang === 'en' ? s : s.replace('.', ',')
  }
  if (abs >= 1e9) return fmt(value / 1e9) + sep + units.b
  if (abs >= 1e6) return fmt(value / 1e6) + sep + units.m
  if (abs >= 1e3) return fmt(value / 1e3) + sep + units.k
  return String(Math.round(value))
}

export function formatPercent(value: number | null | undefined, sign = false) {
  if (value == null) return '—'
  const s = Math.abs(value).toFixed(Math.abs(value) < 10 && value % 1 !== 0 ? 1 : 0)
  const prefix = value < 0 ? '−' : sign && value > 0 ? '+' : ''
  return `${prefix}${i18n.language === 'en' ? s : s.replace('.', ',')}%`
}

export function categoryName(category: Pick<Category, 'key' | 'name'> | CategoryRef | undefined) {
  if (!category) return ''
  if (category.name) return category.name
  return i18n.t(`categories.names.${category.key}`, { defaultValue: category.key })
}

// ---------- dates ----------

export function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function today() {
  return isoDate(new Date())
}

export function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return isoDate(d)
}

export function currentMonth() {
  return today().slice(0, 7)
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month: string, short = false) {
  const [y, m] = month.split('-').map(Number)
  const names = i18n.t(short ? 'monthsShort' : 'months', { returnObjects: true }) as unknown as string[]
  return short ? names[m - 1] : `${names[m - 1]} ${y}`
}

export function dayLabel(iso: string) {
  if (iso === today()) return i18n.t('common.today')
  if (iso === yesterday()) return i18n.t('common.yesterday')
  const [y, m, d] = iso.split('-').map(Number)
  const names = i18n.t('months', { returnObjects: true }) as unknown as string[]
  const sameYear = y === new Date().getFullYear()
  return `${d} ${names[m - 1].toLowerCase()}${sameYear ? '' : ` ${y}`}`
}

/** Whole days from today to `iso` (negative when it is in the past). */
export function daysFromToday(iso: string) {
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86_400_000)
}

/** "today" / "tomorrow" / "in 3 days" / "2 days ago", lower-case to sit inside a sentence. */
export function relativeDay(iso: string) {
  const days = daysFromToday(iso)
  if (days === 0) return i18n.t('debts.when.today')
  if (days === 1) return i18n.t('debts.when.tomorrow')
  if (days === -1) return i18n.t('debts.when.yesterday')
  return days > 0 ? i18n.t('debts.when.inDays', { count: days }) : i18n.t('debts.when.daysAgo', { count: -days })
}

// ---------- amount input ----------

/** Keep only digits and one decimal separator, and group thousands while typing. */
export function formatAmountInput(raw: string) {
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.')
  const [intPart, ...rest] = cleaned.split('.')
  const frac = rest.join('').slice(0, 2)
  const grouped = group(intPart.replace(/^0+(?=\d)/, ''))
  return cleaned.includes('.') ? `${grouped}.${frac}` : grouped
}

export function parseAmountInput(display: string) {
  return display.replace(new RegExp(GROUP, 'g'), '').replace(/\s/g, '')
}
