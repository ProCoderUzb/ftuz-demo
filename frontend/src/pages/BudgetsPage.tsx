import { Pencil, PiggyBank, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fieldErrors } from '../api/client'
import { useBudgets, useCategories, useCrud, useDashboard } from '../api/hooks'
import type { Budget } from '../api/types'
import { AmountInput } from '../components/AmountInput'
import {
  CategoryBadge, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHead, ProgressBar, Skeleton, Tile, useToast,
} from '../components/ui'
import { categoryName, currentMonth, formatMoney, formatPercent, toNumber } from '../lib/format'

function BudgetForm({ budget, onClose }: { budget?: Budget; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { data: categories = [] } = useCategories()
  const { data: budgets = [] } = useBudgets()
  const { save, remove } = useCrud<Budget>('budgets')
  const taken = new Set(budgets.filter((b) => b.id !== budget?.id).map((b) => b.category))
  const options = categories.filter((c) => c.kind === 'expense' && !c.is_archived && !taken.has(c.id))
  const [category, setCategory] = useState<number | ''>(budget?.category ?? options[0]?.id ?? '')
  const [amount, setAmount] = useState(budget ? String(Number(budget.amount)) : '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!(Number(amount) > 0)) return setErrors({ amount: t('tx.amountRequired') })
    try {
      await save.mutateAsync({ id: budget?.id, category: Number(category), amount })
      toast(t('common.saved'))
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
    }
  }

  return (
    <Modal title={budget ? t('budgets.editTitle') : t('budgets.new')} onClose={onClose} size="sm">
      {!options.length && !budget ? (
        <p className="muted">{t('budgets.allCovered')}</p>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <Field label={t('common.category')} error={errors.category}>
            <select className="select" value={category} onChange={(e) => setCategory(Number(e.target.value))}>
              {options.map((c) => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}
            </select>
          </Field>
          <Field label={t('budgets.limit')} error={errors.amount}>
            <AmountInput value={amount} onChange={setAmount} invalid={!!errors.amount} />
          </Field>
          <div className="row-between">
            {budget ? <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirming(true)}>{t('common.delete')}</button> : <span />}
            <div className="row">
              <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
              <button className="btn btn-primary" disabled={save.isPending}>{t('common.save')}</button>
            </div>
          </div>
        </form>
      )}
      {confirming && budget && (
        <ConfirmDialog title={t('common.confirmDelete')} onClose={() => setConfirming(false)}
          onConfirm={async () => { await remove.mutateAsync(budget.id); toast(t('common.deleted')); onClose() }} />
      )}
    </Modal>
  )
}

export function BudgetsPage() {
  const { t } = useTranslation()
  const { data: budgets = [] } = useBudgets()
  const { data, isLoading, isError, refetch } = useDashboard(currentMonth())
  const [editing, setEditing] = useState<Budget | 'new' | null>(null)
  const progress = data?.summary.budgets ?? []

  return (
    <div className="page">
      <PageHead
        title={t('budgets.title')}
        subtitle={t('budgets.subtitle')}
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={18} aria-hidden /> {t('budgets.new')}</button>}
      />
      {isLoading && <Tile><Skeleton height={120} /></Tile>}
      {isError && <Tile><ErrorState onRetry={() => refetch()} /></Tile>}
      {data && !progress.length && (
        <Tile><EmptyState icon={PiggyBank} text={t('budgets.empty')} action={<button className="btn btn-primary" onClick={() => setEditing('new')}>{t('budgets.new')}</button>} /></Tile>
      )}
      <div className="bento">
        {progress.map((b) => {
          const over = b.percent >= 100
          return (
            <Tile key={b.id} className="span-2">
              <div className="row-between">
                <span className="row" style={{ gap: 12 }}>
                  <CategoryBadge category={b.category} />
                  <span>
                    <strong style={{ display: 'block' }}>{categoryName(b.category)}</strong>
                    <span className="small muted num">{t('budgets.spent', { spent: formatMoney(b.spent), limit: formatMoney(b.limit) })}</span>
                  </span>
                </span>
                <button className="btn btn-ghost btn-sm icon-btn" aria-label={t('common.edit')}
                  onClick={() => setEditing(budgets.find((x) => x.id === b.id) ?? null)}>
                  <Pencil size={16} />
                </button>
              </div>
              <ProgressBar percent={b.percent} />
              <div className="row-between small">
                <span className={`num ${over ? 'expense' : ''}`} style={{ fontWeight: 600 }}>
                  {over ? t('budgets.overAmount', { amount: formatMoney(-toNumber(b.left)) }) : t('budgets.leftAmount', { amount: formatMoney(b.left) })}
                </span>
                <span className="num muted">{formatPercent(b.percent)}</span>
              </div>
            </Tile>
          )
        })}
      </div>
      {editing && <BudgetForm budget={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
