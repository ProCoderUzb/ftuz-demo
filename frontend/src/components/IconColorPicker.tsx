import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { COLORS, ICON_NAMES, iconFor } from '../lib/icons'

export function IconColorPicker({
  icon, color, onIcon, onColor, icons = ICON_NAMES,
}: { icon: string; color: string; onIcon: (v: string) => void; onColor: (v: string) => void; icons?: string[] }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="field">
        <span>{t('common.icon')}</span>
        <div role="group" aria-label={t('common.icon')} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(2.75rem, 1fr))', gap: 6 }}>
          {icons.map((name) => {
            const Icon = iconFor(name)
            const selected = name === icon
            return (
              <button key={name} type="button" className="btn btn-sm icon-btn" aria-pressed={selected} aria-label={name}
                onClick={() => onIcon(name)}
                style={{ width: '100%', height: '2.75rem', color: selected ? color : 'var(--text-2)', boxShadow: selected ? 'var(--soft-inset)' : undefined, borderColor: selected ? color : undefined }}>
                <Icon size={20} aria-hidden />
              </button>
            )
          })}
        </div>
      </div>
      <div className="field">
        <span>{t('common.color')}</span>
        <div className="row wrap" role="group" aria-label={t('common.color')} style={{ gap: 8 }}>
          {COLORS.map((c) => (
            <button key={c} type="button" aria-pressed={c === color} aria-label={c} onClick={() => onColor(c)}
              style={{ width: 32, height: 32, borderRadius: 10, border: '2px solid var(--surface-solid)', background: c, cursor: 'pointer', display: 'grid', placeItems: 'center', boxShadow: c === color ? `0 0 0 2px ${c}` : 'var(--soft-raised-sm)' }}>
              {c === color && <Check size={16} color="#fff" aria-hidden />}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
