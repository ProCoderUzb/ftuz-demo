import { ArrowLeftRight, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCategories, useTransactions, useWallets } from '../api/hooks'
import type { Currency, Kind, Transaction } from '../api/types'
import { RecurringSection } from '../components/RecurringSection'
import { useOpenTransaction } from '../components/TransactionModal'
import { buildLookups, TransactionRow } from '../components/TransactionRow'
import { EmptyState, ErrorState, MonthPicker, PageHead, Segmented, Skeleton, Tile } from '../components/ui'
import { categoryName, currentMonth, dayLabel, formatMoney } from '../lib/format'

type KindFilter = '' | Kind

function totalsByCurrency(txs: Transaction[], kind: Kind) {
  const totals = new Map<Currency, number>()
  for (const tx of txs) {
    if (tx.kind === kind) totals.set(tx.currency, (totals.get(tx.currency) ?? 0) + Number(tx.amount))
  }
  return [...totals.entries()].map(([c, v]) => formatMoney(v, c)).join(' + ') || formatMoney(0)
}

export function TransactionsPage() {
  const { t } = useTranslation()
  const openTx = useOpenTransaction()
  const [month, setMonth] = useState(currentMonth())
  const [kind, setKind] = useState<KindFilter>('')
  const [wallet, setWallet] = useState<number | ''>('')
  const [category, setCategory] = useState<number | ''>('')
  const [search, setSearch] = useState('')

  const { data: wallets = [] } = useWallets()
  const { data: categories = [] } = useCategories()
  const { data, isLoading, isError, refetch } = useTransactions({ month, kind, wallet, category, search: search.trim() })
  const { categoryMap, walletMap } = buildLookups(categories, wallets)
  const txs = useMemo(() => data?.results ?? [], [data])

  const groups = useMemo(() => {
    const byDay = new Map<string, Transaction[]>()
    for (const tx of txs) byDay.set(tx.date, [...(byDay.get(tx.date) ?? []), tx])
    return [...byDay.entries()]
  }, [txs])

  const categoryOptions = categories.filter((c) => !kind || c.kind === kind)

  return (
    <div className="page">
      <PageHead
        title={t('tx.title')}
        subtitle={t('tx.subtitle')}
        actions={<button className="btn btn-primary" onClick={() => openTx()}><Plus size={18} aria-hidden /> {t('tx.new')}</button>}
      />

      <Tile>
        <div className="row wrap" style={{ gap: 10 }}>
          <MonthPicker value={month} onChange={setMonth} />
          <div style={{ minWidth: 260 }}>
            <Segmented<KindFilter>
              label={t('tx.allTypes')}
              value={kind}
              onChange={(k) => { setKind(k); setCategory('') }}
              options={[
                { value: '', label: t('common.all') },
                { value: 'expense', label: t('common.expense'), className: 'seg-expense' },
                { value: 'income', label: t('common.income'), className: 'seg-income' },
              ]}
            />
          </div>
          <select className="select" style={{ width: 'auto', flex: '1 1 160px' }} value={wallet} aria-label={t('common.wallet')}
            onChange={(e) => setWallet(e.target.value ? Number(e.target.value) : '')}>
            <option value="">{t('tx.allWallets')}</option>
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select className="select" style={{ width: 'auto', flex: '1 1 180px' }} value={category} aria-label={t('common.category')}
            onChange={(e) => setCategory(e.target.value ? Number(e.target.value) : '')}>
            <option value="">{t('tx.allCategories')}</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
          </select>
          <div style={{ position: 'relative', flex: '2 1 200px' }}>
            <Search size={18} aria-hidden style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input className="input" style={{ paddingLeft: 42 }} value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t('common.search')} aria-label={t('common.search')} type="search" />
          </div>
        </div>
      </Tile>

      <div className="bento">
        <Tile className="span-2">
          <div className="stat-label">{t('tx.totalIn')}</div>
          <div className="stat-value num income">{totalsByCurrency(txs, 'income')}</div>
        </Tile>
        <Tile className="span-2">
          <div className="stat-label">{t('tx.totalOut')}</div>
          <div className="stat-value num expense">{totalsByCurrency(txs, 'expense')}</div>
        </Tile>
      </div>

      <RecurringSection />

      <Tile>
        <div className="row-between">
          <h2>{t('tx.count', { count: data?.count ?? 0 })}</h2>
        </div>
        {isLoading && <div className="stack">{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} />)}</div>}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {data && !txs.length && <EmptyState icon={ArrowLeftRight} text={t('tx.empty')} />}
        {groups.map(([day, items]) => (
          <section key={day} aria-label={dayLabel(day)}>
            <div className="day-head"><span>{dayLabel(day)}</span></div>
            <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((tx) => <TransactionRow key={tx.id} tx={tx} categories={categoryMap} wallets={walletMap} />)}
            </ul>
          </section>
        ))}
      </Tile>
    </div>
  )
}
