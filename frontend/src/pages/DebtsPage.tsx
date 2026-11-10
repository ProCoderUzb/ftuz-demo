import { CalendarClock, CircleCheck, HandCoins, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fieldErrors } from '../api/client'
import { useCrud, useDebtPayment, useDebts } from '../api/hooks'
import type { Currency, Debt, DebtDirection } from '../api/types'
import { AmountInput } from '../components/AmountInput'
import {
  ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHead, ProgressBar, Segmented, Skeleton, Tile, TileHead, useToast,
} from '../components/ui'
import { dayLabel, daysFromToday, formatMoney, relativeDay, today, toNumber } from '../lib/format'

const TONE: Record<DebtDirection, 'income' | 'expense'> = { lent: 'income', borrowed: 'expense' }

function totalsByCurrency(debts: Debt[]) {
  const totals = new Map<Currency, number>()
  for (const d of debts) totals.set(d.currency, (totals.get(d.currency) ?? 0) + toNumber(d.remaining))
  return [...totals.entries()].map(([c, v]) => formatMoney(v, c)).join(' + ') || formatMoney(0)
}

function PersonBadge({ debt, size = 44 }: { debt: Debt; size?: number }) {
  const tone = TONE[debt.direction]
  return (
    <span className="icon-badge" aria-hidden
      style={{ width: size, height: size, background: `var(--${tone}-soft)`, color: `var(--${tone}-text)`, fontWeight: 700, fontSize: size * 0.4 }}>
      {debt.person.trim().charAt(0).toUpperCase() || <HandCoins size={size * 0.48} />}
    </span>
  )
}

function DebtForm({ debt, onClose }: { debt?: Debt; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { save, remove } = useCrud<Debt>('debts')
  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? 'lent')
  const [person, setPerson] = useState(debt?.person ?? '')
  const [currency, setCurrency] = useState<Currency>(debt?.currency ?? 'UZS')
  const [amount, setAmount] = useState(debt ? String(Number(debt.amount)) : '')
  const [date, setDate] = useState(debt?.date ?? today())
  const [dueDate, setDueDate] = useState(debt?.due_date ?? '')
  const [note, setNote] = useState(debt?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!person.trim()) next.person = t('auth.errors.required')
    if (!(Number(amount) > 0)) next.amount = t('tx.amountRequired')
    if (dueDate && dueDate < date) next.due_date = t('debts.dueBeforeDate')
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await save.mutateAsync({
        id: debt?.id, direction, person: person.trim(), currency, amount, date, due_date: dueDate || null, note,
      })
      toast(t('common.saved'))
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
    }
  }

  return (
    <Modal title={debt ? t('debts.editTitle') : t('debts.new')} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <Segmented<DebtDirection> label={t('debts.title')} value={direction} onChange={setDirection}
          options={[
            { value: 'lent', label: t('debts.lent'), className: 'seg-income' },
            { value: 'borrowed', label: t('debts.borrowed'), className: 'seg-expense' },
          ]} />
        <Field label={t('debts.person')} error={errors.person}>
          <input className="input" value={person} maxLength={80} onChange={(e) => setPerson(e.target.value)}
            placeholder={t('debts.personPlaceholder')} aria-invalid={!!errors.person} data-autofocus />
        </Field>
        <Segmented<Currency> label={t('common.currency')} value={currency} onChange={setCurrency}
          options={[{ value: 'UZS', label: 'UZS (soʻm)' }, { value: 'USD', label: 'USD ($)' }]} />
        <Field label={t('common.amount')} error={errors.amount ?? errors.currency}>
          <AmountInput big value={amount} onChange={setAmount} invalid={!!errors.amount} />
        </Field>
        <div className="row wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
          <div className="grow" style={{ minWidth: 160 }}>
            <Field label={t('debts.date')} error={errors.date}>
              <input type="date" className="input" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} required />
            </Field>
          </div>
          <div className="grow" style={{ minWidth: 160 }}>
            <Field label={t('debts.dueDate')} error={errors.due_date}>
              <input type="date" className="input" value={dueDate} min={date} max="2100-12-31" onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
        </div>
        <Field label={t('common.note')} error={errors.note}>
          <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="row-between">
          {debt ? (
            <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirming(true)}>
              <Trash2 size={18} aria-hidden /> {t('common.delete')}
            </button>
          ) : <span />}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={save.isPending}>{t('common.save')}</button>
          </div>
        </div>
      </form>
      {confirming && debt && (
        <ConfirmDialog title={t('common.confirmDelete')} hint={t('common.confirmDeleteHint')} onClose={() => setConfirming(false)}
          busy={remove.isPending}
          onConfirm={async () => { await remove.mutateAsync(debt.id); toast(t('common.deleted')); onClose() }} />
      )}
    </Modal>
  )
}

