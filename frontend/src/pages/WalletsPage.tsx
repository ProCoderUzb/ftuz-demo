import { ArrowLeftRight, ArrowRight, Banknote, CreditCard, Landmark, Pencil, PiggyBank, Plus, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fieldErrors } from '../api/client'
import { useCrud, useTransfers, useWallets } from '../api/hooks'
import type { Currency, Transfer, Wallet, WalletType } from '../api/types'
import { AmountInput } from '../components/AmountInput'
import {
  ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHead, Segmented, Skeleton, Tile, TileHead, useToast,
} from '../components/ui'
import { COLORS } from '../lib/icons'
import { dayLabel, formatMoney, today } from '../lib/format'

const TYPE_ICON: Record<WalletType, LucideIcon> = { cash: Banknote, card: CreditCard, bank: Landmark, savings: PiggyBank }

function WalletForm({ wallet, onClose }: { wallet?: Wallet; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { save, remove } = useCrud<Wallet>('wallets')
  const [name, setName] = useState(wallet?.name ?? '')
  const [type, setType] = useState<WalletType>(wallet?.type ?? 'card')
  const [currency, setCurrency] = useState<Currency>(wallet?.currency ?? 'UZS')
  const [initial, setInitial] = useState(wallet ? String(Number(wallet.initial_balance)) : '')
  const [color, setColor] = useState(wallet?.color ?? '#2563EB')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setErrors({ name: t('auth.errors.required') })
    try {
      await save.mutateAsync({ id: wallet?.id, name: name.trim(), type, currency, initial_balance: initial || '0', color, is_archived: false })
      toast(t('common.saved'))
      onClose()
    } catch (err) {
      const errs = fieldErrors(err)
      if (errs.currency) errs.currency = t('wallets.currencyLocked')
      setErrors(errs)
    }
  }

  return (
    <Modal title={wallet ? t('wallets.editTitle') : t('wallets.new')} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={t('common.name')} error={errors.name}>
          <input className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Uzcard, Humo…" />
        </Field>
        <div className="field">
          <span>{t('wallets.type')}</span>
          <div className="row wrap" role="group">
            {(Object.keys(TYPE_ICON) as WalletType[]).map((k) => {
              const Icon = TYPE_ICON[k]
              return (
                <button key={k} type="button" className="chip" aria-pressed={type === k} onClick={() => setType(k)}>
                  <Icon size={16} aria-hidden /> {t(`wallets.types.${k}`)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="field">
          <span>{t('common.currency')}</span>
          <Segmented<Currency> label={t('common.currency')} value={currency} onChange={setCurrency}
            options={[{ value: 'UZS', label: 'UZS (soʻm)' }, { value: 'USD', label: 'USD ($)' }]} />
          {errors.currency && <em className="field-error">{errors.currency}</em>}
        </div>
        <Field label={t('wallets.initialBalance')}>
          <AmountInput value={initial} onChange={setInitial} />
        </Field>
        <div className="field">
          <span>{t('common.color')}</span>
          <div className="row wrap" style={{ gap: 8 }}>
            {COLORS.slice(0, 10).map((c) => (
              <button key={c} type="button" aria-label={c} aria-pressed={c === color} onClick={() => setColor(c)}
                style={{ width: 30, height: 30, borderRadius: 9, background: c, cursor: 'pointer', border: '2px solid var(--surface-solid)', boxShadow: c === color ? `0 0 0 2px ${c}` : 'var(--soft-raised-sm)' }} />
            ))}
          </div>
        </div>
        <div className="row-between">
          {wallet ? <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirming(true)}>{t('common.delete')}</button> : <span />}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={save.isPending}>{t('common.save')}</button>
          </div>
        </div>
      </form>
      {confirming && wallet && (
        <ConfirmDialog title={t('common.confirmDelete')} hint={t('categories.archivedHint')} onClose={() => setConfirming(false)}
          onConfirm={async () => { await remove.mutateAsync(wallet.id); toast(t('common.deleted')); onClose() }} />
      )}
    </Modal>
  )
}

function TransferForm({ wallets, onClose }: { wallets: Wallet[]; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { save } = useCrud<Transfer>('transfers')
  const [from, setFrom] = useState(wallets[0]?.id)
  const [to, setTo] = useState(wallets[1]?.id)
  const [amount, setAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const src = wallets.find((w) => w.id === from)
  const dst = wallets.find((w) => w.id === to)
  const crossCurrency = src && dst && src.currency !== dst.currency

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!(Number(amount) > 0)) return setErrors({ amount: t('tx.amountRequired') })
    if (crossCurrency && !(Number(toAmount) > 0)) return setErrors({ to_amount: t('tx.amountRequired') })
    try {
      await save.mutateAsync({ from_wallet: from, to_wallet: to, amount, to_amount: crossCurrency ? toAmount : amount, date, note })
      toast(t('common.saved'))
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
    }
  }

  return (
    <Modal title={t('wallets.transferTitle')} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="row wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
          <div className="grow" style={{ minWidth: 160 }}>
            <Field label={t('wallets.from')}>
              <select className="select" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
                {wallets.map((w) => <option key={w.id} value={w.id}>{w.name} · {formatMoney(w.balance, w.currency)}</option>)}
              </select>
            </Field>
          </div>
          <ArrowRight size={20} aria-hidden style={{ marginBottom: 12 }} className="muted" />
          <div className="grow" style={{ minWidth: 160 }}>
            <Field label={t('wallets.to')} error={errors.to_wallet}>
              <select className="select" value={to} onChange={(e) => setTo(Number(e.target.value))}>
                {wallets.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.currency}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <Field label={`${t('common.amount')} (${src?.currency ?? ''})`} error={errors.amount}>
          <AmountInput value={amount} onChange={setAmount} invalid={!!errors.amount} />
        </Field>
        {crossCurrency && (
          <Field label={`${t('wallets.received')} (${dst?.currency})`} error={errors.to_amount} hint={t('wallets.receivedHint')}>
            <AmountInput value={toAmount} onChange={setToAmount} invalid={!!errors.to_amount} />
          </Field>
        )}
        <Field label={t('common.date')}>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('common.note')}>
          <input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={save.isPending}>{t('wallets.transfer')}</button>
        </div>
      </form>
    </Modal>
  )
}

export function WalletsPage() {
  const { t } = useTranslation()
  const { data: wallets, isLoading, isError, refetch } = useWallets()
  const { data: transfers } = useTransfers()
  const [editing, setEditing] = useState<Wallet | 'new' | null>(null)
  const [transferring, setTransferring] = useState(false)
  const active = wallets?.filter((w) => !w.is_archived) ?? []
  const names = new Map(wallets?.map((w) => [w.id, w]) ?? [])

  return (
    <div className="page">
      <PageHead title={t('wallets.title')} subtitle={t('wallets.subtitle')}
        actions={
          <>
            <button className="btn" onClick={() => setTransferring(true)} disabled={active.length < 2}><ArrowLeftRight size={18} aria-hidden /> {t('wallets.transfer')}</button>
            <button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={18} aria-hidden /> {t('wallets.new')}</button>
          </>
        } />
      {isLoading && <Tile><Skeleton height={100} /></Tile>}
      {isError && <Tile><ErrorState onRetry={() => refetch()} /></Tile>}
      <div className="bento">
        {wallets?.map((w) => {
          const Icon = TYPE_ICON[w.type]
          return (
            <Tile key={w.id} className={w.is_archived ? 'muted' : ''}>
              <div className="row-between">
                <span className="icon-badge" style={{ background: `${w.color}22`, color: w.color }}><Icon size={20} aria-hidden /></span>
                <button className="btn btn-ghost btn-sm icon-btn" aria-label={t('common.edit')} onClick={() => setEditing(w)}><Pencil size={16} /></button>
              </div>
              <div>
                <div className="stat-label">{w.name}{w.is_archived ? ` · ${t('common.archived')}` : ''}</div>
                <div className="stat-value num">{formatMoney(w.balance, w.currency)}</div>
                <div className="xs muted">{t(`wallets.types.${w.type}`)} · {w.currency}</div>
              </div>
            </Tile>
          )
        })}
        <Tile className="span-4">
          <TileHead title={t('wallets.recentTransfers')} icon={ArrowLeftRight} />
          {transfers?.results.length ? (
            <ul className="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {transfers.results.map((tr) => {
                const src = names.get(tr.from_wallet)
                const dst = names.get(tr.to_wallet)
                return (
                  <li key={tr.id} className="list-item">
                    <span className="icon-badge" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}><ArrowLeftRight size={18} aria-hidden /></span>
                    <span className="grow">
                      <strong className="truncate" style={{ display: 'block' }}>{src?.name} → {dst?.name}</strong>
                      <span className="xs muted">{dayLabel(tr.date)}{tr.note ? ` · ${tr.note}` : ''}</span>
                    </span>
                    <span className="num" style={{ fontWeight: 600, textAlign: 'right' }}>
                      {formatMoney(tr.amount, src?.currency)}
                      {src && dst && src.currency !== dst.currency && <span className="xs muted" style={{ display: 'block' }}>→ {formatMoney(tr.to_amount, dst.currency)}</span>}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState icon={ArrowLeftRight} text={t('wallets.noTransfers')} />
          )}
        </Tile>
      </div>
      {editing && <WalletForm wallet={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {transferring && <TransferForm wallets={active} onClose={() => setTransferring(false)} />}
    </div>
  )
}
