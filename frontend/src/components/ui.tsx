import {
  ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Eye, EyeOff, Inbox, X, type LucideIcon,
} from 'lucide-react'
import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import type { CategoryRef, Currency, Kind } from '../api/types'
import { formatMoney, formatPercent, monthLabel, shiftMonth } from '../lib/format'
import { iconFor } from '../lib/icons'

export function Tile({
  children, className = '', as: Tag = 'section', ...rest
}: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article'; 'aria-label'?: string }) {
  return (
    <Tag className={`tile ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

export function TileHead({ title, icon: Icon, action }: { title: ReactNode; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="tile-head">
      <h2>
        {Icon && <Icon size={18} aria-hidden />}
        {title}
      </h2>
      {action}
    </div>
  )
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </header>
  )
}

export function CategoryBadge({ category, size = 40 }: { category: Pick<CategoryRef, 'icon' | 'color'>; size?: number }) {
  const Icon = iconFor(category.icon)
  return (
    <span
      className="icon-badge"
      style={{ width: size, height: size, background: `${category.color}22`, color: category.color }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.48)} strokeWidth={2.1} />
    </span>
  )
}

/** A signed amount: colour + sign + arrow, so it never relies on colour alone. */
export function Amount({
  value, currency = 'UZS', kind, className = '', arrow = false,
}: { value: string | number; currency?: Currency; kind?: Kind; className?: string; arrow?: boolean }) {
  const signed = kind === 'expense' ? -Math.abs(Number(value)) : Number(value)
  const tone = kind ? kind : ''
  const Arrow = kind === 'expense' ? ArrowDownRight : ArrowUpRight
  return (
    <span className={`num ${tone} ${className}`} style={{ fontWeight: 650, whiteSpace: 'nowrap' }}>
      {arrow && kind && <Arrow size={14} aria-hidden style={{ verticalAlign: '-2px', marginRight: 2 }} />}
      {formatMoney(signed, currency, { sign: !!kind })}
    </span>
  )
}

/** Percent change chip. For expenses, going up is bad. */
export function ChangeChip({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  const { t } = useTranslation()
  if (value == null) return null
  const good = inverse ? value < 0 : value > 0
  const Arrow = value >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className="chip-change" title={t('common.vsLastMonth')}>
      <Arrow size={13} aria-hidden className={value === 0 ? '' : good ? 'income' : 'expense'} />
      {formatPercent(value, true)}
      <span className="sr-only"> {t('common.vsLastMonth')}</span>
    </span>
  )
}

export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const tone = color ?? (percent >= 100 ? 'var(--expense)' : percent >= 80 ? 'var(--warning)' : 'var(--income)')
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${clamped}%`, background: tone }} />
    </div>
  )
}

export function Ring({ percent, color, size = 64 }: { percent: number; color: string; size?: number }) {
  const stroke = 7
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, percent))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="num">{Math.round(percent)}%</span>
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, text, action }: { icon?: LucideIcon; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon size={32} aria-hidden />
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Skeleton({ height = 20, width = '100%' }: { height?: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} aria-hidden />
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="empty" role="alert">
      <p>{t('common.error')}</p>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function MonthPicker({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="month-picker">
      <button className="btn btn-ghost btn-sm icon-btn" onClick={() => onChange(shiftMonth(value, -1))} aria-label="−1">
        <ChevronLeft size={18} />
      </button>
      <strong aria-live="polite">{monthLabel(value)}</strong>
      <button className="btn btn-ghost btn-sm icon-btn" onClick={() => onChange(shiftMonth(value, 1))} aria-label="+1">
        <ChevronRight size={18} />
      </button>
      <span className="sr-only">{t('reports.month')}</span>
    </div>
  )
}

export function Segmented<T extends string>({
  value, options, onChange, label,
}: { value: T; options: { value: T; label: ReactNode; className?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value} type="button" className={o.className} aria-pressed={value === o.value} onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <em className="field-error">{error}</em> : hint ? <em className="xs muted" style={{ fontStyle: 'normal' }}>{hint}</em> : null}
    </label>
  )
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input {...props} className="input" type={shown ? 'text' : 'password'} style={{ paddingRight: 48 }} />
      <button
        type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => setShown((s) => !s)}
        aria-label={shown ? t('auth.hidePassword') : t('auth.showPassword')}
        style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)} />
}

export function Modal({
  title, onClose, children, size,
}: { title: string; onClose: () => void; children: ReactNode; size?: 'sm' }) {
  const { t } = useTranslation()
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  // Runs once per opening: callers usually pass an inline onClose, which must not re-trigger focus.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus], input, select, textarea')
    first?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [])

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal ${size === 'sm' ? 'modal-sm' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="row-between">
          <h2 id={titleId} style={{ fontSize: '1.2rem' }}>{title}</h2>
          <button className="btn btn-ghost btn-sm icon-btn" onClick={onClose} aria-label={t('common.close')} data-close>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  title, hint, confirmLabel, onConfirm, onClose, busy,
}: { title: string; hint?: string; confirmLabel?: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  const { t } = useTranslation()
  return (
    <Modal title={title} onClose={onClose} size="sm">
      {hint && <p className="muted">{hint}</p>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-expense" onClick={onConfirm} disabled={busy}>{confirmLabel ?? t('common.delete')}</button>
      </div>
    </Modal>
  )
}

// ---------- toast ----------

const ToastContext = createContext<(message: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((text: string) => {
    setMessage(text)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMessage(null), 2400)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite">{message && <div className="toast">{message}</div>}</div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
