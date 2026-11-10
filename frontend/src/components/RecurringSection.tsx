import { Pause, Plus, Repeat, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fieldErrors } from '../api/client'
import { useCategories, useCrud, useRecurring, useWallets } from '../api/hooks'
import type { Frequency, Kind, Recurring } from '../api/types'
import i18n from '../i18n'
import { categoryName, dayLabel, today } from '../lib/format'
import { AmountInput } from './AmountInput'
import { CategoryPicker, KindSwitch, WalletPicker } from './TransactionModal'
import { buildLookups } from './TransactionRow'
import {
  Amount, CategoryBadge, ConfirmDialog, EmptyState, Field, Modal, Segmented, Skeleton, Tile, TileHead, Toggle, useToast,
} from './ui'

function weekdayNames() {
  return i18n.t('weekdays', { returnObjects: true }) as unknown as string[]
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function useScheduleLabel() {
  const { t } = useTranslation()
  const days = weekdayNames()
  return (rec: Pick<Recurring, 'frequency' | 'day_of_month' | 'weekday'>) =>
    rec.frequency === 'weekly'
      ? t('tx.everyWeekOn', { weekday: days[rec.weekday ?? 0] })
      : t('tx.everyMonthOn', { day: rec.day_of_month })
}

function RecurringForm({ recurring, onClose }: { recurring?: Recurring; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: wallets = [] } = useWallets()
  const { data: categories = [] } = useCategories()
  const { save, remove } = useCrud<Recurring>('recurring')
  const startToday = today()

  const activeWallets = wallets.filter((w) => !w.is_archived || w.id === recurring?.wallet)
  const [kind, setKind] = useState<Kind>(recurring?.kind ?? 'expense')
  const [amount, setAmount] = useState(recurring ? String(Number(recurring.amount)) : '')
  const [categoryId, setCategoryId] = useState<number | null>(recurring?.category ?? null)
  const [walletId, setWalletId] = useState<number | null>(recurring?.wallet ?? null)
  const [frequency, setFrequency] = useState<Frequency>(recurring?.frequency ?? 'monthly')
  const [dayOfMonth, setDayOfMonth] = useState(recurring?.day_of_month ?? Number(startToday.slice(8, 10)))
  const [weekday, setWeekday] = useState(() => recurring?.weekday ?? (new Date().getDay() + 6) % 7)
  const [startDate, setStartDate] = useState(recurring?.start_date ?? startToday)
  const [note, setNote] = useState(recurring?.note ?? '')
  const [active, setActive] = useState(recurring?.is_active ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  const wallet = activeWallets.find((w) => w.id === walletId) ?? activeWallets[0]
  const options = useMemo(
    () => categories.filter((c) => c.kind === kind && (!c.is_archived || c.id === recurring?.category)),
    [categories, kind, recurring],
  )
  const days = weekdayNames()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!(Number(amount) > 0)) next.amount = t('tx.amountRequired')
    if (!categoryId || !options.some((c) => c.id === categoryId)) next.category = t('tx.pickCategory')
    setErrors(next)
    if (Object.keys(next).length || !wallet) return
    try {
      await save.mutateAsync({
        id: recurring?.id, kind, amount, category: categoryId!, wallet: wallet.id, note, frequency,
        day_of_month: frequency === 'monthly' ? dayOfMonth : null,
        weekday: frequency === 'weekly' ? weekday : null,
        start_date: startDate, is_active: active,
      })
      toast(t('common.saved'))
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
    }
  }

  return (
    <Modal title={recurring ? t('tx.editRecurring') : t('tx.newRecurring')} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <KindSwitch value={kind} onChange={(k) => { setKind(k); setCategoryId(null) }} />

        <div className="field">
          <label htmlFor="rec-amount" className="sr-only">{t('common.amount')}</label>
          <div style={{ position: 'relative' }}>
            <AmountInput id="rec-amount" big value={amount} onChange={setAmount} invalid={!!errors.amount} autoFocus />
            <span className="muted" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontWeight: 600 }}>
              {wallet ? t(`currency.${wallet.currency}`) : ''}
            </span>
          </div>
          {errors.amount && <em className="field-error">{errors.amount}</em>}
        </div>

        <CategoryPicker options={options} value={categoryId} onChange={setCategoryId} error={errors.category} />
        <WalletPicker wallets={activeWallets} value={wallet?.id} onChange={setWalletId} />

        <div className="field">
          <span>{t('tx.frequency')}</span>
          <Segmented<Frequency> label={t('tx.frequency')} value={frequency} onChange={setFrequency}
            options={[{ value: 'monthly', label: t('tx.monthly') }, { value: 'weekly', label: t('tx.weekly') }]} />
        </div>

        {frequency === 'monthly' ? (
          <Field label={t('tx.dayOfMonth')} error={errors.day_of_month} hint={dayOfMonth > 28 ? t('tx.shortMonthHint') : undefined}>
            <select className="select" value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        ) : (
          <div className="field">
            <span>{t('tx.weekday')}</span>
            <div className="row wrap" role="group" aria-label={t('tx.weekday')}>
              {days.map((name, i) => (
                <button key={name} type="button" className="chip" aria-pressed={weekday === i} onClick={() => setWeekday(i)}>
                  {capitalize(name)}
                </button>
              ))}
            </div>
            {errors.weekday && <em className="field-error">{errors.weekday}</em>}
          </div>
        )}

        <Field label={t('tx.startDate')} error={errors.start_date}>
          <input type="date" className="input" value={startDate} max="2100-12-31" onChange={(e) => setStartDate(e.target.value)} required />
        </Field>

        <Field label={t('common.note')} error={errors.note}>
          <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t('common.notePlaceholder')} />
        </Field>

        {recurring && (
          <div className="row-between" style={{ gap: 12 }}>
            <div>
              <strong>{active ? t('tx.active') : t('tx.paused')}</strong>
              <p className="xs muted" style={{ margin: '2px 0 0' }}>{t('tx.pausedHint')}</p>
            </div>
            <Toggle checked={active} onChange={setActive} label={t('tx.active')} />
          </div>
        )}

        {(errors.non_field_errors || errors.wallet) && <p className="field-error">{errors.non_field_errors ?? errors.wallet}</p>}

        <div className="row-between" style={{ marginTop: 4 }}>
          {recurring ? (
            <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirming(true)}>
              <Trash2 size={18} aria-hidden /> {t('common.delete')}
            </button>
          ) : <span />}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className={`btn ${kind === 'income' ? 'btn-income' : 'btn-expense'}`} disabled={save.isPending}>
              {t('common.save')}
            </button>
          </div>
        </div>
      </form>
      {confirming && recurring && (
        <ConfirmDialog title={t('common.confirmDelete')} hint={t('common.confirmDeleteHint')} onClose={() => setConfirming(false)}
          busy={remove.isPending}
          onConfirm={async () => { await remove.mutateAsync(recurring.id); toast(t('common.deleted')); onClose() }} />
      )}
    </Modal>
  )
}

