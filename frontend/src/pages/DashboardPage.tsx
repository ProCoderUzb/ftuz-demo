import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, ChartColumn, ChartPie, HandCoins, History, Lightbulb, PiggyBank, Plus,
  Repeat, Target,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useCategories, useDashboard, useRecurring, useWallets } from '../api/hooks'
import type { Dashboard, Goal } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { CategoryDonut, DailyBars } from '../components/charts'
import { useScheduleLabel } from '../components/RecurringSection'
import { TipList } from '../components/TipList'
import { useOpenTransaction } from '../components/TransactionModal'
import { buildLookups, TransactionRow } from '../components/TransactionRow'
import {
  Amount, CategoryBadge, ChangeChip, EmptyState, ErrorState, ProgressBar, Ring, Skeleton, Tile, TileHead,
} from '../components/ui'
import i18n from '../i18n'
import {
  categoryName, currentMonth, dayLabel, formatMoney, formatPercent, monthLabel, relativeDay, toNumber,
} from '../lib/format'

function greetingKey() {
  const h = new Date().getHours()
  return h < 12 ? 'greeting_morning' : h < 18 ? 'greeting_day' : 'greeting_evening'
}

function SeeAll({ to }: { to: string }) {
  const { t } = useTranslation()
  return (
    <Link to={to} className="tile-link">
      {t('common.seeAll')} <ArrowRight size={14} aria-hidden />
    </Link>
  )
}