function RepayForm({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { repay } = useDebtPayment()
  const [amount, setAmount] = useState('')
  const [inputKey, setInputKey] = useState(0) // remount AmountInput when "all that is left" fills it
  const [date, setDate] = useState(today())
  const [error, setError] = useState<string>()
  const remaining = toNumber(debt.remaining)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!(Number(amount) > 0)) return setError(t('tx.amountRequired'))
    if (Number(amount) > remaining) return setError(t('debts.tooMuch'))
    try {
      await repay.mutateAsync({ id: debt.id, amount, date })
      toast(t('common.saved'))
      onClose()
    } catch (err) {
      setError(fieldErrors(err).amount ? t('debts.tooMuch') : t('common.error'))
    }
  }

  const title = t(debt.direction === 'lent' ? 'debts.repayLent' : 'debts.repayBorrowed', { person: debt.person })
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={`${t('common.amount')} (${debt.currency})`} error={error}
          hint={t('debts.left', { amount: formatMoney(remaining, debt.currency) })}>
          <AmountInput key={inputKey} big value={amount} onChange={setAmount} invalid={!!error} autoFocus />
        </Field>
        <button type="button" className="chip" style={{ alignSelf: 'flex-start' }}
          onClick={() => { setAmount(String(remaining)); setInputKey((k) => k + 1); setError(undefined) }}>
          {t('debts.fullAmount')}
        </button>
        <Field label={t('common.date')}>
          <input type="date" className="input" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={repay.isPending}>{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  )
}

function DueLabel({ debt }: { debt: Debt }) {
  const { t } = useTranslation()
  if (!debt.due_date) return <span className="small muted">{t('debts.noDueDate')}</span>
  const days = daysFromToday(debt.due_date)
  const overdue = days < 0
  const soon = days >= 0 && days <= 7
  return (
    <span className={`small row ${overdue ? 'expense' : ''}`} style={{ gap: 6, fontWeight: overdue || soon ? 600 : 400, color: soon ? 'var(--warning)' : undefined }}>
      <CalendarClock size={15} aria-hidden />
      {t(overdue ? 'debts.overdue' : 'debts.due', { due: relativeDay(debt.due_date) })}
      <span className="muted" style={{ fontWeight: 400 }}>· {dayLabel(debt.due_date)}</span>
    </span>
  )
}