export function RecurringSection() {
  const { t } = useTranslation()
  const { data: items, isLoading } = useRecurring()
  const { data: wallets = [] } = useWallets()
  const { data: categories = [] } = useCategories()
  const { categoryMap, walletMap } = buildLookups(categories, wallets)
  const schedule = useScheduleLabel()
  const [editing, setEditing] = useState<Recurring | 'new' | null>(null)

  return (
    <Tile>
      <TileHead title={t('tx.recurring')} icon={Repeat}
        action={<button className="btn btn-sm" onClick={() => setEditing('new')}><Plus size={16} aria-hidden /> {t('common.add')}</button>} />
      <p className="small muted" style={{ margin: 0 }}>{t('tx.recurringHint')}</p>
      {isLoading && <Skeleton height={48} />}
      {items && !items.length && <EmptyState icon={Repeat} text={t('tx.recurringEmpty')} />}
      {items && items.length > 0 && (
        <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((rec) => {
            const category = categoryMap.get(rec.category)
            return (
              <li key={rec.id}>
                <button type="button" className="list-item clickable" onClick={() => setEditing(rec)}
                  style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', borderBottom: '1px solid var(--hairline)', opacity: rec.is_active ? 1 : 0.6 }}>
                  {category && <CategoryBadge category={category} />}
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{rec.note || categoryName(category)}</span>
                    <span className="xs muted truncate" style={{ display: 'block' }}>
                      {schedule(rec)} · {walletMap.get(rec.wallet)?.name}
                      {' · '}
                      {rec.is_active && rec.next_date
                        ? t('tx.next', { date: dayLabel(rec.next_date) })
                        : <><Pause size={11} aria-hidden style={{ verticalAlign: '-1px' }} /> {t('tx.paused')}</>}
                    </span>
                  </span>
                  <Amount value={rec.amount} currency={rec.currency} kind={rec.kind} arrow />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {editing && <RecurringForm recurring={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Tile>
  )
}