function BalanceTile({ data, wide }: { data: Dashboard; wide?: boolean }) {
  const { t } = useTranslation()
  const rate = toNumber(data.usd_rate)
  return (
    <Tile className={`tile-hero ${wide ? 'span-4' : 'span-2 row-2'}`} aria-label={t('dashboard.totalBalance')}>
      <div className="row-between">
        <span className="stat-label" style={{ color: 'inherit', opacity: 0.85 }}>{t('dashboard.totalBalance')}</span>
        <span className="xs muted num">{t('dashboard.rate', { rate: formatMoney(rate, 'UZS', { decimals: 2 }) })}</span>
      </div>
      <div>
        <div className="hero-value num">{formatMoney(data.total_balance)}</div>
        <div className="muted num" style={{ marginTop: 4 }}>
          {t('dashboard.inUsd', { amount: formatMoney(toNumber(data.total_balance) / (rate || 1), 'USD') })}
        </div>
      </div>
      <ul style={{ listStyle: 'none', margin: 'auto 0 0', padding: 0, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {data.wallets.map((w) => (
          <li key={w.id} style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)' }}>
            <div className="row xs" style={{ opacity: 0.85 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: w.color }} aria-hidden />
              <span className="truncate">{w.name}</span>
            </div>
            <div className="num" style={{ fontWeight: 700 }}>{formatMoney(w.balance, w.currency)}</div>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

function StatTile({ kind, value, change, wide }: { kind: 'income' | 'expense'; value: string; change: number | null; wide?: boolean }) {
  const { t } = useTranslation()
  const Icon = kind === 'income' ? ArrowUpRight : ArrowDownRight
  return (
    <Tile className={wide ? 'span-2' : ''}>
      <div className="row-between">
        <span className="icon-badge" style={{ background: `var(--${kind}-soft)`, color: `var(--${kind}-text)` }}>
          <Icon size={20} aria-hidden />
        </span>
        <ChangeChip value={change} inverse={kind === 'expense'} />
      </div>
      <div>
        <div className="stat-label">{t(kind === 'income' ? 'dashboard.monthIncome' : 'dashboard.monthExpense')}</div>
        <div className={`stat-value num ${kind}`}>{formatMoney(value)}</div>
      </div>
    </Tile>
  )
}

function SavingsTile({ data }: { data: Dashboard }) {
  const { t } = useTranslation()
  const rate = data.summary.savings_rate
  return (
    <Tile>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div className="stat-label">{t('dashboard.savingsRate')}</div>
        <Ring percent={rate ?? 0} color={rate != null && rate < 0 ? 'var(--expense)' : 'var(--income)'} size={56} />
      </div>
      <div className="stat-value num" title={formatPercent(rate)}>{formatMoney(data.summary.net, 'UZS', { sign: true })}</div>
    </Tile>
  )
}

function QuickAddTile({ wide }: { wide?: boolean }) {
  const { t } = useTranslation()
  const openTx = useOpenTransaction()
  return (
    <Tile className={wide ? 'span-4' : ''}>
      <div className="stat-label"><Plus size={16} aria-hidden /> {t('dashboard.quickAdd')}</div>
      <div className={wide ? 'row' : 'stack'} style={{ gap: 10, marginTop: 'auto' }}>
        <button className="btn btn-expense btn-block" onClick={() => openTx({ kind: 'expense' })} style={wide ? { minHeight: '3.5rem', fontSize: '1.1rem' } : undefined}>
          <ArrowDownRight size={18} aria-hidden /> {t('dashboard.addExpense')}
        </button>
        <button className="btn btn-income btn-block" onClick={() => openTx({ kind: 'income' })} style={wide ? { minHeight: '3.5rem', fontSize: '1.1rem' } : undefined}>
          <ArrowUpRight size={18} aria-hidden /> {t('dashboard.addIncome')}
        </button>
      </div>
    </Tile>
  )
}

function GoalItem({ goal }: { goal: Goal }) {
  const saved = toNumber(goal.saved_amount)
  const target = toNumber(goal.target_amount)
  return (
    <li className="row" style={{ gap: 12 }}>
      <CategoryBadge category={goal} size={36} />
      <div className="grow stack" style={{ gap: 6 }}>
        <div className="row-between small">
          <strong className="truncate">{goal.name}</strong>
          <span className="num muted xs">{formatMoney(saved, goal.currency)} / {formatMoney(target, goal.currency)}</span>
        </div>
        <ProgressBar percent={(saved / target) * 100} color={goal.color} />
      </div>
    </li>
  )
}

function RecentTile({ data, wide }: { data: Dashboard; wide?: boolean }) {
  const { t } = useTranslation()
  const { data: categories = [] } = useCategories()
  const { categoryMap, walletMap } = buildLookups(categories, data.wallets)
  return (
    <Tile className={wide ? 'span-4' : 'span-2 row-2'}>
      <TileHead title={t('dashboard.recent')} icon={History} action={<SeeAll to="/transactions" />} />
      {data.recent.length ? (
        <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {data.recent.map((tx) => <TransactionRow key={tx.id} tx={tx} categories={categoryMap} wallets={walletMap} />)}
        </ul>
      ) : (
        <EmptyState text={t('dashboard.noTransactions')} />
      )}
    </Tile>
  )
}

function DebtsTile({ data, wide }: { data: Dashboard; wide?: boolean }) {
  const { t } = useTranslation()
  const { debts } = data
  const next = debts.next_due
  const empty = !debts.owed_to_me_count && !debts.i_owe_count
  return (
    <Tile className={wide ? 'span-4' : 'span-2'}>
      <TileHead title={t('dashboard.debts')} icon={HandCoins} action={<SeeAll to="/debts" />} />
      {empty ? (
        <EmptyState icon={HandCoins} text={t('dashboard.noDebts')} />
      ) : (
        <>
          <div className="row" style={{ gap: 12 }}>
            <div className="grow" style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--income-soft)' }}>
              <div className="xs" style={{ color: 'var(--income-text)', fontWeight: 600 }}>
                <ArrowUpRight size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {t('dashboard.owedToMe')}
              </div>
              <div className="num income" style={{ fontWeight: 700, fontSize: '1.15rem' }}>{formatMoney(debts.owed_to_me)}</div>
              <div className="xs muted">{t('debts.openCount', { count: debts.owed_to_me_count })}</div>
            </div>
            <div className="grow" style={{ padding: '10px 12px', borderRadius: 14, background: 'var(--expense-soft)' }}>
              <div className="xs" style={{ color: 'var(--expense-text)', fontWeight: 600 }}>
                <ArrowDownRight size={13} aria-hidden style={{ verticalAlign: '-2px' }} /> {t('dashboard.iOwe')}
              </div>
              <div className="num expense" style={{ fontWeight: 700, fontSize: '1.15rem' }}>{formatMoney(debts.i_owe)}</div>
              <div className="xs muted">{t('debts.openCount', { count: debts.i_owe_count })}</div>
            </div>
          </div>
          {next?.due_date && (
            <div className="small row" style={{ gap: 6 }}>
              <CalendarClock size={15} aria-hidden />
              <span className="truncate">{t('dashboard.nextDue', { person: next.person, due: relativeDay(next.due_date) })}</span>
              <span className={`num ${next.direction === 'lent' ? 'income' : 'expense'}`} style={{ marginLeft: 'auto', fontWeight: 600 }}>
                {formatMoney(next.remaining, next.currency)}
              </span>
            </div>
          )}
        </>
      )}
    </Tile>
  )
}

function UpcomingTile() {
  const { t } = useTranslation()
  const { data: items = [] } = useRecurring()
  const { data: categories = [] } = useCategories()
  const { data: wallets = [] } = useWallets()
  const { categoryMap } = buildLookups(categories, wallets)
  const schedule = useScheduleLabel()
  const upcoming = items
    .filter((r) => r.is_active && r.next_date)
    .sort((a, b) => a.next_date!.localeCompare(b.next_date!))
    .slice(0, 3)
  return (
    <Tile className="span-2">
      <TileHead title={t('tx.recurring')} icon={Repeat} action={<SeeAll to="/transactions" />} />
      {upcoming.length ? (
        <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 10 }}>
          {upcoming.map((r) => {
            const category = categoryMap.get(r.category)
            return (
              <li key={r.id} className="row" style={{ gap: 12 }}>
                {category && <CategoryBadge category={category} size={32} />}
                <span className="grow" style={{ minWidth: 0 }}>
                  <strong className="small truncate" style={{ display: 'block' }}>{r.note || categoryName(category)}</strong>
                  <span className="xs muted truncate" style={{ display: 'block' }}>{dayLabel(r.next_date!)} · {schedule(r)}</span>
                </span>
                <Amount value={r.amount} currency={r.currency} kind={r.kind} className="small" />
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState icon={Repeat} text={t('tx.recurringEmpty')} />
      )}
    </Tile>
  )
}

function DashboardSkeleton() {
  return (
    <div className="bento">
      <Tile className="span-2 row-2"><Skeleton height={28} width="40%" /><Skeleton height={56} /><Skeleton height={80} /></Tile>
      {[0, 1, 2, 3].map((i) => <Tile key={i}><Skeleton height={36} width={36} /><Skeleton height={28} /></Tile>)}
      <Tile className="span-4"><Skeleton height={200} /></Tile>
    </div>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const month = currentMonth()
  const { data, isLoading, isError, refetch } = useDashboard(month)
  const simple = user?.simple_mode
  const firstName = user?.name.split(' ')[0] ?? ''

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{t(`dashboard.${greetingKey()}`, { name: firstName })}</h1>
          <p>{t('dashboard.subtitle', { month: i18n.language === 'ru' ? monthLabel(month).toLowerCase() : monthLabel(month) })}</p>
        </div>
      </header>

      {isLoading && <DashboardSkeleton />}
      {isError && <Tile><ErrorState onRetry={() => refetch()} /></Tile>}

      {data && simple && (
        <div className="bento">
          <BalanceTile data={data} wide />
          <StatTile kind="income" value={data.summary.income} change={data.summary.change.income} wide />
          <StatTile kind="expense" value={data.summary.expense} change={data.summary.change.expense} wide />
          <QuickAddTile wide />
          {(data.debts.owed_to_me_count > 0 || data.debts.i_owe_count > 0) && <DebtsTile data={data} wide />}
          <Tile className="span-4">
            <TileHead title={t('dashboard.tips')} icon={Lightbulb} />
            <TipList tips={data.tips} limit={2} />
          </Tile>
          <RecentTile data={data} wide />
        </div>
      )}

      {data && !simple && (
        <div className="bento">
          <BalanceTile data={data} />
          <StatTile kind="income" value={data.summary.income} change={data.summary.change.income} />
          <StatTile kind="expense" value={data.summary.expense} change={data.summary.change.expense} />
          <SavingsTile data={data} />
          <QuickAddTile />

          <Tile className="span-2 row-2">
            <TileHead title={t('dashboard.spendingByCategory')} icon={ChartPie} action={<SeeAll to="/reports" />} />
            {toNumber(data.summary.expense) > 0 ? (
              <CategoryDonut categories={data.summary.categories} total={data.summary.expense} />
            ) : (
              <EmptyState icon={ChartPie} text={t('common.noData')} />
            )}
          </Tile>

          <Tile className="span-2">
            <TileHead title={t('dashboard.dailySpending')} icon={ChartColumn} />
            <DailyBars daily={data.summary.daily} height={160} />
          </Tile>

          <Tile className="span-2">
            <TileHead title={t('dashboard.tips')} icon={Lightbulb} />
            <TipList tips={data.tips} limit={3} />
          </Tile>

          <RecentTile data={data} />

          <Tile className="span-2">
            <TileHead title={t('dashboard.budgets')} icon={PiggyBank} action={<SeeAll to="/budgets" />} />
            {data.summary.budgets.length ? (
              <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {data.summary.budgets.slice(0, 4).map((b) => (
                  <li key={b.id} className="stack" style={{ gap: 6 }}>
                    <div className="row-between small">
                      <span className="row"><CategoryBadge category={b.category} size={26} /> <strong>{categoryName(b.category)}</strong></span>
                      <span className="num muted xs">{formatMoney(b.spent)} / {formatMoney(b.limit)}</span>
                    </div>
                    <ProgressBar percent={b.percent} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={PiggyBank} text={t('dashboard.noBudgets')} />
            )}
          </Tile>

          <Tile className="span-2">
            <TileHead title={t('dashboard.goals')} icon={Target} action={<SeeAll to="/goals" />} />
            {data.goals.length ? (
              <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {data.goals.slice(0, 3).map((g) => <GoalItem key={g.id} goal={g} />)}
              </ul>
            ) : (
              <EmptyState icon={Target} text={t('dashboard.noGoals')} />
            )}
          </Tile>

          <DebtsTile data={data} />
          <UpcomingTile />
        </div>
      )}
    </div>
  )
}
