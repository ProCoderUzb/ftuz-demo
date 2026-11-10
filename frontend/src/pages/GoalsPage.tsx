import { Minus, Pencil, Plus, Target } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fieldErrors } from '../api/client'
import { useCrud, useGoalContribution, useGoals } from '../api/hooks'
import type { Currency, Goal } from '../api/types'
import { AmountInput } from '../components/AmountInput'
import { IconColorPicker } from '../components/IconColorPicker'
import {
  CategoryBadge, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHead, Ring, Segmented, Skeleton, Tile, useToast,
} from '../components/ui'
import { formatMoney, today, toNumber } from '../lib/format'

const GOAL_ICONS = ['target', 'laptop', 'smartphone', 'car', 'house', 'plane', 'graduation-cap', 'gift', 'heart', 'gem', 'baby', 'piggy-bank', 'sparkles', 'bike']

function GoalForm({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { save, remove } = useCrud<Goal>('goals')
  const [name, setName] = useState(goal?.name ?? '')
  const [icon, setIcon] = useState(goal?.icon ?? 'target')
  const [color, setColor] = useState(goal?.color ?? '#CA8A04')
  const [currency, setCurrency] = useState<Currency>(goal?.currency ?? 'UZS')
  const [target, setTarget] = useState(goal ? String(Number(goal.target_amount)) : '')
  const [saved, setSaved] = useState(goal ? String(Number(goal.saved_amount)) : '')
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirming, setConfirming] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = t('auth.errors.required')
    if (!(Number(target) > 0)) next.target_amount = t('tx.amountRequired')
    setErrors(next)
    if (Object.keys(next).length) return
    try {
      await save.mutateAsync({
        id: goal?.id, name: name.trim(), icon, color, currency, target_amount: target,
        saved_amount: saved || '0', deadline: deadline || null,
        is_completed: Number(saved || 0) >= Number(target),
      })
      toast(t('common.saved'))
      onClose()
    } catch (err) {
      setErrors(fieldErrors(err))
    }
  }

  return (
    <Modal title={goal ? t('goals.editTitle') : t('goals.new')} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={t('common.name')} error={errors.name}>
          <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
        </Field>
        <Segmented<Currency> label={t('common.currency')} value={currency} onChange={setCurrency}
          options={[{ value: 'UZS', label: 'UZS (soʻm)' }, { value: 'USD', label: 'USD ($)' }]} />
        <div className="row wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
          <div className="grow" style={{ minWidth: 180 }}>
            <Field label={t('goals.target')} error={errors.target_amount}>
              <AmountInput value={target} onChange={setTarget} invalid={!!errors.target_amount} />
            </Field>
          </div>
          <div className="grow" style={{ minWidth: 180 }}>
            <Field label={t('goals.saved')}>
              <AmountInput value={saved} onChange={setSaved} />
            </Field>
          </div>
        </div>
        <Field label={t('goals.deadline')} error={errors.deadline}>
          <input type="date" className="input" value={deadline} min={today()} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <IconColorPicker icon={icon} color={color} onIcon={setIcon} onColor={setColor} icons={GOAL_ICONS} />
        <div className="row-between">
          {goal ? <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirming(true)}>{t('common.delete')}</button> : <span />}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={save.isPending}>{t('common.save')}</button>
          </div>
        </div>
      </form>
      {confirming && goal && (
        <ConfirmDialog title={t('common.confirmDelete')} hint={t('common.confirmDeleteHint')} onClose={() => setConfirming(false)}
          onConfirm={async () => { await remove.mutateAsync(goal.id); toast(t('common.deleted')); onClose() }} />
      )}
    </Modal>
  )
}

