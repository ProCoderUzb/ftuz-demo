import { CircleCheck, Info, Lightbulb, OctagonAlert, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { CategoryRef, Currency, Tip } from '../api/types'
import { categoryName, formatMoney, formatPercent, relativeDay } from '../lib/format'
import { EmptyState } from './ui'

const ICON = { danger: OctagonAlert, warning: TriangleAlert, info: Info, success: CircleCheck }
const MONEY_PARAMS = ['amount', 'target', 'left']

function renderParams(params: Record<string, unknown>) {
  const currency = (params.currency as Currency) ?? 'UZS'
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(params)) {
    if (key === 'category') out.category = categoryName(value as CategoryRef)
    else if (MONEY_PARAMS.includes(key)) out[key] = formatMoney(String(value), currency)
    else if (key === 'due') out.due = relativeDay(String(value))
    else if (key === 'rate' || key === 'percent') out[key] = formatPercent(Number(value)).replace('%', '')
    else out[key] = value as string | number
  }
  return out
}

export function TipList({ tips, limit }: { tips: Tip[]; limit?: number }) {
  const { t } = useTranslation()
  const shown = limit ? tips.slice(0, limit) : tips
  if (!shown.length) return <EmptyState icon={Lightbulb} text={t('tips.start_tracking')} />
  return (
    <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
      {shown.map((tip, i) => {
        const Icon = ICON[tip.level] ?? Info
        return (
          <li key={`${tip.code}-${i}`} className={`tip tip-${tip.level}`}>
            <Icon size={18} aria-hidden />
            <span>{t(`tips.${tip.code}`, renderParams(tip.params))}</span>
          </li>
        )
      })}
    </ul>
  )
}
