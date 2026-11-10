import { Languages, Monitor, Moon, Palette, ShieldCheck, Sun, TriangleAlert, Type, User as UserIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api, fieldErrors } from '../api/client'
import type { TextSize, ThemePref } from '../api/types'
import { useAuth } from '../auth/AuthContext'
import { Field, Modal, PageHead, PasswordInput, Segmented, Tile, TileHead, Toggle, useToast } from '../components/ui'
import i18n, { LANGS } from '../i18n'

export function SettingsPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { user, updateUser, logout } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  if (!user) return null

  const errText = (code?: string) => (code ? (i18n.exists(`auth.errors.${code}`) ? t(`auth.errors.${code}`) : code) : undefined)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    try {
      await api.post('/auth/change-password/', pw)
      setPw({ current_password: '', new_password: '' })
      setPwErrors({})
      toast(t('settings.passwordChanged'))
    } catch (err) {
      setPwErrors(fieldErrors(err))
    }
  }

  async function deleteAccount() {
    await api.delete('/auth/me/')
    logout()
  }

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <PageHead title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="bento">
        <Tile className="span-2">
          <TileHead title={t('settings.profile')} icon={UserIcon} />
          <form className="stack" onSubmit={async (e) => { e.preventDefault(); if (name.trim()) { await updateUser({ name: name.trim() }); toast(t('common.saved')) } }}>
            <Field label={t('auth.name')}>
              <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={t('auth.username')}>
              <input className="input" value={user.username} disabled />
            </Field>
            <button className="btn btn-primary" disabled={!name.trim() || name.trim() === user.name}>{t('common.save')}</button>
          </form>
        </Tile>

        <Tile className="span-2">
          <TileHead title={t('settings.appearance')} icon={Palette} />
          <div className="field">
            <span className="row"><Languages size={16} aria-hidden /> {t('settings.language')}</span>
            <Segmented label={t('settings.language')} value={user.language} onChange={(language) => updateUser({ language })}
              options={LANGS.map((l) => ({ value: l.code, label: l.label }))} />
          </div>
          <div className="field">
            <span>{t('settings.theme')}</span>
            <Segmented<ThemePref> label={t('settings.theme')} value={user.theme} onChange={(theme) => updateUser({ theme })}
              options={[
                { value: 'system', label: <><Monitor size={16} aria-hidden /> {t('settings.themes.system')}</> },
                { value: 'light', label: <><Sun size={16} aria-hidden /> {t('settings.themes.light')}</> },
                { value: 'dark', label: <><Moon size={16} aria-hidden /> {t('settings.themes.dark')}</> },
              ]} />
          </div>
          <div className="field">
            <span className="row"><Type size={16} aria-hidden /> {t('settings.textSize')}</span>
            <Segmented<TextSize> label={t('settings.textSize')} value={user.text_size} onChange={(text_size) => updateUser({ text_size })}
              options={(['s', 'm', 'l', 'xl'] as TextSize[]).map((s, i) => ({
                value: s, label: <span style={{ fontSize: `${0.8 + i * 0.12}rem` }} title={t(`settings.textSizes.${s}`)}>Aa</span>,
              }))} />
          </div>
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <strong>{t('settings.simpleMode')}</strong>
              <p className="small muted">{t('settings.simpleModeHint')}</p>
            </div>
            <Toggle checked={user.simple_mode} onChange={(simple_mode) => updateUser({ simple_mode })} label={t('settings.simpleMode')} />
          </div>
        </Tile>

        <Tile className="span-2">
          <TileHead title={t('settings.security')} icon={ShieldCheck} />
          <form className="stack" onSubmit={changePassword} noValidate>
            <Field label={t('settings.currentPassword')} error={errText(pwErrors.current_password)}>
              <PasswordInput autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            </Field>
            <Field label={t('settings.newPassword')} error={errText(pwErrors.new_password)} hint={t('auth.passwordHint')}>
              <PasswordInput autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            </Field>
            <button className="btn" disabled={!pw.current_password || !pw.new_password}>{t('settings.changePassword')}</button>
          </form>
        </Tile>

        <Tile className="span-2">
          <TileHead title={t('settings.danger')} icon={TriangleAlert} />
          <p className="small muted">{t('settings.deleteAccountHint')}</p>
          <button className="btn btn-danger" style={{ marginTop: 'auto' }} onClick={() => setDeleting(true)}>{t('settings.deleteAccount')}</button>
        </Tile>
      </div>

      {deleting && (
        <Modal title={t('settings.deleteAccount')} onClose={() => setDeleting(false)} size="sm">
          <p className="muted">{t('settings.deleteAccountHint')}</p>
          <Field label={t('settings.deleteConfirm')}>
            <input className="input" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoCapitalize="none" />
          </Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setDeleting(false)}>{t('common.cancel')}</button>
            <button className="btn btn-expense" disabled={confirmName !== user.username} onClick={deleteAccount}>{t('common.delete')}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
