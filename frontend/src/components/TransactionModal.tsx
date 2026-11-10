import { ArrowDownRight, ArrowUpRight, Repeat, Trash2 } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { fieldErrors } from '../api/client'
import { useCategories, useCrud, useWallets } from '../api/hooks'
import type { Category, Kind, Recurring, Transaction, Wallet } from '../api/types'
import { categoryName, today, yesterday } from '../lib/format'
import { iconFor } from '../lib/icons'
import { AmountInput } from './AmountInput'
import { ConfirmDialog, Field, Modal, Segmented, Toggle, useToast } from './ui'

type OpenArgs = { kind?: Kind; transaction?: Transaction }

const TxContext = createContext<(args?: OpenArgs) => void>(() => {})

export function useOpenTransaction() {
  return useContext(TxContext)
}

export function TransactionModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OpenArgs | null>(null)
  const open = useCallback((args: OpenArgs = {}) => setState(args), [])
  return (
    <TxContext.Provider value={open}>
      {children}
      {state && <TransactionForm {...state} onClose={() => setState(null)} />}
    </TxContext.Provider>
  )
}

export function KindSwitch({ value, onChange }: { value: Kind; onChange: (kind: Kind) => void }) {
  const { t } = useTranslation()
  return (
    <Segmented<Kind>
      label={t('common.category')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'expense', className: 'seg-expense', label: <><ArrowDownRight size={16} aria-hidden />{t('common.expense')}</> },
        { value: 'income', className: 'seg-income', label: <><ArrowUpRight size={16} aria-hidden />{t('common.income')}</> },
      ]}
    />
  )
}

export function CategoryPicker({
  options, value, onChange, error,
}: { options: Category[]; value: number | null; onChange: (id: number) => void; error?: string }) {
  const { t } = useTranslation()
  return (
    <div className="field">
      <span>{t('common.category')}</span>
      <div className="cat-grid" role="group" aria-label={t('common.category')}>
        {options.map((c) => {
          const Icon = iconFor(c.icon)
          return (
            <button key={c.id} type="button" className="cat-option" aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
              <span className="icon-badge" style={{ background: `${c.color}22`, color: c.color }}>
                <Icon size={20} aria-hidden />
              </span>
              {categoryName(c)}
            </button>
          )
        })}
      </div>
      {error && <em className="field-error">{error}</em>}
    </div>
  )
}

export function WalletPicker({ wallets, value, onChange }: { wallets: Wallet[]; value?: number; onChange: (id: number) => void }) {
  const { t } = useTranslation()
  if (wallets.length < 2) return null
  return (
    <div className="field">
      <span>{t('common.wallet')}</span>
      <div className="row wrap" role="group" aria-label={t('common.wallet')}>
        {wallets.map((w) => (
          <button key={w.id} type="button" className="chip" aria-pressed={value === w.id} onClick={() => onChange(w.id)}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: w.color }} aria-hidden />
            {w.name} · {w.currency}
          </button>
        ))}
      </div>
    </div>
  )
}