function ContributeForm({ goal, direction, onClose }: { goal: Goal; direction: 1 | -1; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const contribute = useGoalContribution()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string>()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!(Number(amount) > 0)) return setError(t('tx.amountRequired'))
    try {
      await contribute.mutateAsync({ id: goal.id, amount: String(direction * Number(amount)) })
      toast(t('common.saved'))
      onClose()
    } catch (err) {
      setError(fieldErrors(err).amount ?? t('common.error'))
    }
  }

  return (
    <Modal title={t(direction > 0 ? 'goals.contributeTitle' : 'goals.withdrawTitle', { name: goal.name })} onClose={onClose} size="sm">
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={`${t('common.amount')} (${goal.currency})`} error={error}>
          <AmountInput big value={amount} onChange={setAmount} invalid={!!error} autoFocus />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={contribute.isPending}>{t('common.save')}</button>
        </div>
      </form>
    </Modal>
  )
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(`${iso}T00:00:00`).getTime() - new Date(`${today()}T00:00:00`).getTime()) / 86_400_000)
}

export function GoalsPage() {
  const { t } = useTranslation()
  const { data: goals, isLoading, isError, refetch } = useGoals()
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)
  const [moving, setMoving] = useState<{ goal: Goal; direction: 1 | -1 } | null>(null)

  return (
    <div className="page">
      <PageHead title={t('goals.title')} subtitle={t('goals.subtitle')}
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={18} aria-hidden /> {t('goals.new')}</button>} />
      {isLoading && <Tile><Skeleton height={120} /></Tile>}
      {isError && <Tile><ErrorState onRetry={() => refetch()} /></Tile>}
      {goals && !goals.length && (
        <Tile><EmptyState icon={Target} text={t('goals.empty')} action={<button className="btn btn-primary" onClick={() => setEditing('new')}>{t('goals.new')}</button>} /></Tile>
      )}
      <div className="bento">
        {goals?.map((goal) => {
          const saved = toNumber(goal.saved_amount)
          const target = toNumber(goal.target_amount)
          const percent = (saved / target) * 100
          const days = goal.deadline ? daysUntil(goal.deadline) : null
          const monthsLeft = days != null ? Math.max(1, Math.ceil(days / 30)) : null
          const perMonth = monthsLeft && target > saved ? (target - saved) / monthsLeft : null
          return (
            <Tile key={goal.id} className="span-2">
              <div className="row-between">
                <span className="row" style={{ gap: 12 }}>
                  <CategoryBadge category={goal} size={44} />
                  <span>
                    <strong style={{ display: 'block', fontSize: '1.05rem' }}>{goal.name}</strong>
                    <span className="small muted">
                      {goal.is_completed ? t('goals.completed') : days == null ? '' : days < 0 ? t('goals.overdue') : t('goals.daysLeft', { count: days })}
                    </span>
                  </span>
                </span>
                <button className="btn btn-ghost btn-sm icon-btn" aria-label={t('common.edit')} onClick={() => setEditing(goal)}><Pencil size={16} /></button>
              </div>
              <div className="row" style={{ gap: 18 }}>
                <Ring percent={percent} color={goal.color} size={84} />
                <div className="stack grow" style={{ gap: 2 }}>
                  <span className="stat-value num">{formatMoney(saved, goal.currency)}</span>
                  <span className="muted num small">/ {formatMoney(target, goal.currency)}</span>
                  {perMonth && !goal.is_completed && (
                    <span className="small" style={{ marginTop: 6 }}>{t('goals.perMonth', { amount: formatMoney(perMonth, goal.currency) })}</span>
                  )}
                </div>
              </div>
              <div className="row">
                <button className="btn btn-primary grow" onClick={() => setMoving({ goal, direction: 1 })}><Plus size={18} aria-hidden /> {t('goals.contribute')}</button>
                <button className="btn" onClick={() => setMoving({ goal, direction: -1 })} disabled={saved <= 0}><Minus size={18} aria-hidden /> {t('goals.withdraw')}</button>
              </div>
            </Tile>
          )
        })}
      </div>
      {editing && <GoalForm goal={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {moving && <ContributeForm goal={moving.goal} direction={moving.direction} onClose={() => setMoving(null)} />}
    </div>
  )
}
