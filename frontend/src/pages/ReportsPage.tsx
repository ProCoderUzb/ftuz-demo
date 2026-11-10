import {
  ArrowDownRight, ArrowUpRight, ChartColumn, ChartPie, Download, Lightbulb, PiggyBank, Printer, Receipt, Scale, TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api } from '../api/client'
import { useCategories, useMonthlyReport, useWallets } from '../api/hooks'
import type { Paginated, Transaction } from '../api/types'
import { CategoryDonut, DailyBars, TrendBars } from '../components/charts'
import { TipList } from '../components/TipList'
import {
  CategoryBadge, ChangeChip, EmptyState, ErrorState, MonthPicker, PageHead, Skeleton, Tile, TileHead,
} from '../components/ui'
import {
  categoryName, currentMonth, dayLabel, formatMoney, formatPercent, monthLabel, shiftMonth, toNumber,
} from '../lib/format'

function csvCell(value: string | number) {
  const s = String(value)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function ReportsPage() {
  const { t } = useTranslation()
  const [month, setMonth] = useState(currentMonth())
  const [exporting, setExporting] = useState(false)
  const { data, isLoading, isError, refetch } = useMonthlyReport(month)
  const { data: categories = [] } = useCategories()
  const { data: wallets = [] } = useWallets()

  async function exportCsv() {
    setExporting(true)
    try {
      const { data: page } = await api.get<Paginated<Transaction>>('/transactions/', { params: { month, limit: 5000 } })
      const cats = new Map(categories.map((c) => [c.id, c]))
      const walletNames = new Map(wallets.map((w) => [w.id, w.name]))
      const header = [t('common.date'), t('common.income') + '/' + t('common.expense'), t('common.category'), t('common.wallet'), t('common.amount'), t('common.currency'), t('common.note')]
      const rows = page.results.map((tx) => [
        tx.date, t(`common.${tx.kind}`), categoryName(cats.get(tx.category)), walletNames.get(tx.wallet) ?? '',
        (tx.kind === 'expense' ? '-' : '') + tx.amount, tx.currency, tx.note,
      ])
      const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: `ftuz-${month}.csv` })
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const expenseCats = data?.categories.filter((c) => c.kind === 'expense') ?? []
  const incomeCats = data?.categories.filter((c) => c.kind === 'income') ?? []

  return (
    <div className="page">
      <PageHead
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        actions={
          <>
            <MonthPicker value={month} onChange={setMonth} />
            <button className="btn no-print" onClick={exportCsv} disabled={exporting || !data}>
              <Download size={18} aria-hidden /> {t('reports.exportCsv')}
            </button>
            <button className="btn no-print" onClick={() => window.print()} disabled={!data}>
              <Printer size={18} aria-hidden /> {t('reports.print')}
            </button>
          </>
        }
      />

      {isLoading && <div className="bento">{[0, 1, 2, 3].map((i) => <Tile key={i}><Skeleton height={60} /></Tile>)}</div>}
      {isError && <Tile><ErrorState onRetry={() => refetch()} /></Tile>}

      {data && (
        <div className="bento">
          <Tile>
            <div className="stat-label"><ArrowUpRight size={16} aria-hidden className="income" /> {t('reports.income')}</div>
            <div className="stat-value num income">{formatMoney(data.income)}</div>
            <ChangeChip value={data.change.income} />
          </Tile>
          <Tile>
            <div className="stat-label"><ArrowDownRight size={16} aria-hidden className="expense" /> {t('reports.expense')}</div>
            <div className="stat-value num expense">{formatMoney(data.expense)}</div>
            <ChangeChip value={data.change.expense} inverse />
          </Tile>
          <Tile>
            <div className="stat-label"><Scale size={16} aria-hidden /> {t('reports.net')}</div>
            <div className={`stat-value num ${toNumber(data.net) < 0 ? 'expense' : ''}`}>{formatMoney(data.net, 'UZS', { sign: true })}</div>
            <span className="xs muted num">{monthLabel(month)}</span>
          </Tile>
          <Tile>
            <div className="stat-label"><PiggyBank size={16} aria-hidden /> {t('reports.savingsRate')}</div>
            <div className="stat-value num">{data.savings_rate == null ? t('reports.noIncome') : formatPercent(data.savings_rate)}</div>
            <span className="xs muted">50/30/20 → 20%</span>
          </Tile>

          <Tile className="span-2 row-2">
            <TileHead title={t('dashboard.spendingByCategory')} icon={ChartPie} />
            {expenseCats.length && toNumber(data.expense) > 0 ? (
              <CategoryDonut categories={data.categories} total={data.expense} />
            ) : (
              <EmptyState icon={ChartPie} text={t('common.noData')} />
            )}
          </Tile>

          <Tile className="span-2">
            <TileHead title={t('reports.trend')} icon={TrendingUp} />
            <TrendBars trend={data.trend} height={200} />
          </Tile>

          <Tile className="span-2">
            <TileHead title={t('reports.daily')} icon={ChartColumn} />
            <DailyBars daily={data.daily} height={170} />
          </Tile>

          <Tile className="span-2">
            <TileHead title={t('reports.tips')} icon={Lightbulb} />
            <TipList tips={data.tips} />
          </Tile>

          <Tile className="span-2">
            <TileHead title={t('reports.topExpenses')} icon={Receipt} />
            {data.top_expenses.length ? (
              <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {data.top_expenses.map((tx) => (
                  <li key={tx.id} className="list-item">
                    <CategoryBadge category={tx.category} size={36} />
                    <span className="grow">
                      <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{tx.note || categoryName(tx.category)}</span>
                      <span className="xs muted">{dayLabel(tx.date)}</span>
                    </span>
                    <span className="num expense" style={{ fontWeight: 650 }}>{formatMoney(-toNumber(tx.amount), tx.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Receipt} text={t('common.noData')} />
            )}
          </Tile>

          <Tile className="span-4">
            <TileHead title={t('reports.categories')} icon={ChartPie} />
            {data.categories.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('common.category')}</th>
                      <th className="r">{t('common.amount')}</th>
                      <th className="r">{t('reports.share')}</th>
                      <th className="r">{monthLabel(shiftMonth(month, -1))}</th>
                      <th className="r">{t('reports.change')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...expenseCats, ...incomeCats].map((c) => (
                      <tr key={c.category.id}>
                        <td>
                          <span className="row">
                            <CategoryBadge category={c.category} size={28} />
                            <span>{categoryName(c.category)}</span>
                            <span className="xs muted">({c.kind === 'income' ? t('common.income') : t('common.expense')})</span>
                          </span>
                        </td>
                        <td className={`r num ${c.kind}`} style={{ fontWeight: 600 }}>{formatMoney(c.amount)}</td>
                        <td className="r num">{formatPercent(c.share)}</td>
                        <td className="r num muted">{formatMoney(c.previous)}</td>
                        <td className="r"><ChangeChip value={c.change} inverse={c.kind === 'expense'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState text={t('common.noData')} />
            )}
          </Tile>
        </div>
      )}
    </div>
  )
}