function TransactionForm({ kind: initialKind, transaction, onClose }: OpenArgs & { onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: wallets = [] } = useWallets()
  const { data: categories = [] } = useCategories()
  const { save, remove } = useCrud<Transaction>('transactions')
  const { save: saveRecurring } = useCrud<Recurring>('recurring')

  const activeWallets = wallets.filter((w) => !w.is_archived || w.id === transaction?.wallet)
  const [kind, setKind] = useState<Kind>(transaction?.kind ?? initialKind ?? 'expense')
  const [amount, setAmount] = useState(transaction ? String(Number(transaction.amount)) : '')
  const [categoryId, setCategoryId] = useState<number | null>(transaction?.category ?? null)
  const [walletId, setWalletId] = useState<number | null>(transaction?.wallet ?? null)
  const [date, setDate] = useState(transaction?.date ?? today())
  const [note, setNote] = useState(transaction?.note ?? '')
  const [repeat, setRepeat] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  const wallet = activeWallets.find((w) => w.id === walletId) ?? activeWallets[0]
  const options = useMemo(
    () => categories.filter((c) => c.kind === kind && (!c.is_archived || c.id === transaction?.category)),
    [categories, kind, transaction],
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!(Number(amount) > 0)) next.amount = t('tx.amountRequired')
    if (!categoryId || !options.some((c) => c.id === categoryId)) next.category = t('tx.pickCategory')
    setErrors(next)
    if (Object.keys(next).length || !wallet) return
    try {
      if (repeat && !transaction) {
        // The schedule creates this month's transaction itself (when the date is today or earlier).
        await saveRecurring.mutateAsync({
          kind, amount, category: categoryId!, wallet: wallet.id, note,
          frequency: 'monthly', day_of_month: Number(date.slice(8, 10)), start_date: date,
        })
      } else {
        await save.mutateAsync({
          id: transaction?.id, kind, amount, category: categoryId!, wallet: wallet.id, date, note,
        })
      }
      toast(t('common.saved'))
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
    }
  }

  async function doDelete() {
    if (!transaction) return
    await remove.mutateAsync(transaction.id)
    toast(t('common.deleted'))
    onClose()
  }

  const title = transaction ? t('tx.editTitle') : kind === 'income' ? t('tx.newIncome') : t('tx.newExpense')

  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <KindSwitch
          value={kind}
          onChange={(k) => {
            setKind(k)
            setCategoryId(null)
          }}
        />

        <div className="field">
          <label htmlFor="tx-amount" className="sr-only">{t('common.amount')}</label>
          <div style={{ position: 'relative' }}>
            <AmountInput id="tx-amount" big value={amount} onChange={setAmount} invalid={!!errors.amount} autoFocus />
            <span className="muted" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontWeight: 600 }}>
              {wallet ? t(`currency.${wallet.currency}`) : ''}
            </span>
          </div>
          {errors.amount && <em className="field-error">{errors.amount}</em>}
        </div>

        <CategoryPicker options={options} value={categoryId} onChange={setCategoryId} error={errors.category} />

        <WalletPicker wallets={activeWallets} value={wallet?.id} onChange={setWalletId} />

        <div className="field">
          <span>{t('common.date')}</span>
          <div className="row wrap">
            <button type="button" className="chip" aria-pressed={date === today()} onClick={() => setDate(today())}>{t('common.today')}</button>
            <button type="button" className="chip" aria-pressed={date === yesterday()} onClick={() => setDate(yesterday())}>{t('common.yesterday')}</button>
            <input type="date" className="input" style={{ width: 'auto', flex: 1, minWidth: 150 }} value={date} max="2100-12-31"
              onChange={(e) => setDate(e.target.value)} aria-label={t('common.date')} required />
          </div>
        </div>

        <Field label={t('common.note')} error={errors.note}>
          <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t('common.notePlaceholder')} />
        </Field>

        {!transaction && (
          <div className="row-between" style={{ gap: 12 }}>
            <div>
              <strong className="row" style={{ gap: 6 }}><Repeat size={16} aria-hidden /> {t('tx.repeatMonthly')}</strong>
              {repeat && <p className="xs muted" style={{ margin: '2px 0 0' }}>{t('tx.repeatHint', { day: Number(date.slice(8, 10)) })}</p>}
            </div>
            <Toggle checked={repeat} onChange={setRepeat} label={t('tx.repeatMonthly')} />
          </div>
        )}
        {transaction?.recurring && (
          <p className="xs muted row" style={{ gap: 6, margin: 0 }}><Repeat size={14} aria-hidden /> {t('tx.repeating')}</p>
        )}

        {(errors._ || errors.non_field_errors || errors.wallet) && (
          <p className="field-error">{errors.non_field_errors ?? errors.wallet ?? t('common.error')}</p>
        )}

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          {transaction ? (
            <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirming(true)}>
              <Trash2 size={18} aria-hidden /> {t('common.delete')}
            </button>
          ) : <span />}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className={`btn ${kind === 'income' ? 'btn-income' : 'btn-expense'}`} disabled={save.isPending || saveRecurring.isPending}>
              {t('common.save')}
            </button>
          </div>
        </div>
      </form>
      {confirming && (
        <ConfirmDialog title={t('common.confirmDelete')} hint={t('common.confirmDeleteHint')} onConfirm={doDelete}
          onClose={() => setConfirming(false)} busy={remove.isPending} />
      )}
    </Modal>
  )
}
