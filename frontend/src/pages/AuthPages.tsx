import { AxiosError } from 'axios'
import { ChartPie, Lightbulb, PiggyBank, Zap, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { fieldErrors } from '../api/client'
import type { Lang } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Brand } from '../components/Layout'
import { Field, PasswordInput } from '../components/ui'
import i18n, { LANGS, setLanguage } from '../i18n'

const FEATURES: { key: string; icon: LucideIcon }[] = [
  { key: 'track', icon: Zap },
  { key: 'charts', icon: ChartPie },
  { key: 'budgets', icon: PiggyBank },
  { key: 'tips', icon: Lightbulb },
]

function LanguageSwitch() {
  const { i18n: inst } = useTranslation()
  return (
    <div className="segmented" role="group" aria-label="Language" style={{ width: 'fit-content' }}>
      {LANGS.map((l) => (
        <button key={l.code} type="button" aria-pressed={inst.language === l.code} onClick={() => setLanguage(l.code)}>
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <Brand />
        <div className="tile tile-hero" style={{ padding: 32, gap: 24 }}>
          <h1 style={{ fontSize: '2rem', maxWidth: 420 }}>{t('app.tagline')}</h1>
          <div className="feature-list">
            {FEATURES.map(({ key, icon: Icon }) => (
              <div key={key} className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                <span className="icon-badge" style={{ background: 'rgba(255,255,255,0.14)' }}><Icon size={18} aria-hidden /></span>
                <span style={{ fontWeight: 550 }}>{t(`auth.features.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>
        <LanguageSwitch />
      </aside>
      <div className="auth-form-wrap">
        <div className="auth-card stack" style={{ gap: 18 }}>
          <div className="topbar-mobile" style={{ justifyContent: 'space-between', width: '100%' }}>
            <Brand />
          </div>
          <div className="tile" style={{ padding: 28, gap: 18 }}>{children}</div>
          <div className="topbar-mobile" style={{ justifyContent: 'center' }}><LanguageSwitch /></div>
        </div>
      </div>
    </div>
  )
}

function authError(err: unknown, t: (k: string) => string) {
  if ((err as AxiosError)?.response?.status === 429) return t('auth.errors.throttled')
  return null
}

export function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent, creds?: { u: string; p: string }) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(creds?.u ?? username.trim(), creds?.p ?? password)
    } catch (err) {
      setError(authError(err, t) ?? t('auth.invalid'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <div>
        <h1>{t('auth.loginTitle')}</h1>
        <p className="muted">{t('auth.loginSubtitle')}</p>
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={t('auth.username')}>
          <input className="input" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </Field>
        <Field label={t('auth.password')}>
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !username || !password}>{t('auth.login')}</button>
      </form>
      {import.meta.env.DEV && (
        <button className="btn btn-ghost btn-block" disabled={busy} onClick={(e) => submit(e, { u: 'demo', p: 'ftuz-demo-2026' })}>
          {t('auth.demo')}
        </button>
      )}
      <p className="small muted" style={{ textAlign: 'center' }}>
        {t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link>
      </p>
    </AuthLayout>
  )
}

export function RegisterPage() {
  const { t } = useTranslation()
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })

  const translate = (code?: string) => {
    if (!code) return undefined
    const key = `auth.errors.${code}`
    return i18n.exists(key) ? t(key) : code
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'required'
    if (!form.username.trim()) next.username = 'required'
    if (!form.password) next.password = 'required'
    if (form.password && form.password !== form.confirm) next.confirm = 'mismatch'
    setErrors(next)
    if (Object.keys(next).length) return
    setBusy(true)
    try {
      await register({ name: form.name.trim(), username: form.username.trim(), password: form.password, language: i18n.language as Lang })
    } catch (err) {
      const throttled = authError(err, t)
      setErrors(throttled ? { _: throttled } : fieldErrors(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <div>
        <h1>{t('auth.registerTitle')}</h1>
        <p className="muted">{t('auth.registerSubtitle')}</p>
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label={t('auth.name')} error={translate(errors.name)}>
          <input className="input" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} />
        </Field>
        <Field label={t('auth.username')} error={translate(errors.username)} hint={t('auth.usernameHint')}>
          <input className="input" autoComplete="username" autoCapitalize="none" value={form.username} onChange={set('username')} aria-invalid={!!errors.username} />
        </Field>
        <Field label={t('auth.password')} error={translate(errors.password)} hint={t('auth.passwordHint')}>
          <PasswordInput autoComplete="new-password" value={form.password} onChange={set('password')} aria-invalid={!!errors.password} />
        </Field>
        <Field label={t('auth.confirmPassword')} error={translate(errors.confirm)}>
          <PasswordInput autoComplete="new-password" value={form.confirm} onChange={set('confirm')} aria-invalid={!!errors.confirm} />
        </Field>
        {errors._ && <p className="field-error" role="alert">{errors._ === 'network' ? t('common.error') : errors._}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{t('auth.register')}</button>
      </form>
      <p className="small muted" style={{ textAlign: 'center' }}>
        {t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link>
      </p>
    </AuthLayout>
  )
}
