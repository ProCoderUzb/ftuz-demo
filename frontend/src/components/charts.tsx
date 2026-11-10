import { useTranslation } from 'react-i18next'
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import type { CategoryBreakdown } from '../api/types'
import { categoryName, formatCompact, formatMoney, formatPercent, monthLabel, toNumber } from '../lib/format'

const AXIS = { fontSize: 12, fill: 'var(--chart-axis)' }

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color: string }[] }) {
  return (
    <div className="chart-tooltip">
      <strong>{title}</strong>
      {rows.map((r) => (
        <div key={r.label} className="row" style={{ gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color }} aria-hidden />
          <span className="muted">{r.label}</span>
          <span className="num" style={{ marginLeft: 'auto', fontWeight: 600 }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Top categories plus a grey "Other" bucket, so the donut never needs more than 6 hues. */
export function topSlices(categories: CategoryBreakdown[], max = 5) {
  const expenses = categories.filter((c) => c.kind === 'expense' && toNumber(c.amount) > 0)
  const top = expenses.slice(0, max).map((c) => ({
    key: String(c.category.id), name: categoryName(c.category), value: toNumber(c.amount), share: c.share, color: c.category.color,
  }))
  const rest = expenses.slice(max)
  if (rest.length) {
    const value = rest.reduce((s, c) => s + toNumber(c.amount), 0)
    const share = rest.reduce((s, c) => s + c.share, 0)
    top.push({ key: 'other', name: 'other', value, share, color: 'var(--other)' })
  }
  return top
}

export function CategoryDonut({ categories, total, compact = false }: { categories: CategoryBreakdown[]; total: string; compact?: boolean }) {
  const { t } = useTranslation()
  const slices = topSlices(categories).map((s) => (s.key === 'other' ? { ...s, name: t('common.other') } : s))
  const size = compact ? 170 : 210
  return (
    <div className="row wrap" style={{ gap: 20, alignItems: 'center' }}>
      <div style={{ width: size, height: size, position: 'relative', flex: 'none', margin: '0 auto' }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={1.5}
              stroke="var(--surface-solid)" strokeWidth={2} cornerRadius={4} isAnimationActive={false}>
              {slices.map((s) => <Cell key={s.key} fill={s.color} />)}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox title={String(payload[0].name)} rows={[{
                    label: formatPercent((payload[0].payload as { share: number }).share),
                    value: formatMoney(Number(payload[0].value)),
                    color: (payload[0].payload as { color: string }).color,
                  }]} />
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
          <div>
            <div className="xs muted">{t('common.expenses')}</div>
            <div className="num" style={{ fontWeight: 750, fontSize: compact ? '1rem' : '1.15rem' }}>{formatCompact(toNumber(total))}</div>
          </div>
        </div>
      </div>
      <ul className="legend grow" style={{ listStyle: 'none', margin: 0, padding: 0, minWidth: 200 }}>
        {slices.map((s) => (
          <li key={s.key} className="legend-row">
            <span className="legend-swatch" style={{ background: s.color }} aria-hidden />
            <span className="truncate">{s.name}</span>
            <span className="num muted xs">{formatPercent(s.share)}</span>
            <span className="num" style={{ fontWeight: 600 }}>{formatMoney(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DailyBars({ daily, height = 180 }: { daily: { day: number; expense: string }[]; height?: number }) {
  const { t } = useTranslation()
  const data = daily.map((d) => ({ day: d.day, expense: toNumber(d.expense) }))
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={64} tickFormatter={formatCompact} />
          <Tooltip
            cursor={{ fill: 'var(--primary-soft)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox title={`${t('reports.day')} ${label}`} rows={[{ label: t('common.expense'), value: formatMoney(Number(payload[0].value)), color: 'var(--expense)' }]} />
              ) : null
            }
          />
          <Bar dataKey="expense" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TrendBars({ trend, height = 240 }: { trend: { month: string; income: string; expense: string }[]; height?: number }) {
  const { t } = useTranslation()
  const data = trend.map((m) => ({ month: m.month, income: toNumber(m.income), expense: toNumber(m.expense) }))
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="legend-inline" aria-hidden>
        <span><i className="legend-swatch" style={{ background: 'var(--income)' }} />{t('common.income')}</span>
        <span><i className="legend-swatch" style={{ background: 'var(--expense)' }} />{t('common.expense')}</span>
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="month" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(m: string) => monthLabel(m, true)} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={64} tickFormatter={formatCompact} />
            <Tooltip
              cursor={{ fill: 'var(--primary-soft)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={monthLabel(String(label))}
                    rows={[
                      { label: t('common.income'), value: formatMoney(Number(payload[0]?.value ?? 0)), color: 'var(--income)' },
                      { label: t('common.expense'), value: formatMoney(Number(payload[1]?.value ?? 0)), color: 'var(--expense)' },
                    ]}
                  />
                ) : null
              }
            />
            <Bar dataKey="income" name={t('common.income')} fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            <Bar dataKey="expense" name={t('common.expense')} fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