function DebtTile({ debt, onEdit, onRepay }: { debt: Debt; onEdit: () => void; onRepay: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { save } = useCrud<Debt>('debts')
  const { undo } = useDebtPayment()
  const total = toNumber(debt.amount)
  const paid = toNumber(debt.paid)
  const tone = TONE[debt.direction]

  return (
    <Tile className="span-2" aria-label={debt.person}>
      <div className="row-between">
        <span className="row" style={{ gap: 12, minWidth: 0 }}>
          <PersonBadge debt={debt} />
          <span style={{ minWidth: 0 }}>
            <strong className="truncate" style={{ display: 'block', fontSize: '1.05rem' }}>{debt.person}</strong>
            <span className={`xs ${tone}`} style={{ fontWeight: 600 }}>{t(debt.direction === 'lent' ? 'debts.owedToMe' : 'debts.iOwe')}</span>
          </span>
        </span>
        <button className="btn btn-ghost btn-sm icon-btn" aria-label={t('common.edit')} onClick={onEdit}><Pencil size={16} /></button>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className={`stat-value num ${tone}`}>{formatMoney(debt.remaining, debt.currency)}</span>
        {paid > 0 && (
          <>
            <span className="xs muted num">{t('debts.paidOf', { paid: formatMoney(paid, debt.currency), total: formatMoney(total, debt.currency) })}</span>
            <ProgressBar percent={(paid / total) * 100} color={`var(--${tone})`} />
          </>
        )}
        <DueLabel debt={debt} />
        {debt.note && <span className="small muted">{debt.note}</span>}
      </div>

      {debt.payments.length > 0 && (
        <details>
          <summary className="small" style={{ cursor: 'pointer' }}>{t('debts.payments')} ({debt.payments.length})</summary>
          <ul className="list" style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
            {debt.payments.map((p) => (
              <li key={p.id} className="row-between small" style={{ padding: '4px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span className="muted">{dayLabel(p.date)}</span>
                <span className="row" style={{ gap: 4 }}>
                  <span className="num">{formatMoney(p.amount, debt.currency)}</span>
                  <button className="btn btn-ghost btn-sm icon-btn" aria-label={t('debts.removePayment')} disabled={undo.isPending}
                    onClick={async () => { await undo.mutateAsync({ id: debt.id, paymentId: p.id }); toast(t('common.deleted')) }}>
                    <X size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="row wrap">
        <button className="btn btn-primary grow" onClick={onRepay}><Plus size={18} aria-hidden /> {t('debts.repay')}</button>
        <button className="btn" disabled={save.isPending}
          onClick={async () => { await save.mutateAsync({ id: debt.id, is_settled: true }); toast(t('common.saved')) }}>
          <CircleCheck size={18} aria-hidden /> {t('debts.markSettled')}
        </button>
      </div>
    </Tile>
  )
}

export function DebtsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: debts, isLoading, isError, refetch } = useDebts()
  const { save } = useCrud<Debt>('debts')
  const [editing, setEditing] = useState<Debt | 'new' | null>(null)
  const [repaying, setRepaying] = useState<Debt | null>(null)

  const open = debts?.filter((d) => !d.is_settled) ?? []
  const settled = debts?.filter((d) => d.is_settled) ?? []
  const lent = open.filter((d) => d.direction === 'lent')
  const borrowed = open.filter((d) => d.direction === 'borrowed')
  const newButton = (
    <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={18} aria-hidden /> {t('debts.new')}</button>
  )

  return (
    <div className="page">
      <PageHead title={t('debts.title')} subtitle={t('debts.subtitle')} actions={newButton} />
      {isLoading && <Tile><Skeleton height={120} /></Tile>}
      {isError && <Tile><ErrorState onRetry={() => refetch()} /></Tile>}

      {debts && !debts.length && (
        <Tile><EmptyState icon={HandCoins} text={t('debts.empty')} action={newButton} /></Tile>
      )}

      {debts && debts.length > 0 && (
        <div className="bento">
          <Tile className="span-2">
            <div className="stat-label">{t('debts.owedToMe')}</div>
            <div className="stat-value num income">{totalsByCurrency(lent)}</div>
            <span className="xs muted">{t('debts.openCount', { count: lent.length })}</span>
          </Tile>
          <Tile className="span-2">
            <div className="stat-label">{t('debts.iOwe')}</div>
            <div className="stat-value num expense">{totalsByCurrency(borrowed)}</div>
            <span className="xs muted">{t('debts.openCount', { count: borrowed.length })}</span>
          </Tile>

          {open.map((debt) => (
            <DebtTile key={debt.id} debt={debt} onEdit={() => setEditing(debt)} onRepay={() => setRepaying(debt)} />
          ))}

          {settled.length > 0 && (
            <Tile className="span-4">
              <TileHead title={t('debts.settledSection')} icon={CircleCheck} />
              <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {settled.map((debt) => (
                  <li key={debt.id} className="list-item">
                    <PersonBadge debt={debt} size={36} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <strong className="truncate" style={{ display: 'block' }}>{debt.person}</strong>
                      <span className="xs muted">
                        {t(debt.direction === 'lent' ? 'debts.lent' : 'debts.borrowed')} · {dayLabel(debt.date)}
                      </span>
                    </span>
                    <span className="num muted" style={{ textDecoration: 'line-through' }}>{formatMoney(debt.amount, debt.currency)}</span>
                    <button className="btn btn-ghost btn-sm" disabled={save.isPending}
                      onClick={async () => { await save.mutateAsync({ id: debt.id, is_settled: false }); toast(t('common.saved')) }}>
                      <RotateCcw size={16} aria-hidden /> {t('debts.reopen')}
                    </button>
                    <button className="btn btn-ghost btn-sm icon-btn" aria-label={t('common.edit')} onClick={() => setEditing(debt)}>
                      <Pencil size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </Tile>
          )}
        </div>
      )}

      {editing && <DebtForm debt={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {repaying && <RepayForm debt={repaying} onClose={() => setRepaying(null)} />}
    </div>
  )
}
